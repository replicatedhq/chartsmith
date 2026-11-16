#!/usr/bin/env python3
"""Expose the local IPv6 dev tunnel to IPv4-only clients for one command."""
import select
import socket
import socketserver
import subprocess
import sys
import threading


class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        with socket.create_connection(("::1", 8000), timeout=10) as upstream:
            sockets = (self.request, upstream)
            while True:
                readable, _, _ = select.select(sockets, [], [])
                for source in readable:
                    data = source.recv(65536)
                    if not data:
                        return
                    target = upstream if source is self.request else self.request
                    target.sendall(data)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: with-local-api.py COMMAND [ARG ...]")
    try:
        server = Server(("127.0.0.1", 8000), Relay)
    except OSError as error:
        raise SystemExit(f"Cannot start local API relay: {error}")
    with server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            return subprocess.call(sys.argv[1:])
        finally:
            server.shutdown()


if __name__ == "__main__":
    sys.exit(main())
