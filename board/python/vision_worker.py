"""Run camera inference in Python 3.12 and send per-frame signals to main.py."""
import argparse
import contextlib
from dataclasses import asdict
import json
import logging
import sys
import time

import config as C


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", type=int, default=C.CAMERA_INDEX)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s vision: %(message)s")
    output = sys.stdout
    # Reserve stdout for JSON. Python library messages go to the App Lab console.
    with contextlib.redirect_stdout(sys.stderr):
        from camera import Camera
        from vision import VisionPipeline

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
                        signals = pipeline.process(frame)
                        print(json.dumps(asdict(signals)), file=output, flush=True)
                    time.sleep(max(0.0, period - (time.monotonic() - started)))
            finally:
                camera.close()
        finally:
            pipeline.close()


if __name__ == "__main__":
    main()
