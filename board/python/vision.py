"""MediaPipe Tasks pipeline: turns a BGR frame into classifier.Signals.

Models (download with ./download_models.sh):
  models/face_landmarker.task      FaceLandmarker  -> eyes (blendshapes), head pitch, mouth
  models/pose_landmarker_lite.task PoseLandmarker  -> presence, shoulders, wrists, nose
  models/efficientdet_lite0.tflite ObjectDetector  -> cell phone / cup / bottle / food (COCO)
  models/hand_landmarker.task      HandLandmarker  -> texting / phone-call / bite gestures (optional)

Face runs every frame (eyes, gaze, head pitch/yaw). The other models take turns on a 4-frame cycle
(hands, pose, hands, objects) and their results carry over, keeping ~3 fps on the UNO Q's Cortex-A53 cores.
"""
from __future__ import annotations

import logging
import math
import os
import time

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision as mp_vision

import config as C
from classifier import Signals

MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")

# Face mesh indices
UPPER_LIP, LOWER_LIP = 13, 14
FACE_LEFT_EDGE, FACE_RIGHT_EDGE = 234, 454  # cheek edges beside the ears
# Hand indices
H_WRIST, H_THUMB_TIP, H_INDEX_TIP = 0, 4, 8
HAND_INPUT_WIDTH = 320  # hands run on a downscaled frame; landmarks are normalized so nothing else changes
# Pose indices
P_NOSE, P_L_SHOULDER, P_R_SHOULDER, P_L_WRIST, P_R_WRIST = 0, 11, 12, 15, 16


def _model(name: str) -> mp_tasks.BaseOptions:
    path = os.path.join(MODELS, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing {path}. Run ./download_models.sh first.")
    return mp_tasks.BaseOptions(model_asset_path=path)


def _pitch_from_matrix(m) -> float:
    """Head pitch in degrees from MediaPipe's facial transformation matrix (sign tuned via config.PITCH_SIGN)."""
    r21, r22 = float(m[2][1]), float(m[2][2])
    return C.PITCH_SIGN * math.degrees(math.atan2(r21, r22))


def _yaw_from_matrix(m) -> float:
    """Head yaw (left/right turn) in degrees from the same matrix. Only compared to the baseline, so sign is irrelevant."""
    r20, r21, r22 = float(m[2][0]), float(m[2][1]), float(m[2][2])
    return math.degrees(math.atan2(-r20, math.hypot(r21, r22)))


class VisionPipeline:
    def __init__(self) -> None:
        self.face = mp_vision.FaceLandmarker.create_from_options(
            mp_vision.FaceLandmarkerOptions(
                base_options=_model("face_landmarker.task"),
                num_faces=1,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=True,
            )
        )
        self.pose = mp_vision.PoseLandmarker.create_from_options(
            mp_vision.PoseLandmarkerOptions(base_options=_model("pose_landmarker_lite.task"), num_poses=1)
        )
        self.objects = mp_vision.ObjectDetector.create_from_options(
            mp_vision.ObjectDetectorOptions(
                base_options=_model("efficientdet_lite0.tflite"), score_threshold=C.OBJECT_SCORE, max_results=6
            )
        )
        hand_path = os.path.join(MODELS, "hand_landmarker.task")
        if os.path.exists(hand_path):
            self.hands = mp_vision.HandLandmarker.create_from_options(
                mp_vision.HandLandmarkerOptions(base_options=_model("hand_landmarker.task"), num_hands=2)
            )
        else:
            self.hands = None
            logging.warning("No %s - hand gestures disabled. Run ./download_models.sh to enable them.", hand_path)
        self.frame_no = 0
        self.last_hands: list = []
        self.last_pose: dict = {}
        self.last_objects: dict = {}
        self.last_debug: dict = {}

    def process(self, bgr) -> Signals:
        self.frame_no += 1
        h, w = bgr.shape[:2]
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        s = Signals(ts=time.time())

        # --- face (every frame) ---
        fr = self.face.detect(image)
        if fr.face_landmarks:
            lm = fr.face_landmarks[0]
            s.face = True
            s.mouth = ((lm[UPPER_LIP].x + lm[LOWER_LIP].x) / 2, (lm[UPPER_LIP].y + lm[LOWER_LIP].y) / 2)
            s.ears = [(lm[i].x, lm[i].y) for i in (FACE_LEFT_EDGE, FACE_RIGHT_EDGE)]
            if fr.face_blendshapes:
                bs = {c.category_name: c.score for c in fr.face_blendshapes[0]}
                g = lambda k: bs.get(k, 0.0)  # noqa: E731
                s.eyes_closed = (g("eyeBlinkLeft") + g("eyeBlinkRight")) / 2
                s.gaze_down = (g("eyeLookDownLeft") + g("eyeLookDownRight")) / 2
                s.gaze_up = (g("eyeLookUpLeft") + g("eyeLookUpRight")) / 2
                # Looking to one side turns one eye "out" and the other "in".
                s.gaze_side = max(
                    (g("eyeLookOutLeft") + g("eyeLookInRight")) / 2,
                    (g("eyeLookOutRight") + g("eyeLookInLeft")) / 2,
                )
            if fr.facial_transformation_matrixes:
                s.head_pitch = _pitch_from_matrix(fr.facial_transformation_matrixes[0])
                s.head_yaw = _yaw_from_matrix(fr.facial_transformation_matrixes[0])

        # --- hands / pose / objects take turns (results carried over) ---
        slot = self.frame_no % 4
        if self.hands is None and slot in (0, 2):
            slot = 1 if slot == 0 else 3  # no hand model: back to alternating pose and objects
        if slot in (0, 2):
            small = cv2.resize(rgb, (HAND_INPUT_WIDTH, int(h * HAND_INPUT_WIDTH / w)), interpolation=cv2.INTER_AREA)
            hr = self.hands.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=small))
            self.last_hands = [
                [(hl[i].x, hl[i].y) for i in (H_WRIST, H_THUMB_TIP, H_INDEX_TIP)] for hl in (hr.hand_landmarks or [])
            ]
        elif slot == 1:
            pr = self.pose.detect(image)
            if pr.pose_landmarks:
                p = pr.pose_landmarks[0]
                vis = lambda i: getattr(p[i], "visibility", 1.0) or 0.0  # noqa: E731
                self.last_pose = {
                    "nose": (p[P_NOSE].x, p[P_NOSE].y),
                    "shoulders": ((p[P_L_SHOULDER].x, p[P_L_SHOULDER].y), (p[P_R_SHOULDER].x, p[P_R_SHOULDER].y))
                    if vis(P_L_SHOULDER) > 0.5 and vis(P_R_SHOULDER) > 0.5 else None,
                    "wrists": [(p[i].x, p[i].y) for i in (P_L_WRIST, P_R_WRIST) if vis(i) > 0.4],
                }
            else:
                self.last_pose = {}
        else:
            dr = self.objects.detect(image)
            found: dict = {}
            for d in dr.detections:
                name = d.categories[0].category_name
                bb = d.bounding_box
                box = (bb.origin_x / w, bb.origin_y / h, (bb.origin_x + bb.width) / w, (bb.origin_y + bb.height) / h)
                for key, classes in (("phone", C.PHONE_CLASSES), ("drink", C.DRINK_CLASSES), ("food", C.FOOD_CLASSES)):
                    if name in classes and key not in found:
                        found[key] = box
            self.last_objects = found

        if self.last_pose:
            s.pose = True
            s.nose = self.last_pose["nose"]
            s.shoulders = self.last_pose["shoulders"]
            s.wrists = self.last_pose["wrists"]
        s.hands = self.last_hands
        s.phone = self.last_objects.get("phone")
        s.drink = self.last_objects.get("drink")
        s.food = self.last_objects.get("food")
        return s

    def close(self) -> None:
        self.face.close()
        self.pose.close()
        self.objects.close()
        if self.hands:
            self.hands.close()
