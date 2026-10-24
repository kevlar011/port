"""Local dev server for the portfolio.

Run:  python dev.py        then open http://localhost:8765

Serves the site like GitHub Pages does, plus a small editing API that only
exists on your machine. The "Edit" button on the page appears only when this
server is running, so visitors to the live site never see it. After editing,
commit and push in GitHub Desktop to publish.
"""

import base64
import http.server
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
CONTENT = ROOT / "content" / "portfolio.json"
INDEX = ROOT / "index.html"
WORK = ROOT / "media" / "work"
PORT = 8765
MAX_BYTES = 25 * 1024 * 1024
TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
HOSTS = {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}
PROFILE_FIELDS = ("name", "role", "bio", "discord")
ASSETS = {"avatar": "pfp", "banner": "banner"}  # kind -> filename in media/


class BadRequest(Exception):
    pass


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "piece"


def decode_image(data_url):
    match = re.match(r"data:(image/[a-z]+);base64,(.+)", data_url or "", re.S)
    if not match or match.group(1) not in TYPES:
        raise BadRequest("Use a JPG, PNG, WebP or GIF image.")
    return TYPES[match.group(1)], base64.b64decode(match.group(2))


def load():
    return json.loads(CONTENT.read_text(encoding="utf-8"))


def store(cfg):
    CONTENT.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def add_piece(data):
    title = str(data.get("title", "")).strip()
    if not title:
        raise BadRequest("Add a title.")
    ext, raw = decode_image(data.get("image"))
    WORK.mkdir(parents=True, exist_ok=True)
    base = slugify(title)
    path, n = WORK / f"{base}.{ext}", 2
    while path.exists():
        path, n = WORK / f"{base}-{n}.{ext}", n + 1
    path.write_bytes(raw)

    cfg = load()
    piece = {"title": title, "image": path.relative_to(ROOT).as_posix()}
    cfg.setdefault("pieces", []).insert(0, piece)  # newest first
    store(cfg)
    print(f"Added '{title}' -> {piece['image']}")
    return piece


def save_content(data):
    """Replace profile text and the piece list (order, titles, removals)."""
    cfg = load()
    known = {p["image"] for p in cfg.get("pieces", [])}
    pieces = []
    for p in data.get("pieces", []):
        title, image = str(p.get("title", "")).strip(), p.get("image")
        if image not in known:
            raise BadRequest("Unknown piece. Reload the page and try again.")
        if not title:
            raise BadRequest("Every piece needs a title.")
        pieces.append({"title": title, "image": image})

    for field in PROFILE_FIELDS:
        if field in data:
            cfg[field] = str(data[field]).strip()
    if not cfg.get("name"):
        raise BadRequest("Your name can't be empty.")
    cfg["pieces"] = pieces
    store(cfg)

    # Delete image files of removed pieces (git history still has them).
    for image in known - {p["image"] for p in pieces}:
        (ROOT / image).unlink(missing_ok=True)
        print(f"Removed {image}")
    return {"ok": True}


def replace_asset(data):
    """Swap the avatar or banner, then cache-bust it everywhere it's referenced."""
    kind = data.get("kind")
    if kind not in ASSETS:
        raise BadRequest("Unknown image slot.")
    ext, raw = decode_image(data.get("image"))
    cfg = load()
    old = cfg.get(kind)
    new = f"media/{ASSETS[kind]}.{ext}"
    (ROOT / new).write_bytes(raw)
    if old and old != new:
        (ROOT / old).unlink(missing_ok=True)

    version = int(cfg.get("assetVersion", 1)) + 1
    cfg[kind], cfg["assetVersion"] = new, version
    store(cfg)

    # index.html: favicon and link-preview images (og:image, twitter:image).
    html = INDEX.read_text(encoding="utf-8")
    name = re.escape(ASSETS[kind])
    html = re.sub(rf'media/{name}\.\w+(\?v=\d+)?"', f'{new}?v={version}"', html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Replaced {kind} -> {new} (v{version})")
    return {"ok": True}


ROUTES = {"/api/pieces": add_piece, "/api/content": save_content, "/api/asset": replace_asset}


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
        route = ROUTES.get(self.path)
        if not route:
            return self.send_json(404, {"error": "Not found"})
        # Only this page may edit: blocks other websites (and DNS rebinding)
        # from posting to the server while it runs.
        origin = self.headers.get("Origin")
        if (self.headers.get("Host") not in HOSTS
                or (origin and origin.split("//")[-1] not in HOSTS)
                or self.headers.get("Content-Type") != "application/json"):
            return self.send_json(403, {"error": "Forbidden"})

        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BYTES * 1.4:
            return self.send_json(413, {"error": "Image is too large (25 MB max)."})
        try:
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise BadRequest("Bad request.")
            return self.send_json(200, route(data))
        except BadRequest as err:
            return self.send_json(400, {"error": str(err)})
        except (ValueError, TypeError, AttributeError):
            return self.send_json(400, {"error": "Bad request."})


if __name__ == "__main__":
    # 127.0.0.1 only: the editing API is never reachable from other devices.
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Portfolio dev server: http://localhost:{PORT}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
