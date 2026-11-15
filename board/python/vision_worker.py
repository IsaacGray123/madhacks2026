"""Run camera inference in Python 3.12 and send per-frame signals to main.py."""
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


def control_thread():
    """main.py writes "preview 1" / "preview 0" to stdin when the laptop opens or closes its camera view."""
    for line in sys.stdin:
        cmd = line.split()
        if len(cmd) == 2 and cmd[0] == "preview":
            (preview_on.set if cmd[1] == "1" else preview_on.clear)()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", type=int, default=C.CAMERA_INDEX)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s vision: %(message)s")
    output = sys.stdout
    # Reserve stdout for JSON. Python library messages go to the App Lab console.
    with contextlib.redirect_stdout(sys.stderr):
        from camera import Camera, encode_preview
        from vision import VisionPipeline

        threading.Thread(target=control_thread, daemon=True).start()
        logging.info("Creating AI models")
        pipeline = VisionPipeline()
        try:
            camera = Camera(args.camera)
            try:
                logging.info("vision running at ~%.1f fps", C.TARGET_FPS)
                period = 1.0 / C.TARGET_FPS
                while True:
                    started = time.monotonic()
                    frame = camera.read()
                    if frame is not None:
                        payload = asdict(pipeline.process(frame))
                        if preview_on.is_set():
                            payload["frame"] = encode_preview(frame)
                        print(json.dumps(payload), file=output, flush=True)
                    time.sleep(max(0.0, period - (time.monotonic() - started)))
            finally:
                camera.close()
        finally:
            pipeline.close()


if __name__ == "__main__":
    main()
