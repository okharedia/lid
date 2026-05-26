from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PORT = 4173


class FallbackHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        translated = Path(super().translate_path(path))
        if translated.exists():
            return str(translated)

        clean_path = path.split("?", 1)[0].split("#", 1)[0]
        if clean_path.startswith("/q/") or clean_path == "/glossary":
            return str(ROOT / "index.html")

        return str(translated)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), FallbackHandler)
    print(f"Serving {ROOT} at http://127.0.0.1:{PORT}")
    server.serve_forever()
