"""WebSocket server the laptop app connects to (port 8765)."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Awaitable, Callable

import websockets

import protocol

log = logging.getLogger("server")


class BoardServer:
    def __init__(self, port: int, on_message: Callable[[dict], Awaitable[None] | None]):
        self.port = port
        self.on_message = on_message
        self.clients: set = set()

    async def _handler(self, ws, *_):  # (ws) on websockets>=13, (ws, path) on older versions
        self.clients.add(ws)
        log.info("laptop connected (%d client(s))", len(self.clients))
        try:
            await ws.send(protocol.hello())
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except ValueError:
                    continue
                res = self.on_message(msg)
                if asyncio.iscoroutine(res):
                    await res
        except websockets.ConnectionClosed:
            pass
        finally:
            self.clients.discard(ws)
            log.info("laptop disconnected")

    async def broadcast(self, text: str) -> None:
        for ws in list(self.clients):
            try:
                await ws.send(text)
            except websockets.ConnectionClosed:
                self.clients.discard(ws)

    async def serve(self):
        return await websockets.serve(self._handler, "0.0.0.0", self.port, ping_interval=10, ping_timeout=10)
