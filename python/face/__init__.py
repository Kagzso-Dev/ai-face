# face/__init__.py
# ---------------------------------------------------------------------------
# Convenience re-exports so callers can do:
#   from face import FaceDetector, FaceRecognizer, FaceDatabase
# ---------------------------------------------------------------------------

from face.detector import FaceDetector
from face.recognizer import FaceRecognizer
from face.database import FaceDatabase

__all__ = ["FaceDetector", "FaceRecognizer", "FaceDatabase"]
