"""Install the UNO Q camera environment. Run inside the App Lab app container."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

from model_assets import ensure_models


def ensure_environment():
    python_dir = Path(__file__).resolve().parent
    environment = python_dir.parent / ".cache" / "vision312"
    interpreter = environment / "bin" / "python"
    recipe = hashlib.sha256((python_dir / "vision_requirements.txt").read_bytes() + b"python3.12-mediapipe0.10.18-v1").hexdigest()
    marker = environment / "studylens-ready.json"
    repair = False
    if interpreter.exists() and marker.exists():
        try:
            if json.loads(marker.read_text()).get("recipe") == recipe:
                subprocess.run([str(interpreter), "-c", "import cv2, mediapipe; assert mediapipe.__version__ == '0.10.18'"],
                               check=True, timeout=30, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                return interpreter
        except (OSError, ValueError, subprocess.SubprocessError):
            repair = True
    # Persist the interpreter alongside its venv in App Lab's mounted app cache.
    install_environment = dict(
        os.environ,
        UV_PYTHON_INSTALL_DIR=str(python_dir.parent / ".cache" / "uv-python"),
        UV_PYTHON_PREFERENCE="only-managed",
    )
    if not interpreter.exists():
        subprocess.run(
            ["uv", "venv", "--python", "3.12", "--allow-existing", str(environment)],
            env=install_environment,
            check=True,
            timeout=300,
        )
    subprocess.run(
        ["uv", "pip", "install", "--python", str(interpreter), "--link-mode=copy",
         *(["--reinstall"] if repair else []), "-r", str(python_dir / "vision_requirements.txt")],
        env=install_environment,
        check=True,
        timeout=600,
    )
    # Install the tested MediaPipe build with the headless OpenCV replacement above.
    # Resolving MediaPipe's desktop OpenCV dependency would restore the libGL error.
    subprocess.run(
        ["uv", "pip", "install", "--python", str(interpreter), "--link-mode=copy",
         "--no-deps", *(["--reinstall"] if repair else []), "mediapipe==0.10.18"],
        env=install_environment,
        check=True,
        timeout=600,
    )
    subprocess.run([str(interpreter), "-c", "import cv2, mediapipe; assert mediapipe.__version__ == '0.10.18'"], check=True, timeout=30)
    temporary = marker.with_suffix(".tmp")
    temporary.write_text(json.dumps({"recipe": recipe}))
    temporary.replace(marker)
    return interpreter


def main():
    python_dir = Path(__file__).resolve().parent
    interpreter = ensure_environment()
    ensure_models()
    subprocess.run(
        [str(interpreter), "-u", "-c",
         "from vision import VisionPipeline; p = VisionPipeline(); p.close(); print('AI models ready')"],
        cwd=python_dir,
        check=True,
    )
    print("Camera environment ready. Stop and Run the App Lab app.", flush=True)


if __name__ == "__main__":
    main()
