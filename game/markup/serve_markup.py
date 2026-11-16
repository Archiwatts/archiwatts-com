"""Local server for the ArchiWatts city markup tool.

Serves the repository root on http://127.0.0.1:8125 and accepts saves from the pages:
  POST /__save?name=<file>        body = data URL (png) or JSON text  -> game/markup/<file>
  POST /__markup?name=<file>.json body = JSON                         -> game/markup/markups/<file>.json
Run:  python game/markup/serve_markup.py
"""
import http.server, base64, os, json, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MARKUP = os.path.join(ROOT, 'game', 'markup')
os.makedirs(os.path.join(MARKUP, 'markups'), exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_POST(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        name = os.path.basename(q.get('name', ['out'])[0])
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if u.path == '/__save':
            txt = body.decode('utf-8', 'replace')
            data = base64.b64decode(txt.split(',', 1)[1]) if txt.startswith('data:') else body
            path = os.path.join(MARKUP, name)
        elif u.path == '/__markup':
            json.loads(body)                     # must be valid JSON
            data = body; path = os.path.join(MARKUP, 'markups', name)
        else:
            self.send_response(404); self.end_headers(); return
        with open(path, 'wb') as f: f.write(data)
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps({'saved': os.path.relpath(path, ROOT)}).encode())

if __name__ == '__main__':
    print('serving', ROOT, 'on http://127.0.0.1:8125')
    http.server.ThreadingHTTPServer(('127.0.0.1', 8125), H).serve_forever()
