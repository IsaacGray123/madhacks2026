"""Download and verify the pinned camera models using the Python standard library."""
import hashlib
import logging
import os
from pathlib import Path
import tempfile
from urllib.request import urlopen

MODELS = {
    "face_landmarker.task": ("face_landmarker/face_landmarker/float16/1/", "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff"),
    "pose_landmarker_lite.task": ("pose_landmarker/pose_landmarker_lite/float16/1/", "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"),
    "efficientdet_lite0.tflite": ("object_detector/efficientdet_lite0/int8/1/", "0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb"),
    "hand_landmarker.task": ("hand_landmarker/hand_landmarker/float16/1/", "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1"),
}


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def ensure_models(folder=None):
    folder = Path(folder) if folder is not None else Path(__file__).resolve().parent / "models"
    folder.mkdir(parents=True, exist_ok=True)
    for name, (location, expected) in MODELS.items():
        target = folder / name
        if target.is_file() and digest(target) == expected:
            continue
        logging.info("Restoring camera model %s", name)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=folder, suffix=".part", delete=False) as output:
                temporary = Path(output.name)
                with urlopen("https://storage.googleapis.com/mediapipe-models/" + location + name, timeout=30) as response:
                    for block in iter(lambda: response.read(1024 * 1024), b""):
                        output.write(block)
                output.flush()
                os.fsync(output.fileno())
            if digest(temporary) != expected:
                raise RuntimeError(f"Downloaded model failed verification: {name}")
            temporary.replace(target)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ensure_models()
    print("Camera models ready.")
