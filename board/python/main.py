"""StudyLens board app: camera -> MediaPipe -> classifier -> WebSocket (laptop) + TFT.

Run on the UNO Q (Linux side):
    python main.py                 # normal
    python main.py --debug         # print signals every second to tune config.py
    python main.py --camera 1      # pick another /dev/video index
"""
from __future__ import annotations

import argparse
import atexit
import asyncio
import json
import logging
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading

import config as C
import protocol
from classifier import ActivityClassifier, Signals
from display import HAVE_BRIDGE, Display
from server import BoardServer

log = logging.getLogger("main")


def local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


class BoardApp:
    def __init__(self, args):
        self.args = args
        self.loop: asyncio.AbstractEventLoop | None = None
        self.classifier = ActivityClassifier()
        self.result = None
        self.pending_events: list[str] = []
        self.status = "idle"
        self.reminder_active: str | None = None
        self.server = BoardServer(args.port, self.on_laptop)
        self.display = Display(self.on_touch)
        self.ip = local_ip()
        self.lock = threading.Lock()

    # ---------- vision thread ----------
    def vision_thread(self):
        python_dir = Path(__file__).resolve().parent
        default_python = python_dir.parent / ".cache/vision312/bin/python" if HAVE_BRIDGE else sys.executable
        vision_python = os.environ.get("STUDYLENS_VISION_PYTHON", str(default_python))
        try:
            with subprocess.Popen(
                [vision_python, "-u", str(python_dir / "vision_worker.py"), "--camera", str(self.args.camera)],
                stdout=subprocess.PIPE,
                text=True,
            ) as worker:
                atexit.register(worker.terminate)
                try:
                    for line in worker.stdout:
                        try:
                            payload = json.loads(line)
                        except json.JSONDecodeError:
                            log.warning("vision output: %s", line.rstrip())
                            continue
                        sig = Signals(**payload)
                        res = self.classifier.update(sig)
                        with self.lock:
                            self.result = res
                            self.pending_events += res.events
                        if self.args.debug:
                            log.info(
                                "raw=%-8s state=%-8s face=%d pose=%d eyes=%.2f pitch=%+.0f phone=%s drink=%s food=%s slouch=%s",
                                res.raw, res.state, sig.face, sig.pose, sig.eyes_closed, sig.head_pitch,
                                bool(sig.phone), bool(sig.drink), bool(sig.food),
                                None if res.slouch is None else round(res.slouch, 2),
                            )
                    raise RuntimeError(f"Vision worker exited with code {worker.wait()}")
                finally:
                    worker.terminate()
                    try:
                        worker.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        worker.kill()
                        worker.wait()
                    atexit.unregister(worker.terminate)
        except Exception:
            log.exception("Camera inference stopped. On UNO Q, run python/setup_vision.py in the app container.")
            with self.lock:
                self.result = None
            self.display.setup(False, "Camera unavailable - see App Lab console", f"{self.ip}:{self.args.port}")

    # ---------- laptop -> board ----------
    async def on_laptop(self, msg: dict):
        t = msg.get("type")
        if t == "session":
            self.status = msg.get("status", "idle")
            if self.status == "idle":
                self.reminder_active = None
                self.display.last = ""  # force a redraw of the setup screen
        elif t == "stats":
            self.status = msg.get("status", self.status)
            if not self.reminder_active:
                self.display.stats(msg)
        elif t == "reminder":
            self.reminder_active = msg.get("reminder")
            self.display.reminder(msg.get("reminder", ""), msg.get("title", ""), msg.get("message", ""))
        elif t == "reminder_clear":
            self.reminder_active = None
            self.display.clear_reminder()
        elif t == "baseline":
            self.classifier.capture_baseline()
            log.info("posture baseline captured")

    # ---------- TFT -> laptop ----------
    def on_touch(self, action: str):
        """Called from the Bridge thread."""
        if action in ("done", "dismiss"):
            text = protocol.touch("reminder_done" if action == "done" else "reminder_dismiss", self.reminder_active)
            self.reminder_active = None
        elif action in ("start", "pause", "resume", "stop"):
            text = protocol.touch(action)
        else:
            return
        if self.loop:
            asyncio.run_coroutine_threadsafe(self.server.broadcast(text), self.loop)

    # ---------- 1 Hz publish ----------
    async def publish_loop(self):
        while True:
            await asyncio.sleep(1.0)
            with self.lock:
                res, events, self.pending_events = self.result, self.pending_events, []
            if res is None:
                continue
            await self.server.broadcast(protocol.vision(res.state, res.conf, res.face, res.slouch))
            for e in events:
                await self.server.broadcast(protocol.event(e))
            if self.status == "idle":
                hint = "Face detected - you're in frame" if res.face else "Move into view of the camera"
                if not self.server.clients:
                    hint = "Waiting for laptop..." if res.face else hint
                self.display.setup(res.face, hint, f"{self.ip}:{self.args.port}")

    async def run(self):
        self.loop = asyncio.get_running_loop()
        await self.server.serve()
        log.info("WebSocket server on ws://%s:%d  (enter %s:%d in the laptop app's Settings > Device)",
                 self.ip, self.args.port, self.ip, self.args.port)
        self.display.setup(False, "Starting camera...", f"{self.ip}:{self.args.port}")
        threading.Thread(target=self.vision_thread, daemon=True).start()
        await self.publish_loop()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=protocol.DEFAULT_PORT)
    ap.add_argument("--camera", type=int, default=C.CAMERA_INDEX)
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s")

    app = BoardApp(args)
    if HAVE_BRIDGE:
        # In Arduino App Lab, App.run() owns the main thread; run our asyncio loop beside it.
        from arduino.app_utils import App  # type: ignore

        threading.Thread(target=lambda: asyncio.run(app.run()), daemon=True).start()
        App.run()
    else:
        asyncio.run(app.run())


if __name__ == "__main__":
    main()
