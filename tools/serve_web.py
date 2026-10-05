"""Serves a web build to phones on the local Wi-Fi without browser caching.

Python's plain `http.server` sends no Cache-Control, so browsers cache index.html heuristically
and keep loading the previous build's bundles after a rebuild. This one says no-store.
Python is used (not Node) because the Windows firewall here already allows Python 3.12.

Usage: npm run serve:web                 → .cache/cli-game/build/web-mobile (CLI build)
       python tools/serve_web.py <dir>   → any build folder, e.g. game/build/web-mobile
Then on the phone: http://<this PC's LAN IP>:8080/?debug=1
"""

import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DEFAULT_DIR = os.path.join(ROOT, '.cache', 'cli-game', 'build', 'web-mobile')
PORT = 8080


class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def main():
    directory = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR)
    if not os.path.isfile(os.path.join(directory, 'index.html')):
        sys.exit(f'serve_web: no index.html in {directory} (build first: npm run build:web)')
    handler = lambda *args, **kwargs: NoStore(*args, directory=directory, **kwargs)
    print(f'serve_web: {directory} on http://0.0.0.0:{PORT}/ (no-store)')
    http.server.ThreadingHTTPServer(('0.0.0.0', PORT), handler).serve_forever()


if __name__ == '__main__':
    main()
