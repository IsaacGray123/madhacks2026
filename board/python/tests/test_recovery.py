"""Recovery checks with fake capture devices and downloads; no camera or AI install required."""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import types
import unittest
from unittest.mock import Mock, patch

PYTHON_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_DIR))
import model_assets
import setup_vision


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, PYTHON_DIR / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RecoveryTests(unittest.TestCase):
    def test_download_is_verified_and_reused_offline(self):
        data = b"verified model fixture"
        manifest = {"test.task": ("test/", hashlib.sha256(data).hexdigest())}
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(model_assets, "MODELS", manifest), patch.object(model_assets, "urlopen", return_value=io.BytesIO(data)) as download:
                model_assets.ensure_models(directory)
                model_assets.ensure_models(directory)
                self.assertEqual(download.call_count, 1)
                self.assertEqual((Path(directory) / "test.task").read_bytes(), data)

    def test_bad_download_preserves_existing_model_and_removes_partial(self):
        manifest = {"test.task": ("test/", hashlib.sha256(b"expected").hexdigest())}
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "test.task"
            target.write_bytes(b"old model")
            with patch.object(model_assets, "MODELS", manifest), patch.object(model_assets, "urlopen", return_value=io.BytesIO(b"wrong")):
                with self.assertRaisesRegex(RuntimeError, "verification"):
                    model_assets.ensure_models(directory)
            self.assertEqual(target.read_bytes(), b"old model")
            self.assertEqual(list(Path(directory).glob("*.part")), [])

    def test_camera_finds_frames_and_releases_failed_devices(self):
        frame = Mock()
        first, metadata, working = Mock(), Mock(), Mock()
        first.isOpened.return_value = False
        metadata.isOpened.return_value = True
        metadata.read.return_value = (False, None)
        working.isOpened.return_value = True

        def read():
            time.sleep(0.001)
            return True, frame

        working.read.side_effect = read
        fake = types.SimpleNamespace(VideoCapture=Mock(side_effect=[first, metadata, working]),
                                     CAP_PROP_FRAME_WIDTH=3, CAP_PROP_FRAME_HEIGHT=4)
        with patch.dict(sys.modules, {"cv2": fake}):
            camera = load_module("recovery_camera", "camera.py")
        with patch.object(camera, "camera_sources", return_value=[0, 1, 2]):
            capture = camera.Camera()
            self.assertEqual(capture.source, 2)
            capture.read()
            capture.close()
        first.release.assert_called_once()
        metadata.release.assert_called_once()
        working.release.assert_called_once()
        self.assertFalse(capture.thread.is_alive())

    def test_camera_rejects_stale_frames(self):
        with patch.dict(sys.modules, {"cv2": Mock()}):
            module = load_module("recovery_camera_stale", "camera.py")
        camera = module.Camera.__new__(module.Camera)
        camera.lock = threading.Lock()
        camera.last_frame_at = time.monotonic() - 6
        camera.source = "/dev/video2"
        with self.assertRaisesRegex(RuntimeError, "stopped delivering"):
            camera.read()

    def test_camera_keeps_explicit_indices_and_paths(self):
        with patch.dict(sys.modules, {"cv2": Mock()}):
            module = load_module("recovery_camera_explicit", "camera.py")
        self.assertEqual(module.camera_sources("2"), [2])
        self.assertEqual(module.camera_sources("/dev/v4l/by-id/my-camera"), ["/dev/v4l/by-id/my-camera"])

    def test_no_camera_is_a_retryable_error(self):
        candidate = Mock()
        candidate.isOpened.return_value = False
        fake = Mock()
        fake.VideoCapture.return_value = candidate
        with patch.dict(sys.modules, {"cv2": fake}):
            module = load_module("recovery_camera_missing", "camera.py")
        with patch.object(module, "camera_sources", return_value=[0]):
            with self.assertRaisesRegex(RuntimeError, "automatic retry"):
                module.Camera()
        candidate.release.assert_called_once()

    def test_ready_environment_is_checked_and_reused_without_installing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "python"
            scripts.mkdir()
            requirements = b"numpy==1.26.4\n"
            (scripts / "vision_requirements.txt").write_bytes(requirements)
            environment = root / ".cache" / "vision312"
            (environment / "bin").mkdir(parents=True)
            interpreter = environment / "bin" / "python"
            interpreter.touch()
            recipe = hashlib.sha256(requirements + b"python3.12-mediapipe0.10.18-v1").hexdigest()
            (environment / "studylens-ready.json").write_text(json.dumps({"recipe": recipe}))
            with patch.object(setup_vision, "__file__", str(scripts / "setup_vision.py")), patch.object(setup_vision.subprocess, "run") as command:
                self.assertEqual(setup_vision.ensure_environment(), interpreter)
                self.assertEqual(command.call_count, 1)
                self.assertEqual(command.call_args.args[0][0], str(interpreter))

    def test_supervisor_retries_and_keeps_calibration(self):
        server = types.ModuleType("server")
        server.BoardServer = Mock()
        with patch.dict(sys.modules, {"server": server}):
            module = load_module("recovery_main", "main.py")
        app = module.BoardApp.__new__(module.BoardApp)
        app.stopping = Mock()
        app.stopping.is_set.side_effect = [False, False, True]
        app.stopping.wait.return_value = False
        app.status = "idle"
        app.display = Mock()
        app.ip = "127.0.0.1"
        app.args = types.SimpleNamespace(port=8765)
        app.lock = threading.Lock()
        app.classifier = module.ActivityClassifier()
        app.classifier.baseline_yaw = 17
        app.result = object()
        app._vision_attempt = Mock(side_effect=[RuntimeError("camera unplugged"), None])
        with patch.object(module, "HAVE_BRIDGE", True), patch.dict(os.environ, {"STUDYLENS_VISION_PYTHON": ""}), patch.object(model_assets, "ensure_models") as assets, patch.object(setup_vision, "ensure_environment") as environment:
            app.vision_thread()
        self.assertEqual(app._vision_attempt.call_count, 2)
        self.assertEqual(assets.call_count, 2)
        self.assertEqual(environment.call_count, 2)
        self.assertIsNone(app.result)
        self.assertEqual(app.classifier.baseline_yaw, 17)


if __name__ == "__main__":
    unittest.main()
