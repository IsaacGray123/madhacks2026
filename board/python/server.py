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
    def __init__(
        self,
        port: int,
        on_message: Callable[[dict], Awaitable[None] | None],
        on_preview: Callable[[bool], None] | None = None,
    ):
        self.port = port
        self.on_message = on_message
        self.on_preview = on_preview
        self.clients: set = set()
        # Clients that asked for the live camera preview. Video goes only to these.
        self.preview_clients: set = set()

    @property
    def preview_wanted(self) -> bool:
        return bool(self.preview_clients)

    def _set_preview(self, ws, on: bool) -> None:
        before = self.preview_wanted
        (self.preview_clients.add if on else self.preview_clients.discard)(ws)
        if self.on_preview and before != self.preview_wanted:
            self.on_preview(self.preview_wanted)

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
                if isinstance(msg, dict) and msg.get("type") == "preview":
                    self._set_preview(ws, bool(msg.get("on")))
                    continue
                res = self.on_message(msg)
                if asyncio.iscoroutine(res):
                    await res
        except websockets.ConnectionClosed:
            pass
        finally:
            self.clients.discard(ws)
            self._set_preview(ws, False)
            log.info("laptop disconnected")

    async def broadcast(self, text: str) -> None:
        for ws in list(self.clients):
            try:
                await ws.send(text)
            except websockets.ConnectionClosed:
                self.clients.discard(ws)

    async def send_preview(self, text: str) -> None:
        for ws in list(self.preview_clients):
            try:
                await ws.send(text)
            except websockets.ConnectionClosed:
                self._set_preview(ws, False)

    async def serve(self):
        return await websockets.serve(self._handler, "0.0.0.0", self.port, ping_interval=10, ping_timeout=10)
