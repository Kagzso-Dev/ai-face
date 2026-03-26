"""
Face detection using MediaPipe Face Detection.

Returns bounding boxes and confidence scores for every face found in a frame.
This module is used to locate the face region so that face_recognition can
extract a 128-d embedding from exactly that crop.

MediaPipe Face Detection provides:
  - Bounding box (relative coordinates → converted to pixels here)
  - Six key points (not used; we use face mesh for landmarks)
  - Detection score / confidence

We use the short-range model (model_selection=0, optimised for faces < 2 m
from camera) by default since most webcam attendance scenarios fit that profile.
Switch to model_selection=1 for longer-range / full-body shots.
"""

from typing import Dict, List, Tuple

import mediapipe as mp
import numpy as np


class FaceDetector:
    """
    Thin wrapper around MediaPipe FaceDetection.

    Usage::

        detector = FaceDetector(min_confidence=0.7)
        faces = detector.detect(frame_rgb)
        for face in faces:
            x, y, w, h = face["bbox"]
            conf        = face["confidence"]
        detector.close()
    """

    def __init__(self, min_confidence: float = 0.7) -> None:
        """
        Parameters
        ----------
        min_confidence : float
            Detections with score below this value are discarded (0–1).
        """
        self.min_confidence = min_confidence
        self._mp_face_detection = mp.solutions.face_detection
        self._detector = self._mp_face_detection.FaceDetection(
            model_selection=0,                    # short-range (< 2 m)
            min_detection_confidence=min_confidence,
        )

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def detect(self, frame_rgb: np.ndarray) -> List[Dict]:
        """
        Run face detection on an RGB frame.

        Parameters
        ----------
        frame_rgb : np.ndarray
            HxWx3 uint8 array in RGB colour order (not BGR).

        Returns
        -------
        list of dict, each containing:
            ``bbox``       – (x, y, w, h) in *pixels*, clipped to frame bounds
            ``confidence`` – float detection score in [0, 1]
        """
        img_h, img_w = frame_rgb.shape[:2]
        results = self._detector.process(frame_rgb)

        faces: List[Dict] = []
        if not results.detections:
            return faces

        for detection in results.detections:
            score = detection.score[0] if detection.score else 0.0
            if score < self.min_confidence:
                continue

            # MediaPipe returns relative bounding box → convert to pixels.
            bb = detection.location_data.relative_bounding_box
            x = int(bb.xmin * img_w)
            y = int(bb.ymin * img_h)
            w = int(bb.width * img_w)
            h = int(bb.height * img_h)

            # Clip to frame boundaries to avoid out-of-bounds crop.
            x = max(0, x)
            y = max(0, y)
            w = min(w, img_w - x)
            h = min(h, img_h - y)

            if w <= 0 or h <= 0:
                continue

            faces.append(
                {
                    "bbox": (x, y, w, h),
                    "confidence": float(score),
                }
            )

        return faces

    def close(self) -> None:
        """Release MediaPipe resources.  Call when done."""
        self._detector.close()

    # Context-manager support so callers can use `with FaceDetector(...) as d:`
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
