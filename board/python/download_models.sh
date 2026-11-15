#!/usr/bin/env sh
# Downloads the pretrained MediaPipe models into ./models (run once on the UNO Q).
set -e
cd "$(dirname "$0")"
mkdir -p models
B=https://storage.googleapis.com/mediapipe-models
curl -fL -o models/face_landmarker.task      $B/face_landmarker/face_landmarker/float16/1/face_landmarker.task
curl -fL -o models/pose_landmarker_lite.task $B/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
curl -fL -o models/efficientdet_lite0.tflite $B/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite
curl -fL -o models/hand_landmarker.task      $B/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
ls -la models
