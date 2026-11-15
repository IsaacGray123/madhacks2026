"""USB webcam capture that always hands back the *latest* frame (no stale buffered frames)."""
from __future__ import annotations

import base64
import threading
import time

import cv2

import config as C


class Camera:
    def __init__(self, index: int = C.CAMERA_INDEX):
        self.cap = cv2.VideoCapture(index)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, C.FRAME_WIDTH)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, C.FRAME_HEIGHT)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not self.cap.isOpened():
            raise RuntimeError(f"Could not open camera {index}. Is the USB webcam plugged into the hub? Try --camera 1")
        self.frame = None
        self.lock = threading.Lock()
        self.running = True
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        while self.running:
            ok, frame = self.cap.read()
            if ok:
                with self.lock:
                    self.frame = frame
            else:
                time.sleep(0.05)

    def read(self):
        with self.lock:
            return None if self.frame is None else self.frame.copy()

    def close(self):
        self.running = False
        self.cap.release()


def encode_preview(frame) -> str | None:
    """Downscale a BGR frame and return it as a base64 JPEG for the laptop's live preview."""
    h, w = frame.shape[:2]
    if w > C.PREVIEW_WIDTH:
        frame = cv2.resize(frame, (C.PREVIEW_WIDTH, int(h * C.PREVIEW_WIDTH / w)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, C.PREVIEW_JPEG_QUALITY])
    return base64.b64encode(buf.tobytes()).decode("ascii") if ok else None
