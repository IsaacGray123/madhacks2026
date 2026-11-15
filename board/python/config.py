"""Tunable thresholds. Run `python main.py --debug` and watch the printed signals to tune these."""

# --- camera / performance ---
CAMERA_INDEX = "auto"  # discovers a camera that actually delivers frames; a number/path overrides it
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
TARGET_FPS = 3.0

# --- live preview (sent to the laptop only while its camera preview is open) ---
PREVIEW_FPS = 12.0             # preview runs on its own thread, separate from the AI's TARGET_FPS
PREVIEW_WIDTH = 320            # frames are downscaled to this width before JPEG encoding
PREVIEW_JPEG_QUALITY = 60

# --- classification ---
AWAY_AFTER_S = 5.0             # no face and no body for this long -> away
EYES_CLOSED_THRESHOLD = 0.6    # mean eyeBlink blendshape (used until a baseline is captured)
EYES_CLOSED_MARGIN = 0.35      # after calibration: closed = your normal open-eye level + this
EYES_CLOSED_MIN = 0.5          # ...clamped to this range so glasses / narrow eyes don't read as asleep
EYES_CLOSED_MAX = 0.85
SLEEP_EYES_CLOSED_S = 15.0     # eyes closed this long (while not looking down at notes) -> sleeping
SLEEP_FACE_DOWN_S = 30.0       # body visible but face hidden (head on desk) this long -> sleeping
LOOKING_DOWN_DEG = 20.0        # head pitched down more than this vs. baseline = reading notes, eyes look "closed"
PITCH_SIGN = 1.0               # flip to -1.0 if looking down shows negative pitch in --debug output
NEAR_FACE = 0.22               # normalized distance: object/wrist this close to mouth counts as "at the mouth"
PHONE_NEAR_HAND = 0.12         # expand phone box by this much when testing for a wrist inside it
SWITCH_AFTER_S = 1.5           # a new state must hold this long before the reported state switches
SMOOTHING_WINDOW_S = 3.0       # window for the confidence value (share of recent frames agreeing)
PUBLISH_INTERVAL_S = 0.5       # how often main.py sends vision updates to the laptop
EAT_EVENT_COOLDOWN_S = 60.0    # min gap between drank/ate events

# --- attention (where you're looking) ---
LOOK_AWAY_YAW_DEG = 20.0       # head turned this far from the baseline = looking away from the screen
GAZE_SIDE_THRESHOLD = 0.45     # eyeLookOut/In blendshape: eyes turned to one side
GAZE_DOWN_THRESHOLD = 0.55     # eyeLookDown blendshape: eyes looking down (desk, lap, keyboard)
LOOK_UP_DEG = 12.0             # head tilted up this far from the baseline = looking past/over the screen
GAZE_UP_THRESHOLD = 0.4        # eyeLookUp blendshape: eyes looking up, past the screen
LOOK_AWAY_S = 3.0              # looking away this long -> attention "away" (laptop counts it as distracted)
LOOK_BACK_S = 1.0              # must look back at the screen this long to end "away" (a quick glance doesn't)

# --- hands (MediaPipe HandLandmarker) ---
HAND_ZONE_ABOVE = 0.05         # "raised" hands: wrist no higher than this above the mouth...
HAND_ZONE_BELOW = 0.40         # ...and no lower than this below it (hands on the desk/keyboard are lower)
HANDS_TOGETHER = 0.18          # both wrists within this distance = holding something in front of you
THUMB_MOTION = 0.012           # std-dev of thumb tip (relative to wrist) that counts as thumbs moving
THUMB_WINDOW_S = 3.0
PHONE_POSE_S = 2.5             # looking down + texting hands this long -> phone
NEAR_EAR = 0.10                # hand this close to the side of the face = phone call
PHONE_CALL_S = 2.0
PINCH_DIST = 0.06              # thumb tip to index tip: holding a bite of food
NEAR_MOUTH_FINGERS = 0.08      # pinched fingertips this close to the mouth = a bite
BITES_FOR_EATING = 2           # this many separate bites...
BITE_WINDOW_S = 60.0           # ...within this window -> eating, even if the food isn't detected
EATING_HOLD_S = 15.0           # keep "eating" this long after the last bite

# --- posture ---
SLOUCH_FULL_DROP = 0.35        # fractional drop in (nose height above shoulders / shoulder width) that counts as fully slouched

# --- object classes (COCO, EfficientDet-Lite0) ---
PHONE_CLASSES = {"cell phone"}
DRINK_CLASSES = {"cup", "bottle", "wine glass"}
FOOD_CLASSES = {"banana", "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "bowl"}
OBJECT_SCORE = 0.35
