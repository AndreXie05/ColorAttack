#!/usr/bin/env python3
"""Servidor local de desenvolvimento: igual ao http.server, mas sem cache,
para o browser nunca usar versões antigas dos módulos JS."""
import http.server, sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    http.server.ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
