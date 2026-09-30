"""Small, dependency-free GitHub App login and moments publisher.

Run behind an HTTPS reverse proxy. Credentials are environment variables, never
sent to the browser. This process intentionally binds to loopback only.
"""
import base64
import binascii
import datetime as dt
import hashlib
import hmac
import html
import json
import os
from pathlib import Path
import re
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OWNER = "xiaozhang0406"
REPO = "xiaozhang0406.github.io"
REPO_ID = 1308590158
OWNER_ID = 109855762
BRANCH = "main"
DATA_PATH = "source/_data/moments.json"
BASE_PATH = "/moments-api"
BASE_URL = "https://planner.yarinaoshi.top" + BASE_PATH
FRONTEND = "https://yarinaoshi.top"
ORIGINS = {FRONTEND, "https://www.yarinaoshi.top"}
MAX_BODY = 46 * 1024 * 1024
MAX_IMAGES = 9
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_TOTAL_BYTES = 32 * 1024 * 1024
TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
USER_AGENT = "Yarinaoshi-Moments/2"
API_VERSION = "2026-03-10"
APP_CONFIG = Path(os.environ.get("MOMENTS_APP_CONFIG", "/var/lib/moments-publisher/app.json"))
SETUP_KEY = os.environ.get("MOMENTS_SETUP_KEY", "")

sessions = {}
oauth_states = {}
setup_states = {}
recovery_states = {}
state_lock = threading.Lock()
publish_lock = threading.Lock()
refresh_lock = threading.Lock()


class PublicError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def credentials():
    try:
        app = json.loads(APP_CONFIG.read_text(encoding="utf-8"))
        if app.get("owner_id") == OWNER_ID and app.get("client_id") and app.get("client_secret"):
            return app["client_id"], app["client_secret"]
    except (OSError, ValueError):
        pass
    return "", ""


def github_request(url, method="GET", body=None, token=None, form=False):
    headers = {"Accept": "application/json" if form else "application/vnd.github+json", "User-Agent": USER_AGENT}
    if url.startswith("https://api.github.com/"):
        headers["X-GitHub-Api-Version"] = API_VERSION
    if token:
        headers["Authorization"] = "Bearer " + token
    if body is not None:
        if form:
            encoded = urllib.parse.urlencode(body).encode("utf-8")
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
    else:
        encoded = None
    req = urllib.request.Request(url, data=encoded, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 401:
            raise PublicError("GitHub 登录已过期，请重新登录。", 401) from None
        if error.code == 403:
            raise PublicError("GitHub 拒绝写入，请检查应用是否仅安装在博客仓库，或稍后重试。", 403) from None
        if error.code == 404:
            raise PublicError("找不到博客仓库或碎碎念数据。", 404) from None
        if error.code in (409, 422):
            raise PublicError("仓库正在更新或限制了发布，请稍后重试。", 409) from None
        raise PublicError("GitHub 暂时无法完成请求，请稍后重试。", 502) from None
    except (urllib.error.URLError, TimeoutError) as error:
        print(f"GitHub connection failed: {urllib.parse.urlparse(url).hostname} {type(error).__name__}", flush=True)
        raise PublicError("连接 GitHub 失败，内容仍保留在编辑框里。", 502) from None


def api(path, method="GET", body=None, token=None):
    return github_request("https://api.github.com" + path, method, body, token)


def validate_image(raw, mime):
    if mime not in TYPES:
        raise PublicError("请选择 JPG、PNG、WebP 或 GIF 图片。")
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise PublicError("每张图片需要小于或等于 8 MB。")
    valid = (
        (mime == "image/jpeg" and raw.startswith(b"\xff\xd8\xff"))
        or (mime == "image/png" and raw.startswith(b"\x89PNG\r\n\x1a\n"))
        or (mime == "image/gif" and raw[:6] in (b"GIF87a", b"GIF89a"))
        or (mime == "image/webp" and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP")
    )
    if not valid:
        raise PublicError("所选文件与图片格式不符，请重新选择图片。")
    return TYPES[mime]


def validate_entry(entry, existing=False):
    if not isinstance(entry, dict):
        raise PublicError("碎碎念数据格式不正确。")
    identifier = entry.get("id")
    created = entry.get("createdAt")
    content = entry.get("content")
    images = entry.get("images")
    if not isinstance(identifier, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,79}", identifier):
        raise PublicError("碎碎念记录的标识不正确。")
    if not isinstance(created, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", created):
        raise PublicError("碎碎念的时间格式不正确。")
    try:
        stamp = dt.datetime.fromisoformat(created.replace("Z", "+00:00"))
    except ValueError:
        raise PublicError("碎碎念的时间格式不正确。") from None
    if stamp.isoformat(timespec="milliseconds").replace("+00:00", "Z") != created:
        raise PublicError("碎碎念的时间格式不正确。")
    if not existing and abs((dt.datetime.now(dt.timezone.utc) - stamp).total_seconds()) > 86400:
        raise PublicError("发布时间已过期，请重新打开编辑页。")
    if not isinstance(content, str) or len(content) > 4000:
        raise PublicError("每条碎碎念最多 4000 字。")
    if not isinstance(images, list) or len(images) > MAX_IMAGES:
        raise PublicError("每条碎碎念最多 9 张图片。")
    cleaned_images = []
    for image in images:
        if not isinstance(image, dict):
            raise PublicError("碎碎念图片格式不正确。")
        src, alt = image.get("src"), image.get("alt")
        if not isinstance(src, str) or not re.fullmatch(r"/img/moments/[A-Za-z0-9-]+\.(jpg|png|webp|gif)", src):
            raise PublicError("碎碎念图片地址不正确。")
        if not isinstance(alt, str) or len(alt) > 300:
            raise PublicError("碎碎念图片说明不正确。")
        cleaned_images.append({"src": src, "alt": alt})
    clean = {"id": identifier, "content": content.strip(), "createdAt": created, "images": cleaned_images}
    if not clean["content"] and not clean["images"]:
        raise PublicError("写一点文字，或选择至少一张图片。")
    return clean


def prepare(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("draft"), dict):
        raise PublicError("发布内容格式不正确。")
    draft = payload["draft"]
    uploads = payload.get("uploads")
    if not isinstance(uploads, list) or len(uploads) > MAX_IMAGES:
        raise PublicError("最多选择 9 张图片。")
    images, blobs = [], []
    total = 0
    for index, upload in enumerate(uploads, 1):
        if not isinstance(upload, dict) or not isinstance(upload.get("base64"), str):
            raise PublicError("图片数据格式不正确。")
        b64 = upload["base64"]
        if len(b64) > 4 * ((MAX_IMAGE_BYTES + 2) // 3) or not re.fullmatch(r"[A-Za-z0-9+/]*={0,2}", b64):
            raise PublicError("图片数据超过大小限制。")
        try:
            raw = base64.b64decode(b64, validate=True)
        except (ValueError, binascii.Error):
            raise PublicError("图片数据格式不正确。") from None
        extension = validate_image(raw, upload.get("mime"))
        total += len(raw)
        if total > MAX_TOTAL_BYTES:
            raise PublicError("图片总大小不能超过 32 MB。")
        identifier = draft.get("id")
        if not isinstance(identifier, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,79}", identifier):
            raise PublicError("碎碎念记录的标识不正确。")
        path = f"source/img/moments/{identifier}-{index}.{extension}"
        alt = upload.get("alt", f"图片 {index}")
        images.append({"src": "/" + path.removeprefix("source/"), "alt": alt})
        blobs.append({"path": path, "base64": b64})
    entry = validate_entry({
        "id": draft.get("id"), "content": draft.get("content"),
        "createdAt": draft.get("createdAt"), "images": images
    })
    return entry, blobs


def read_state(token):
    prefix = f"/repos/{OWNER}/{REPO}"
    ref = api(f"{prefix}/git/ref/heads/{BRANCH}", token=token)
    head = ref["object"]["sha"]
    commit = api(f"{prefix}/git/commits/{head}", token=token)
    file = api(f"{prefix}/contents/{DATA_PATH}?ref={head}", token=token)
    if file.get("encoding") != "base64":
        file = api(f"{prefix}/git/blobs/{file['sha']}", token=token)
    try:
        document = json.loads(base64.b64decode(file["content"]))
        if document.get("version") != 1 or not isinstance(document.get("entries"), list):
            raise ValueError()
        cleaned = [validate_entry(item, existing=True) for item in document["entries"]]
        if len({item["id"] for item in cleaned}) != len(cleaned):
            raise ValueError()
    except (KeyError, ValueError, TypeError, PublicError):
        raise PublicError("已有碎碎念数据无法读取，为避免覆盖内容，发布已停止。", 409) from None
    return head, commit["tree"]["sha"], cleaned


def publish(token, payload):
    entry, blobs = prepare(payload)
    prefix = f"/repos/{OWNER}/{REPO}"
    with publish_lock:
        head, base_tree, entries = read_state(token)
        def already_saved():
            saved = next((item for item in entries if item["id"] == entry["id"]), None)
            if saved and saved != entry:
                raise PublicError("这条记录的标识已被使用，请刷新编辑页后重试。", 409)
            return bool(saved)
        if already_saved():
            return {"sha": head, "recovered": True}
        image_tree = []
        for image in blobs:
            blob = api(prefix + "/git/blobs", "POST", {"encoding": "base64", "content": image["base64"]}, token)
            image_tree.append({"path": image["path"], "mode": "100644", "type": "blob", "sha": blob["sha"]})
        for attempt in range(3):
            if attempt:
                head, base_tree, entries = read_state(token)
                if already_saved():
                    return {"sha": head, "recovered": True}
            document = {"version": 1, "entries": [entry, *entries]}
            tree = api(prefix + "/git/trees", "POST", {
                "base_tree": base_tree,
                "tree": [*image_tree, {
                    "path": DATA_PATH, "mode": "100644", "type": "blob",
                    "content": json.dumps(document, ensure_ascii=False, indent=2) + "\n"
                }]
            }, token)
            commit = api(prefix + "/git/commits", "POST", {
                "message": "发布碎碎念 " + entry["createdAt"], "tree": tree["sha"], "parents": [head]
            }, token)
            try:
                api(prefix + f"/git/refs/heads/{BRANCH}", "PATCH", {"sha": commit["sha"], "force": False}, token)
                return {"sha": commit["sha"], "recovered": False}
            except PublicError as error:
                if error.status not in (409, 502):
                    raise
                if attempt == 2:
                    latest, _, entries = read_state(token)
                    if already_saved():
                        return {"sha": latest, "recovered": True}
                    raise
    raise PublicError("发布未完成，请稍后重试。", 502)


def refresh(session):
    with refresh_lock:
        if session["expires"] > time.time() + 60:
            return
        client_id, client_secret = credentials()
        result = github_request("https://github.com/login/oauth/access_token", "POST", {
            "client_id": client_id, "client_secret": client_secret,
            "grant_type": "refresh_token", "refresh_token": session["refresh"]
        }, form=True)
        if "access_token" not in result:
            raise PublicError("GitHub 登录已过期，请重新登录。", 401)
        session.update(token=result["access_token"], refresh=result["refresh_token"],
                       expires=time.time() + result["expires_in"])


class Handler(BaseHTTPRequestHandler):
    server_version = "MomentsPublisher/2"
    def log_message(self, format_string, *args):
        # Never log OAuth codes, cookies, tokens, query strings, or user content.
        print(f"{self.address_string()} {self.command} {self.path.split('?')[0]}", flush=True)

    def send_json(self, data, status=200, origin=None, cookie=None):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(raw)

    def redirect(self, url, cookie=None):
        self.send_response(302)
        self.send_header("Location", url)
        self.send_header("Cache-Control", "no-store")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def cookie(self, name):
        try:
            jar = cookies.SimpleCookie()
            jar.load(self.headers.get("Cookie", ""))
            return jar[name].value if name in jar else None
        except cookies.CookieError:
            return None

    def session(self):
        sid = self.cookie("moments_session")
        with state_lock:
            session = sessions.get(sid)
        if not session:
            return None
        try:
            refresh(session)
        except PublicError:
            with state_lock:
                sessions.pop(sid, None)
            return None
        return session

    def do_OPTIONS(self):
        origin = self.headers.get("Origin")
        if origin not in ORIGINS or self.path not in (BASE_PATH + "/publish", BASE_PATH + "/logout"):
            return self.send_json({"error": "不允许的来源。"}, 403)
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        origin = self.headers.get("Origin")
        try:
            if parsed.path == BASE_PATH + "/health":
                return self.send_json({"ready": all(credentials())}, origin=origin)
            if parsed.path == BASE_PATH + "/session":
                session = self.session()
                return self.send_json({"authenticated": bool(session), "login": session["login"] if session else None}, origin=origin)
            if parsed.path == BASE_PATH + "/login":
                return self.login(urllib.parse.parse_qs(parsed.query))
            if parsed.path == BASE_PATH + "/callback":
                return self.callback(urllib.parse.parse_qs(parsed.query))
            if parsed.path == BASE_PATH + "/setup":
                return self.setup_manifest(urllib.parse.parse_qs(parsed.query))
            if parsed.path == BASE_PATH + "/setup/callback":
                return self.setup_callback(urllib.parse.parse_qs(parsed.query))
            self.send_json({"error": "页面不存在。"}, 404, origin)
        except PublicError as error:
            if parsed.path == BASE_PATH + "/callback":
                return self.auth_failed(error)
            self.send_json({"error": str(error)}, error.status, origin)
        except Exception:
            if parsed.path == BASE_PATH + "/callback":
                return self.auth_failed(PublicError("登录暂时未完成，请回到编辑页重新点击登录。", 502))
            self.send_json({"error": "服务暂时不可用，请稍后重试。"}, 502, origin)

    def auth_failed(self, error):
        origin = getattr(self, "auth_origin", FRONTEND)
        payload = json.dumps({"source": "moments-auth", "ok": False, "error": str(error)}, ensure_ascii=False).replace("<", "\\u003c")
        body = ("<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
                "<title>登录暂时未完成</title><style>body{font-family:system-ui,sans-serif;background:#f7f9fb;color:#334155;"
                "padding:24px}main{max-width:440px;margin:12vh auto;background:white;padding:32px;border-radius:12px;"
                "box-shadow:0 4px 20px #0001}h1{font-size:24px}p{line-height:1.8}button{border:0;border-radius:6px;"
                "background:#49b1f5;color:white;padding:12px 20px;cursor:pointer}</style><main><h1>登录暂时未完成</h1><p>"
                + html.escape(str(error)) + "</p><p>编辑中的文字和图片还在原页面，回去后重新点击登录即可。</p>"
                "<button id='back'>返回编辑页</button></main><script>const origin=" + json.dumps(origin) + ";"
                "if(window.opener)window.opener.postMessage(" + payload + ",origin);"
                "document.getElementById('back').onclick=()=>{if(window.opener)window.close();"
                "else location.href=origin+'/moments/edit/'};</script>").encode("utf-8")
        self.send_response(error.status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def login(self, params):
        client_id, client_secret = credentials()
        if not client_id or not client_secret:
            raise PublicError("网页登录正在配置，请稍后再试。", 503)
        origin = params.get("return_origin", [FRONTEND])[0]
        if origin not in ORIGINS:
            raise PublicError("不允许的返回页面。", 403)
        state = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        with state_lock:
            oauth_states[state] = (time.time() + 600, verifier, origin)
            for key, value in list(oauth_states.items()):
                if value[0] < time.time():
                    del oauth_states[key]
        query = urllib.parse.urlencode({
            "client_id": client_id, "redirect_uri": BASE_URL + "/callback", "state": state,
            "code_challenge": challenge, "code_challenge_method": "S256"
        })
        self.redirect("https://github.com/login/oauth/authorize?" + query,
                      f"moments_oauth={state}; Path={BASE_PATH}; Max-Age=600; HttpOnly; Secure; SameSite=Lax")

    def callback(self, params):
        state = params.get("state", [""])[0]
        code = params.get("code", [""])[0]
        with state_lock:
            saved = oauth_states.pop(state, None)
        if not saved or saved[0] < time.time() or not code or not hmac.compare_digest(state, self.cookie("moments_oauth") or ""):
            raise PublicError("GitHub 登录校验失败，请回到编辑页重试。", 403)
        _, verifier, origin = saved
        self.auth_origin = origin
        client_id, client_secret = credentials()
        result = github_request("https://github.com/login/oauth/access_token", "POST", {
            "client_id": client_id, "client_secret": client_secret, "code": code,
            "redirect_uri": BASE_URL + "/callback", "code_verifier": verifier,
            "repository_id": str(REPO_ID)
        }, form=True)
        token = result.get("access_token")
        if not isinstance(token, str) or not token.startswith("ghu_"):
            raise PublicError("GitHub 登录未完成，请重试。", 401)
        user = api("/user", token=token)
        repo = api(f"/repos/{OWNER}/{REPO}", token=token)
        if user.get("id") != OWNER_ID or repo.get("id") != REPO_ID or repo.get("archived") or not repo.get("permissions", {}).get("push"):
            raise PublicError("只有博客所有者可以发布，请检查应用是否仅安装在博客仓库。", 403)
        sid = secrets.token_urlsafe(48)
        with state_lock:
            sessions[sid] = {
                "login": user["login"], "token": token, "refresh": result["refresh_token"],
                "expires": time.time() + result["expires_in"]
            }
        html = ("<!doctype html><meta charset='utf-8'><title>登录完成</title>"
                "<p>已登录，可以回到碎碎念编辑页。这个窗口可以关闭。</p>"
                "<script>if(window.opener){window.opener.postMessage({source:'moments-auth',ok:true},"
                + json.dumps(origin) + ");window.close()}</script>")
        raw = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", f"default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Set-Cookie", f"moments_session={sid}; Path={BASE_PATH}; Max-Age=15552000; HttpOnly; Secure; SameSite=Lax")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def setup_manifest(self, params):
        if all(credentials()) or not SETUP_KEY:
            raise PublicError("GitHub 应用已配置或暂未开放配置。", 403)
        key = params.get("key", [""])[0]
        if not hmac.compare_digest(key, SETUP_KEY):
            raise PublicError("配置链接无效。", 403)
        state = secrets.token_urlsafe(32)
        with state_lock:
            setup_states[state] = time.time() + 3600
        manifest = {
            "name": "Yarinaoshi Moments",
            "url": FRONTEND + "/moments/",
            "description": "仅供博客所有者在网页上发布碎碎念。",
            "hook_attributes": {"url": BASE_URL + "/webhook", "active": False},
            "redirect_url": BASE_URL + "/setup/callback",
            "callback_urls": [BASE_URL + "/callback"],
            "setup_url": FRONTEND + "/moments/edit/",
            "public": False,
            "default_events": [],
            "default_permissions": {"contents": "write"}
        }
        import html
        body = (
            "<!doctype html><meta charset='utf-8'><title>配置碎碎念登录</title>"
            "<h1>配置碎碎念的 GitHub 登录</h1>"
            "<p>GitHub 会创建一个仅用于发布碎碎念的应用。请在下一页核对它只申请 Contents 读写权限；"
            "安装时只选 xiaozhang0406.github.io。</p>"
            "<form method='post' action='https://github.com/settings/apps/new'>"
            "<input type='hidden' name='manifest' value='" + html.escape(json.dumps(manifest), quote=True) + "'>"
            "<input type='hidden' name='state' value='" + html.escape(state, quote=True) + "'>"
            "<button type='submit'>前往 GitHub 创建应用</button></form>"
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action https://github.com; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Set-Cookie", f"moments_setup={state}; Path={BASE_PATH}; Max-Age=3600; HttpOnly; Secure; SameSite=Lax")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def setup_callback(self, params):
        state = params.get("state", [""])[0]
        code = params.get("code", [""])[0]
        with state_lock:
            expires = setup_states.pop(state, 0)
        if not code or not re.fullmatch(r"[A-Za-z0-9]+", code):
            raise PublicError("GitHub 没有返回有效的配置码。", 403)
        if expires < time.time() or not hmac.compare_digest(state, self.cookie("moments_setup") or ""):
            return self.setup_recovery_page(code)
        return self.complete_setup(code)

    def setup_recovery_page(self, code):
        if all(credentials()):
            raise PublicError("GitHub 应用已经配置。", 409)
        import html
        recovery = secrets.token_urlsafe(32)
        with state_lock:
            recovery_states[recovery] = (time.time() + 3600, code)
        body = (
            "<!doctype html><meta charset='utf-8'><title>继续配置碎碎念</title>"
            "<h1>应用已创建，登录配置还差一步</h1>"
            "<p>刚才的配置页停留较久，回跳校验超时。无需重新创建应用，点击下方按钮即可继续。</p>"
            "<form method='post' action='" + BASE_PATH + "/setup/recover'>"
            "<input type='hidden' name='recovery' value='" + html.escape(recovery, quote=True) + "'>"
            "<button type='submit'>继续完成配置</button></form>"
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        # Form POST needs a real Origin for CSRF checks; omit the callback query.
        self.send_header("Referrer-Policy", "origin")
        self.send_header("Content-Security-Policy", "default-src 'none'; form-action 'self' https://github.com; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Set-Cookie", f"moments_recovery={recovery}; Path={BASE_PATH}; Max-Age=3600; HttpOnly; Secure; SameSite=Lax")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def complete_setup(self, code):
        if all(credentials()):
            raise PublicError("GitHub 应用已经配置。", 409)
        app = api("/app-manifests/" + urllib.parse.quote(code, safe="") + "/conversions", "POST")
        if (app.get("owner", {}).get("id") != OWNER_ID
                or app.get("permissions", {}).get("contents") != "write"
                or not re.fullmatch(r"[A-Za-z0-9-]+", app.get("slug", ""))):
            raise PublicError("GitHub 应用的所有者或权限不符合预期，未启用。", 403)
        config = {"owner_id": OWNER_ID, "client_id": app["client_id"],
                  "client_secret": app["client_secret"], "slug": app["slug"]}
        APP_CONFIG.parent.mkdir(parents=True, exist_ok=True)
        temp = APP_CONFIG.with_name(APP_CONFIG.name + "." + secrets.token_hex(8))
        try:
            with os.fdopen(os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as output:
                json.dump(config, output)
            os.replace(temp, APP_CONFIG)
        finally:
            temp.unlink(missing_ok=True)
        self.redirect("https://github.com/apps/" + app["slug"] + "/installations/new")

    def do_POST(self):
        if self.path == BASE_PATH + "/setup/recover":
            return self.setup_recover()
        origin = self.headers.get("Origin")
        if origin not in ORIGINS:
            return self.send_json({"error": "不允许的来源。"}, 403)
        if self.path not in (BASE_PATH + "/publish", BASE_PATH + "/logout"):
            return self.send_json({"error": "页面不存在。"}, 404, origin)
        session = self.session()
        if not session:
            return self.send_json({"error": "请先登录 GitHub。"}, 401, origin)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > MAX_BODY:
                raise PublicError("发布内容超过大小限制。", 413)
            body = self.rfile.read(length)
            payload = json.loads(body)
            if self.path == BASE_PATH + "/logout":
                sid = self.cookie("moments_session")
                with state_lock:
                    sessions.pop(sid, None)
                return self.send_json({"ok": True}, origin=origin,
                                      cookie=f"moments_session=; Path={BASE_PATH}; Max-Age=0; HttpOnly; Secure; SameSite=Lax")
            result = publish(session["token"], payload)
            self.send_json(result, origin=origin)
        except PublicError as error:
            self.send_json({"error": str(error)}, error.status, origin)
        except (ValueError, UnicodeDecodeError, TypeError):
            self.send_json({"error": "发布内容格式不正确。"}, 400, origin)
        except Exception:
            self.send_json({"error": "保存失败，内容仍保留在编辑框里，请稍后重试。"}, 502, origin)

    def setup_recover(self):
        origin = self.headers.get("Origin")
        if origin != "https://planner.yarinaoshi.top":
            return self.send_json({"error": "不允许的来源。"}, 403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length < 2048:
                raise PublicError("恢复请求无效。", 400)
            data = urllib.parse.parse_qs(self.rfile.read(length).decode("utf-8"))
            recovery = data.get("recovery", [""])[0]
            with state_lock:
                saved = recovery_states.pop(recovery, None)
            if (not saved or saved[0] < time.time()
                    or not hmac.compare_digest(recovery, self.cookie("moments_recovery") or "")):
                raise PublicError("恢复链接已过期，请重新打开此页。", 403)
            self.complete_setup(saved[1])
        except PublicError as error:
            self.send_json({"error": str(error)}, error.status)
        except (ValueError, UnicodeDecodeError):
            self.send_json({"error": "恢复请求无效。"}, 400)


if __name__ == "__main__":
    port = int(os.environ.get("MOMENTS_PORT", "13301"))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
