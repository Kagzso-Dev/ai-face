"""
Face recognition using the face_recognition library (dlib CNN embeddings).

face_recognition.face_encodings() produces a 128-dimensional vector for each
face.  Matching is done by comparing Euclidean distance between embeddings;
embeddings from the same person typically land < 0.5 apart.

Performance note
----------------
face_recognition.face_encodings() can take ~80–150 ms per call on CPU because
it runs the ResNet-based dlib model.  We therefore call it *only* after the
liveness check is CONFIRMED — not every frame.

face_recognition.face_locations() (HOG model) is also slow.  We skip it by
passing the bounding box we already have from MediaPipe FaceDetection directly
as the ``known_face_locations`` parameter, saving ~50 ms per call.

Coordinate convention
---------------------
face_recognition uses (top, right, bottom, left) order for face locations
(CSS box model), while MediaPipe gives (x, y, w, h).  The convert helper
handles the mapping.
"""

from typing import Dict, Optional, Tuple

import numpy as np
import face_recognition

from face.database import FaceDatabase


def _xywh_to_trbl(
    bbox: Tuple[int, int, int, int],
    img_h: int,
    img_w: int,
) -> Tuple[int, int, int, int]:
    """
    Convert (x, y, w, h) bounding box to face_recognition's
    (top, right, bottom, left) format, clamped to image bounds.
    """
    x, y, w, h = bbox
    top    = max(0, y)
    left   = max(0, x)
    bottom = min(img_h, y + h)
    right  = min(img_w, x + w)
    return (top, right, bottom, left)


class FaceRecognizer:
    """
    Encodes a detected face region and matches it against the database.

    Usage::

        recognizer = FaceRecognizer(tolerance=0.5)
        encoding   = recognizer.encode(frame_rgb, bbox)
        if encoding is not None:
            match = recognizer.match(encoding, database)
    """

    def __init__(self, tolerance: float = 0.5) -> None:
        """
        Parameters
        ----------
        tolerance : float
            Maximum face-distance to count as a match (lower = stricter).
        """
        self.tolerance = tolerance

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def encode(
        self,
        frame_rgb: np.ndarray,
        bbox: Tuple[int, int, int, int],
        num_jitters: int = 1,
    ) -> Optional[np.ndarray]:
        """
        Extract a 128-d face embedding from the given bounding box region.

        Parameters
        ----------
        frame_rgb : np.ndarray
            Full frame in RGB colour order.
        bbox : tuple (x, y, w, h)
            Pixel bounding box of the face (from FaceDetector).
        num_jitters : int
            How many times to re-sample the face (higher = more accurate but
            slower).  1 is fine for real-time use.

        Returns
        -------
        np.ndarray (128,) or None
            The face encoding, or None if face_recognition fails to find a
            face in the cropped region (can happen with extreme angles or
            very small crops).
        """
        img_h, img_w = frame_rgb.shape[:2]
        face_location = _xywh_to_trbl(bbox, img_h, img_w)

        # Passing known_face_locations skips the internal HOG detector.
        try:
            encodings = face_recognition.face_encodings(
                frame_rgb,
                known_face_locations=[face_location],
                num_jitters=num_jitters,
                model="small",  # faster; use "large" for +accuracy
            )
        except Exception as exc:
            print(f"[FaceRecognizer] Encoding error: {exc}")
            return None

        if encodings:
            return encodings[0]
        return None

    def match(
        self,
        encoding: np.ndarray,
        database: FaceDatabase,
    ) -> Optional[Dict]:
        """
        Compare *encoding* against the database and return the best match.

        Parameters
        ----------
        encoding : np.ndarray
            128-d query embedding.
        database : FaceDatabase
            The loaded face database instance.

        Returns
        -------
        dict or None
            The matching database record (with ``distance`` added),
            or None if no match is within tolerance.
        """
        return database.find_match(encoding, self.tolerance)
