"""Minimal WebSocket broadcast hub.

The frontend opens a single socket on /ws. When the RAG tutor answers a query it
broadcasts which concept ids were cited, so the 3D Mind Palace can pulse them in
real time.
"""
from __future__ import annotations

import json

from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def endpoint(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        try:
            while True:
                # We don't expect inbound messages, but keep the socket alive.
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            self._connections.discard(websocket)

    async def broadcast(self, event: str, payload: dict) -> None:
        message = json.dumps({"event": event, "payload": payload})
        dead: list[WebSocket] = []
        for ws in self._connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.discard(ws)


manager = ConnectionManager()
