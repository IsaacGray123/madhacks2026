"""Run camera inference in Python 3.12 and send per-frame signals to main.py.

stdout carries one JSON object per line:
  {...Signals...}           AI results, ~TARGET_FPS
  {"preview": "<base64>"}   camera preview frame, ~PREVIEW_FPS, only while main.py has turned preview on
"""
import argparse
import contextlib
from dataclasses import asdict
import json
import logging
import sys
import threading
import time

import config as C


preview_on = threading.Event()
out_lock = threading.Lock()  # the AI loop and the preview thread share stdout


def emit(output, obj) -> None:
    line = json.dumps(obj)
    with out_lock:
        print(line, file=output, flush=True)


def preview_thread(camera, output, encode_preview, stopped):
    """Streams the camera's latest frame at PREVIEW_FPS, independent of the slower AI loop."""
    period = 1.0 / C.PREVIEW_FPS
    while not stopped.is_set():
        started = time.monotonic()
        if preview_on.is_set():
            try:
                frame = camera.read()
            except RuntimeError:
                return  # the inference loop reports the capture failure to the supervisor
            jpeg = None if frame is None else encode_preview(frame)
            if jpeg:
                emit(output, {"preview": jpeg})
            stopped.wait(max(0.0, period - (time.monotonic() - started)))
        else:
            stopped.wait(0.2)


def control_thread():
    """main.py writes "preview 1" / "preview 0" to stdin when the laptop opens or closes its camera view."""
    for line in sys.stdin:
        cmd = line.split()
        if len(cmd) == 2 and cmd[0] == "preview":
            (preview_on.set if cmd[1] == "1" else preview_on.clear)()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", default=C.CAMERA_INDEX)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s vision: %(message)s")
    output = sys.stdout
    # Reserve stdout for JSON. Python library messages go to the App Lab console.
    with contextlib.redirect_stdout(sys.stderr):
        from camera import Camera, encode_preview
        from vision import VisionPipeline

        threading.Thread(target=control_thread, daemon=True).start()
        # Open the camera first so the laptop's preview works while the AI models are still loading.
        camera = Camera(args.camera)
        stopped = threading.Event()
        preview = threading.Thread(target=preview_thread, args=(camera, output, encode_preview, stopped), daemon=True)
        try:
            preview.start()
            logging.info("Creating AI models")
            pipeline = VisionPipeline()
            try:
                logging.info("vision running at ~%.1f fps, preview up to %.0f fps", C.TARGET_FPS, C.PREVIEW_FPS)
                period = 1.0 / C.TARGET_FPS
                while True:
                    started = time.monotonic()
                    frame = camera.read()
                    if frame is not None:
                        emit(output, asdict(pipeline.process(frame)))
                    time.sleep(max(0.0, period - (time.monotonic() - started)))
            finally:
                pipeline.close()
        finally:
            stopped.set()
            preview.join(timeout=2)
            camera.close()


if __name__ == "__main__":
    main()
