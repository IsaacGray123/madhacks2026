"""Exercise deployment and rollback without SSH, hardware, or the Arduino CLI."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('install_companion', Path(__file__).with_name('install_companion.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

class InstallTests(unittest.TestCase):
    def fixture(self, home):
        root = home / 'ArduinoApps/hackathon'
        (root / 'python').mkdir(parents=True)
        (root / 'sketch').mkdir()
        (root / 'app.yaml').write_text('name: StudyLens')
        (root / 'python/config.py').write_text('CAMERA_INDEX = 2')
        (root / 'python/main.py').write_text('old = True')
        (root / 'sketch/sketch.ino').write_text('#define TS_MINX 4454\n#define TS_FLIP_X 1\nvoid setup() {}\n')
        with zipfile.ZipFile(home / 'StudyLens Companion Board.zip', 'w') as archive:
            for name in installer.FILES:
                archive.writestr(name, '#define TS_MINX 100\n#define TS_FLIP_X 0\nvoid setup() {}\n' if name.endswith('.ino') else 'updated = True\n')
        return root
    def test_install_preserves_calibration_config_and_creates_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            root = self.fixture(home)
            with patch.object(installer.Path, 'home', return_value=home), patch('sys.argv', ['install']), patch.object(installer.subprocess, 'run'):
                installer.main()
            self.assertEqual((root / 'python/config.py').read_text(), 'CAMERA_INDEX = 2')
            self.assertIn('#define TS_MINX 4454', (root / 'sketch/sketch.ino').read_text())
            self.assertIn('#define TS_FLIP_X 1', (root / 'sketch/sketch.ino').read_text())
            backup = next(root.glob('companion-backup-*'))
            self.assertEqual((backup / 'python/main.py').read_text(), 'old = True')
    def test_cli_failure_restores_old_files_and_removes_new_files(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            root = self.fixture(home)
            error = subprocess.CalledProcessError(1, 'start')
            with patch.object(installer.Path, 'home', return_value=home), patch('sys.argv', ['install']), patch.object(installer.subprocess, 'run', side_effect=[None, error, None]):
                with self.assertRaises(subprocess.CalledProcessError): installer.main()
            self.assertEqual((root / 'python/main.py').read_text(), 'old = True')
            self.assertFalse((root / 'python/model_assets.py').exists())
    def test_rejects_a_path_as_app_name(self):
        with patch('sys.argv', ['install', '--app', '../other']):
            with self.assertRaises(ValueError): installer.main()

if __name__ == '__main__': unittest.main()
