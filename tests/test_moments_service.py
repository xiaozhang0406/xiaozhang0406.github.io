import base64
import datetime as dt
import json
import threading
import unittest
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


if __name__ == "__main__":
    unittest.main()
