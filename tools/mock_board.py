"""Stand-in for the UNO Q so the laptop app can be built and demoed without hardware.

    python tools/mock_board.py              # scripted states (no camera needed)
    python tools/mock_board.py --webcam     # real MediaPipe pipeline on this laptop's webcam
    python tools/mock_board.py --fast       # scripted, states change every few seconds

The live camera preview streams real frames with --webcam; in scripted mode it streams a generated
test card (needs `pip install opencv-python`, otherwise no preview).

Then set the laptop app's Settings > Device address to 127.0.0.1:8765.

While it runs, type a command + Enter to force things:
    s = studying/present   p = phone   a = away   e = eating (sends "drank")   z = sleeping
    l = looking away from the screen (present, attention "away" -> laptop counts it as distracted)
    auto = resume script   start | pause | resume | stop | done | dismiss  = simulate TFT taps
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "board", "python"))

import protocol  # noqa: E402
from server import BoardServer  # noqa: E402

SCRIPT = [("present", 45), ("phone", 10), ("present", 35), ("eating", 6), ("present", 25), ("away", 14), ("present", 30), ("sleeping", 8)]
KEYS = {"s": "present", "p": "phone", "a": "away", "e": "eating", "z": "sleeping"}


class Mock:
    def __init__(self, args):
        self.args = args
        self.forced: str | None = None
        self.looking_away = False
        self.state = "present"
        self.reminder: str | None = None
        self.server = BoardServer(args.port, self.on_laptop)
        self.loop: asyncio.AbstractEventLoop | None = None
        self.webcam_result = None
        self.cam = None  # set by webcam_thread; the preview reads its latest frame directly

    async def on_laptop(self, msg):
        t = msg.get("type")
        if t == "reminder":
            self.reminder = msg.get("reminder")
            print(f"  [TFT] REMINDER: {msg.get('title')} — {msg.get('message')}   (type 'done' or 'dismiss')")
        elif t == "reminder_clear":
            self.reminder = None
            print("  [TFT] reminder cleared")
        elif t == "session":
            print(f"  [TFT] session -> {msg.get('status')}")
        elif t == "baseline":
            print("  [TFT] posture baseline captured")
        elif t == "stats" and self.args.verbose:
            print(f"  [TFT] {msg.get('current')} focus={msg.get('focusPct')}% elapsed={msg.get('elapsedMs', 0)//1000}s")

    def scripted_state(self, t: float) -> str:
        scale = 0.25 if self.args.fast else 1.0
        total = sum(d for _, d in SCRIPT) * scale
        pos = t % total
        for st, d in SCRIPT:
            if pos < d * scale:
                return st
            pos -= d * scale
        return "present"

    def stdin_thread(self):
        for line in sys.stdin:
            cmd = line.strip().lower()
            if cmd == "l":
                self.forced, self.looking_away = "present", True
                print("  forced state: present, looking away")
            elif cmd in KEYS:
                self.forced, self.looking_away = KEYS[cmd], False
                print(f"  forced state: {self.forced}")
            elif cmd == "auto":
                self.forced, self.looking_away = None, False
                print("  back to script")
            elif cmd in ("start", "pause", "resume", "stop"):
                self.send(protocol.touch(cmd))
            elif cmd in ("done", "dismiss"):
                self.send(protocol.touch("reminder_done" if cmd == "done" else "reminder_dismiss", self.reminder))
                self.reminder = None

    def send(self, text):
        if self.loop:
            asyncio.run_coroutine_threadsafe(self.server.broadcast(text), self.loop)

    def webcam_thread(self):
        from camera import Camera
        from classifier import ActivityClassifier
        from vision import VisionPipeline

        cam = self.cam = Camera(self.args.camera)
        pipe, clf = VisionPipeline(), ActivityClassifier()
        while True:
            f = cam.read()
            if f is not None:
                self.webcam_result = clf.update(pipe.process(f))
                for e in self.webcam_result.events:
                    self.send(protocol.event(e))
            time.sleep(1 / 3)

    def test_card(self, state: str):
        """Synthetic frame for the scripted mode so the laptop's preview has something to show."""
        try:
            import cv2
            import numpy as np
        except ImportError:
            return None
        img = np.full((240, 320, 3), (60, 52, 46), np.uint8)
        t = time.time()
        if state != "away":
            cx = int(160 + 40 * np.sin(t * 0.8))
            cv2.circle(img, (cx, 110), 46, (180, 200, 220), -1)
            cv2.ellipse(img, (cx, 250), (90, 70), 0, 180, 360, (140, 120, 90), -1)
        cv2.putText(img, f"MOCK  {state}", (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (240, 240, 240), 1, cv2.LINE_AA)
        cv2.putText(img, time.strftime("%H:%M:%S"), (232, 228), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
        return img

    async def preview_loop(self):
        import config as C
        from camera import encode_preview

        while True:
            await asyncio.sleep(1 / C.PREVIEW_FPS)
            if not self.server.preview_wanted:
                continue
            if self.args.webcam:
                f = self.cam.read() if self.cam else None
            else:
                f = self.test_card(self.forced or self.state)
            jpeg = None if f is None else encode_preview(f)
            if jpeg:
                await self.server.send_preview(protocol.frame(jpeg))

    async def run(self):
        self.loop = asyncio.get_running_loop()
        self.server.on_preview = lambda on: print(f"  camera preview {'on' if on else 'off'}")
        await self.server.serve()
        try:
            import cv2  # noqa: F401  (camera.encode_preview needs it)

            asyncio.create_task(self.preview_loop())
        except ImportError:
            print("  (pip install opencv-python to stream a mock camera preview)")
        print(f"Mock UNO Q on ws://127.0.0.1:{self.args.port}  — set Settings > Device to 127.0.0.1:{self.args.port}")
        threading.Thread(target=self.stdin_thread, daemon=True).start()
        if self.args.webcam:
            threading.Thread(target=self.webcam_thread, daemon=True).start()
        t0 = time.time()
        prev = None
        while True:
            await asyncio.sleep(1)
            if self.args.webcam:
                r = self.webcam_result
                if r is None:
                    continue
                state, face, slouch, conf, attention = r.state, r.face, r.slouch, r.conf, r.attention
            else:
                state = self.forced or self.scripted_state(time.time() - t0)
                self.state = state
                face, slouch, conf = state not in ("away",), 0.1, 0.9
                attention = None if not face else "away" if self.looking_away else "screen"
                if state == "eating" and prev != "eating":
                    await self.server.broadcast(protocol.event("drank"))
            if state != prev:
                print(f"camera state: {state}")
                prev = state
            await self.server.broadcast(protocol.vision(state, conf, face, slouch, attention))


def main():
    sys.stdout.reconfigure(line_buffering=True)
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=protocol.DEFAULT_PORT)
    ap.add_argument("--webcam", action="store_true")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--fast", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    asyncio.run(Mock(ap.parse_args()).run())


if __name__ == "__main__":
    main()
