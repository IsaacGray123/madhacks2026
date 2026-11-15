"""Install the companion bundle on the UNO Q host, preserving tuning and backups."""
import argparse
import datetime
from pathlib import Path
import re
import subprocess
import zipfile

PYTHON_FILES = ('main.py', 'camera.py', 'vision_worker.py', 'setup_vision.py', 'model_assets.py',
                'vision_requirements.txt', 'requirements.txt', 'vision.py', 'classifier.py',
                'protocol.py', 'display.py', 'server.py')
FILES = tuple('python/' + name for name in PYTHON_FILES) + ('sketch/sketch.ino',)
TUNING = ('TOUCH_ENABLED', 'HEARTBEAT', 'ROTATION', 'SPI_HZ', 'CS_PER_WORD', 'TOUCH_HZ',
          'TFT_CS', 'TFT_DC', 'TFT_RST', 'TOUCH_CS', 'TOUCH_IRQ', 'TOUCH_DEBUG',
          'TS_MINX', 'TS_MAXX', 'TS_MINY', 'TS_MAXY', 'TS_SWAP_XY', 'TS_FLIP_X', 'TS_FLIP_Y', 'TS_PRESSURE')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--app', default='hackathon')
    parser.add_argument('--archive', type=Path, default=Path.home() / 'StudyLens Companion Board.zip')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', args.app):
        raise ValueError('Use the app folder name, such as hackathon')
    root = Path.home() / 'ArduinoApps' / args.app
    if not (root / 'app.yaml').is_file() or not (root / 'python/config.py').is_file():
        raise FileNotFoundError(f'App not found at {root}')
    with zipfile.ZipFile(args.archive) as archive:
        updates = {name: archive.read(name) for name in FILES}
    for name, data in updates.items():
        if name.endswith('.py'):
            compile(data, name, 'exec')
    originals = {name: (root / name).read_bytes() if (root / name).exists() else None for name in updates}
    previous = originals['sketch/sketch.ino']
    if previous:
        old = previous.decode('utf-8')
        new = updates['sketch/sketch.ino'].decode('utf-8')
        for key in TUNING:
            expression = r'(?m)^#define[ \t]+' + key + r'[ \t]+[^\r\n]+'
            match = re.search(expression, old)
            if match:
                new = re.sub(expression, lambda _: match.group(), new)
        updates['sketch/sketch.ino'] = new.encode('utf-8')
    backup = root / ('companion-backup-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
    for name, data in originals.items():
        if data is not None:
            destination = backup / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
    app_id = 'user:' + args.app
    subprocess.run(['arduino-app-cli', 'app', 'stop', app_id], check=False)
    try:
        for name, data in updates.items():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        # App CLI compiles/uploads the changed sketch and starts Python.
        subprocess.run(['arduino-app-cli', 'app', 'start', app_id], check=True)
    except Exception:
        for name, data in originals.items():
            target = root / name
            if data is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(data)
        subprocess.run(['arduino-app-cli', 'app', 'start', app_id], check=False)
        raise
    print(f'Companion installed. Original files saved in {backup}')
    print('Existing config.py, Wi-Fi settings, and touch calibration have been preserved.')

if __name__ == '__main__':
    main()
