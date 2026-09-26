"""Local dev server for the portfolio.

Run:  python dev.py        then open http://localhost:8765

Serves the site like GitHub Pages does, plus a small upload API that only
exists on your machine. The "Add piece" button on the page appears only when
this server is running, so visitors to the live site never see it.
"""

import base64
import http.server
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
CONTENT = ROOT / "content" / "portfolio.json"
WORK = ROOT / "media" / "work"
PORT = 8765
MAX_BYTES = 25 * 1024 * 1024
TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "piece"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/dev":
            return self.send_json(200, {"ok": True})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/pieces":
            return self.send_json(404, {"error": "Not found"})

        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BYTES * 1.4:
            return self.send_json(413, {"error": "Image is too large (25 MB max)."})
        try:
            data = json.loads(self.rfile.read(length))
            title = str(data.get("title", "")).strip()
            match = re.match(r"data:(image/[a-z]+);base64,(.+)", data.get("image", ""), re.S)
        except (ValueError, AttributeError):
            return self.send_json(400, {"error": "Bad request."})

        if not title:
            return self.send_json(400, {"error": "Add a title."})
        if not match or match.group(1) not in TYPES:
            return self.send_json(400, {"error": "Use a JPG, PNG, WebP or GIF image."})

        raw = base64.b64decode(match.group(2))
        WORK.mkdir(parents=True, exist_ok=True)
        base = slugify(title)
        ext = TYPES[match.group(1)]
        path, n = WORK / f"{base}.{ext}", 2
        while path.exists():
            path, n = WORK / f"{base}-{n}.{ext}", n + 1
        path.write_bytes(raw)

        cfg = json.loads(CONTENT.read_text(encoding="utf-8"))
        piece = {"title": title, "image": path.relative_to(ROOT).as_posix()}
        cfg.setdefault("pieces", []).insert(0, piece)  # newest first
        CONTENT.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        print(f"Added '{title}' -> {piece['image']}")
        return self.send_json(201, piece)


if __name__ == "__main__":
    # 127.0.0.1 only: the upload API is never reachable from other devices.
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Portfolio dev server: http://localhost:{PORT}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
