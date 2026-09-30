import base64
import datetime as dt
import json
from pathlib import Path
import re
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch

from moments_service import server


NOW = dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"small-image").decode()
HEAD = "1" * 40
NEW_HEAD = "2" * 40
OLD = {"id": "old", "content": "之前的一条", "createdAt": NOW, "images": []}


class FakeGitHub:
    def __init__(self):
        self.head = HEAD
        self.entries = [OLD]
        self.created = None
        self.ref_updates = 0
        self.conflict_once = False

    def __call__(self, path, method="GET", body=None, token=None):
        assert token == "server-only-token"
        prefix = "/repos/xiaozhang0406/xiaozhang0406.github.io"
        if path == prefix + "/git/ref/heads/main":
            return {"object": {"sha": self.head}}
        if path == prefix + "/git/commits/" + self.head:
            return {"tree": {"sha": "tree-" + self.head}}
        if path.startswith(prefix + "/contents/source/_data/moments.json?ref="):
            return {"encoding": "base64", "content": base64.b64encode(json.dumps({
                "version": 1, "entries": self.entries
            }).encode()).decode()}
        if path == prefix + "/git/blobs" and method == "POST":
            return {"sha": "3" * 40}
        if path == prefix + "/git/trees" and method == "POST":
            assert body["base_tree"] == "tree-" + self.head
            assert all(item["path"] == "source/_data/moments.json" or
                       item["path"].startswith("source/img/moments/") for item in body["tree"])
            self.created = json.loads(next(item["content"] for item in body["tree"]
                                           if item["path"] == "source/_data/moments.json"))
            return {"sha": "4" * 40}
        if path == prefix + "/git/commits" and method == "POST":
            assert body["parents"] == [self.head]
            return {"sha": NEW_HEAD}
        if path == prefix + "/git/refs/heads/main" and method == "PATCH":
            assert body == {"sha": NEW_HEAD, "force": False}
            self.ref_updates += 1
            if self.conflict_once:
                self.conflict_once = False
                self.entries.insert(0, {"id": "other", "content": "并发新增", "createdAt": NOW, "images": []})
                self.head = "5" * 40
                raise server.PublicError("仓库正在更新。", 409)
            self.entries = self.created["entries"]
            self.head = NEW_HEAD
            return {}
        raise AssertionError((path, method))


class MomentsServiceTests(unittest.TestCase):
    def payload(self, images=False):
        return {"draft": {"id": "new-post", "content": "旅行回来了，好累", "createdAt": NOW},
                "uploads": [{"mime": "image/png", "base64": PNG, "alt": "旅途"}] if images else []}

    def test_text_publish_and_retry_are_idempotent(self):
        fake = FakeGitHub()
        with patch.object(server, "api", fake):
            result = server.publish("server-only-token", self.payload())
            self.assertEqual(result, {"sha": NEW_HEAD, "recovered": False})
            self.assertEqual([item["id"] for item in fake.entries], ["new-post", "old"])
            self.assertEqual(server.publish("server-only-token", self.payload()),
                             {"sha": NEW_HEAD, "recovered": True})
            self.assertEqual(fake.ref_updates, 1)

    def test_image_and_concurrent_change_are_preserved(self):
        fake = FakeGitHub()
        fake.conflict_once = True
        with patch.object(server, "api", fake):
            server.publish("server-only-token", self.payload(images=True))
        self.assertEqual([item["id"] for item in fake.entries], ["new-post", "other", "old"])
        self.assertEqual(fake.entries[0]["images"][0]["src"], "/img/moments/new-post-1.png")
        self.assertEqual(fake.ref_updates, 2)

    def test_invalid_images_and_oversized_content_stop_before_github(self):
        bad = self.payload(images=True)
        bad["uploads"][0]["base64"] = base64.b64encode(b"not a png").decode()
        with self.assertRaises(server.PublicError):
            server.prepare(bad)
        bad = self.payload()
        bad["draft"]["content"] = "字" * 4001
        with self.assertRaises(server.PublicError):
            server.prepare(bad)

    def test_existing_document_requires_unique_ids(self):
        fake = FakeGitHub()
        fake.entries = [OLD, OLD]
        with patch.object(server, "api", fake), self.assertRaises(server.PublicError):
            server.publish("server-only-token", self.payload())

    def test_http_health_and_untrusted_origin(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{httpd.server_port}/moments-api/health"
            with urllib.request.urlopen(url, timeout=3) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("ready", json.load(response))
            request = urllib.request.Request(url, headers={"Origin": "https://evil.example"})
            with urllib.request.urlopen(request, timeout=3) as response:
                self.assertIsNone(response.headers.get("Access-Control-Allow-Origin"))
        finally:
            httpd.shutdown()
            httpd.server_close()

    def test_http_recovery_preserves_origin_and_rejects_untrusted_posts(self):
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        with tempfile.TemporaryDirectory() as directory, patch.object(
                server, "APP_CONFIG", Path(directory) / "app.json"):
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            url = f"http://127.0.0.1:{httpd.server_port}/moments-api"
            opener = urllib.request.build_opener(NoRedirect)
            try:
                with opener.open(url + "/setup/callback?code=testcode&state=expired", timeout=3) as response:
                    self.assertEqual(response.headers["Referrer-Policy"], "origin")
                    self.assertIn("form-action 'self' https://github.com", response.headers["Content-Security-Policy"])
                    cookie = response.headers["Set-Cookie"].split(";", 1)[0]
                    page = response.read().decode()
                self.assertNotIn("testcode", page)
                recovery = re.search("name='recovery' value='([^']+)'", page).group(1)
                body = urllib.parse.urlencode({"recovery": recovery}).encode()

                def post(origin, with_cookie=True):
                    headers = {"Origin": origin, "Content-Type": "application/x-www-form-urlencoded"}
                    if with_cookie:
                        headers["Cookie"] = cookie
                    request = urllib.request.Request(url + "/setup/recover", data=body, headers=headers)
                    with self.assertRaises(urllib.error.HTTPError) as error:
                        opener.open(request, timeout=3)
                    return error.exception

                with patch.object(server, "api") as github:
                    for origin in ("null", "https://evil.example"):
                        self.assertEqual(post(origin).code, 403)
                    github.assert_not_called()
                    self.assertFalse(server.APP_CONFIG.exists())
                    github.return_value = {"owner": {"id": server.OWNER_ID},
                                           "permissions": {"contents": "write"},
                                           "slug": "test-moments", "client_id": "test-id",
                                           "client_secret": "test-secret"}
                    result = post("https://planner.yarinaoshi.top")
                    self.assertEqual(result.code, 302)
                    self.assertEqual(result.headers["Location"],
                                     "https://github.com/apps/test-moments/installations/new")
                    github.assert_called_once_with("/app-manifests/testcode/conversions", "POST")
                    self.assertEqual(server.credentials(), ("test-id", "test-secret"))
                    self.assertEqual(post("https://planner.yarinaoshi.top").code, 403)
                    github.assert_called_once()
            finally:
                httpd.shutdown()
                httpd.server_close()

    def test_callback_network_failure_shows_return_action_without_leaking_code(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        state = "network-error-test"
        server.oauth_states[state] = (time.time() + 60, "test-verifier", server.FRONTEND)
        url = f"http://127.0.0.1:{httpd.server_port}/moments-api/callback?code=private-test-code&state={state}"
        try:
            request = urllib.request.Request(url, headers={"Cookie": "moments_oauth=" + state})
            with patch.object(server, "credentials", return_value=("test-id", "test-secret")), patch.object(
                    server, "github_request", side_effect=server.PublicError("连接 GitHub 失败，内容仍保留在编辑框里。", 502)):
                with self.assertRaises(urllib.error.HTTPError) as failure:
                    urllib.request.urlopen(request, timeout=3)
            response = failure.exception
            self.assertEqual(response.code, 502)
            self.assertEqual(response.headers.get_content_type(), "text/html")
            page = response.read().decode()
            self.assertIn("返回编辑页", page)
            self.assertIn('"ok": false', page)
            self.assertIn(server.FRONTEND, page)
            for secret in ("private-test-code", "test-verifier", "test-secret"):
                self.assertNotIn(secret, page)
        finally:
            httpd.shutdown()
            httpd.server_close()
            server.oauth_states.pop(state, None)


if __name__ == "__main__":
    unittest.main()
