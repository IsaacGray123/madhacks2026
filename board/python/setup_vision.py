"""Install the UNO Q camera environment. Run inside the App Lab app container."""
from pathlib import Path
import os
import subprocess


def main():
    python_dir = Path(__file__).resolve().parent
    environment = python_dir.parent / ".cache" / "vision312"
    interpreter = environment / "bin" / "python"
    # Persist the interpreter alongside its venv in App Lab's mounted app cache.
    install_environment = dict(
        os.environ,
        UV_PYTHON_INSTALL_DIR=str(python_dir.parent / ".cache" / "uv-python"),
        UV_PYTHON_PREFERENCE="only-managed",
    )
    if not interpreter.exists():
        subprocess.run(
            ["uv", "venv", "--python", "3.12", str(environment)],
            env=install_environment,
            check=True,
        )
    subprocess.run(
        ["uv", "pip", "install", "--python", str(interpreter), "--link-mode=copy",
         "-r", str(python_dir / "vision_requirements.txt")],
        env=install_environment,
        check=True,
    )
    # Install the tested MediaPipe build with the headless OpenCV replacement above.
    # Resolving MediaPipe's desktop OpenCV dependency would restore the libGL error.
    subprocess.run(
        ["uv", "pip", "install", "--python", str(interpreter), "--link-mode=copy",
         "--no-deps", "mediapipe==0.10.18"],
        env=install_environment,
        check=True,
    )
    subprocess.run(
        [str(interpreter), "-u", "-c",
         "from vision import VisionPipeline; p = VisionPipeline(); p.close(); print('AI models ready')"],
        cwd=python_dir,
        check=True,
    )
    print("Camera environment ready. Stop and Run the App Lab app.", flush=True)


if __name__ == "__main__":
    main()
