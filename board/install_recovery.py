"""Apply the camera recovery update on the UNO Q host, with rollback backups."""
import argparse
import datetime
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

FILES = ("main.py", "camera.py", "vision_worker.py", "setup_vision.py", "model_assets.py", "vision_requirements.txt")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", default="hackathon")
    parser.add_argument("--archive", type=Path, default=Path.home() / "StudyLens Board Recovery.zip")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.app):
        raise ValueError("Use the app folder name, such as hackathon")
    root = Path.home() / "ArduinoApps" / args.app
    scripts = root / "python"
    if not (root / "app.yaml").is_file() or not (scripts / "config.py").is_file():
        raise FileNotFoundError(f"App not found at {root}")
    with zipfile.ZipFile(args.archive) as archive:
        updates = {name: archive.read("python/" + name) for name in FILES}
    for name, data in updates.items():
        if name.endswith(".py"):
            compile(data, name, "exec")
    config = (scripts / "config.py").read_text(encoding="utf-8")
    config, changed = re.subn(r"(?m)^CAMERA_INDEX\s*=.*$", 'CAMERA_INDEX = "auto"', config)
    if not changed:
        config += '\nCAMERA_INDEX = "auto"\n'
    compile(config, "config.py", "exec")
    updates["config.py"] = config.encode("utf-8")
    backup = root / ("camera-backup-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f"))
    backup.mkdir()
    originals = {name: (scripts / name).read_bytes() if (scripts / name).exists() else None for name in updates}
    for name, data in originals.items():
        if data is not None:
            (backup / name).write_bytes(data)
    app_id = "user:" + args.app
    subprocess.run(["arduino-app-cli", "app", "stop", app_id], check=False)
    try:
        for name, data in updates.items():
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=scripts, delete=False) as output:
                    temporary = Path(output.name)
                    output.write(data)
                    output.flush()
                    os.fsync(output.fileno())
                temporary.replace(scripts / name)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
        subprocess.run(["arduino-app-cli", "properties", "set", "default", app_id], check=True)
        subprocess.run(["arduino-app-cli", "app", "start", app_id], check=True)
    except Exception:
        for name, data in originals.items():
            target = scripts / name
            if data is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(data)
        subprocess.run(["arduino-app-cli", "app", "start", app_id], check=False)
        raise
    print(f"Recovery update installed. Original files saved in {backup}")
    print("The board app starts at boot. Camera setup and retries now run automatically.")


if __name__ == "__main__":
    main()
