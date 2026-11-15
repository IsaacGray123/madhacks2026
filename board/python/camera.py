"""USB webcam capture that always hands back the *latest* frame (no stale buffered frames)."""
from __future__ import annotations

import base64
import logging
from pathlib import Path
import threading
import time

import cv2

import config as C


def camera_sources(index):
    if str(index) != "auto":
        return [int(index) if str(index).isdigit() else index]
    stable = sorted(Path("/dev/v4l/by-id").glob("*"))
    devices = sorted(Path("/dev").glob("video[0-9]*"), key=lambda path: int(path.name[5:]))
    sources, seen = [], set()
    for path in stable + devices:
        resolved = str(path.resolve())
        if resolved not in seen:
            sources.append(str(path))
            seen.add(resolved)
    return sources or list(range(4))


class Camera:
    def __init__(self, index=C.CAMERA_INDEX):
        self.cap = None
        for source in camera_sources(index):
            candidate = cv2.VideoCapture(source)
            try:
                if not candidate.isOpened():
                    continue
                candidate.set(cv2.CAP_PROP_FRAME_WIDTH, C.FRAME_WIDTH)
                candidate.set(cv2.CAP_PROP_FRAME_HEIGHT, C.FRAME_HEIGHT)
                ok, frame = candidate.read()
                if not ok or frame is None:
                    continue
                self.cap, self.frame, self.source = candidate, frame, source
                logging.info("Using camera %s", source)
                break
            finally:
                if self.cap is not candidate:
                    candidate.release()
        if self.cap is None:
            raise RuntimeError("No camera delivered frames. Check the powered USB hub; automatic retry will continue.")
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.last_frame_at = time.monotonic()
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def _loop(self):
        try:
            while not self.stop.is_set():
                ok, frame = self.cap.read()
                if ok and frame is not None:
                    with self.lock:
                        self.frame = frame
                        self.last_frame_at = time.monotonic()
                else:
                    self.stop.wait(0.05)
        finally:
            self.cap.release()

    def read(self):
        with self.lock:
            if time.monotonic() - self.last_frame_at > 5:
                raise RuntimeError(f"Camera {self.source} stopped delivering frames; restarting capture.")
            return None if self.frame is None else self.frame.copy()

    def close(self):
        self.stop.set()
        self.thread.join(timeout=2)
        if self.thread.is_alive():
            logging.warning("Camera read is blocked; the supervisor will terminate the worker.")


def encode_preview(frame) -> str | None:
    """Downscale a BGR frame and return it as a base64 JPEG for the laptop's live preview."""
    h, w = frame.shape[:2]
    if w > C.PREVIEW_WIDTH:
        frame = cv2.resize(frame, (C.PREVIEW_WIDTH, int(h * C.PREVIEW_WIDTH / w)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, C.PREVIEW_JPEG_QUALITY])
    return base64.b64encode(buf.tobytes()).decode("ascii") if ok else None
