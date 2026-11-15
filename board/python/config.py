"""Tunable thresholds. Run `python main.py --debug` and watch the printed signals to tune these."""

# --- camera / performance ---
CAMERA_INDEX = 0
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
TARGET_FPS = 3.0

# --- classification ---
AWAY_AFTER_S = 10.0            # no face and no body for this long -> away
EYES_CLOSED_THRESHOLD = 0.6    # mean eyeBlink blendshape
SLEEP_EYES_CLOSED_S = 15.0     # eyes closed this long (while not looking down at notes) -> sleeping
SLEEP_FACE_DOWN_S = 30.0       # body visible but face hidden (head on desk) this long -> sleeping
LOOKING_DOWN_DEG = 20.0        # head pitched down more than this vs. baseline = reading notes, eyes look "closed"
PITCH_SIGN = 1.0               # flip to -1.0 if looking down shows negative pitch in --debug output
NEAR_FACE = 0.22               # normalized distance: object/wrist this close to mouth counts as "at the mouth"
PHONE_NEAR_HAND = 0.12         # expand phone box by this much when testing for a wrist inside it
SMOOTHING_WINDOW_S = 6.0       # majority vote window
EAT_EVENT_COOLDOWN_S = 60.0    # min gap between drank/ate events

# --- posture ---
SLOUCH_FULL_DROP = 0.35        # fractional drop in (nose height above shoulders / shoulder width) that counts as fully slouched

# --- object classes (COCO, EfficientDet-Lite0) ---
PHONE_CLASSES = {"cell phone"}
DRINK_CLASSES = {"cup", "bottle", "wine glass"}
FOOD_CLASSES = {"banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "bowl"}
OBJECT_SCORE = 0.35
