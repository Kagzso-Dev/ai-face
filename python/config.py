# config.py
# ---------------------------------------------------------------------------
# Central configuration for FaceAttend AI.
# All tunable constants live here so they can be changed without hunting
# through multiple source files.
# ---------------------------------------------------------------------------

# ── Eye Aspect Ratio (EAR) / Blink detection ────────────────────────────────
# EAR drops below this value when the eye is considered "closed".
# Typical open-eye EAR is 0.25–0.35; tweak lower (0.18) for glasses wearers.
EAR_THRESHOLD = 0.20

# How many consecutive frames the eye must be below EAR_THRESHOLD before
# the closure is considered intentional (filters out noise / partial blinks).
EAR_CONSEC_FRAMES = 2

# Number of confirmed blinks the user must produce to pass the liveness check.
BLINKS_REQUIRED = 1

# ── Head-movement challenge ──────────────────────────────────────────────────
# Minimum Euclidean pixel displacement of the nose tip between any two frames
# that counts as a "movement event".
HEAD_MOVEMENT_THRESHOLD = 12

# Set to True to require *both* a blink AND a head movement for liveness.
# Set to False to require only the blink.
HEAD_MOVEMENT_REQUIRED = True

# ── Liveness timeout ─────────────────────────────────────────────────────────
# If the user hasn't satisfied all challenges within this many seconds,
# the state machine transitions to FAILED.
LIVENESS_TIMEOUT_SECONDS = 8

# ── Face recognition ─────────────────────────────────────────────────────────
# Lower tolerance → stricter matching (fewer false positives).
# 0.5 is recommended; raise to 0.6 for more lenient matching.
FACE_RECOGNITION_TOLERANCE = 0.5

# ── Camera / display ─────────────────────────────────────────────────────────
CAMERA_INDEX = 0
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# ── File paths ────────────────────────────────────────────────────────────────
# Path to the attendance CSV log.  Created automatically if it doesn't exist.
ATTENDANCE_CSV = "attendance/records.csv"

# Path to the pickled known-faces database.
FACE_DB_PATH = "face/known_faces.pkl"

# ── MediaPipe face detection ──────────────────────────────────────────────────
# Detections with confidence below this threshold are discarded.
MIN_FACE_CONFIDENCE = 0.7
