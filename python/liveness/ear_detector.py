"""
Eye Aspect Ratio (EAR) blink detector.

The EAR formula (Soukupová & Čech, 2016):

    EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)

where p1..p6 are the six eye-landmark coordinates ordered as:
  p1 = outer corner
  p2 = upper-outer
  p3 = upper-inner
  p4 = inner corner
  p5 = lower-inner
  p6 = lower-outer

MediaPipe 478-point face mesh eye landmark indices used here:
  Left eye  : [33, 160, 158, 133, 153, 144]
  Right eye : [362, 385, 387, 263, 373, 380]

When the eye closes, the vertical distances (p2-p6, p3-p5) shrink while the
horizontal distance (p1-p4) stays roughly constant, so EAR drops toward 0.
A blink is confirmed when EAR stays below threshold for EAR_CONSEC_FRAMES
consecutive frames and then rises back above threshold.
"""

import math
from typing import Dict, List, Tuple


# MediaPipe face-mesh indices for the six EAR landmarks per eye.
LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]


class EARDetector:
    """
    Stateful Eye Aspect Ratio blink counter.

    Usage::

        detector = EARDetector(threshold=0.20, consec_frames=2)
        # per frame:
        left_ear  = detector.compute_ear(landmarks, LEFT_EYE_INDICES,  w, h)
        right_ear = detector.compute_ear(landmarks, RIGHT_EYE_INDICES, w, h)
        result    = detector.update(left_ear, right_ear)
        if result["blink_detected"]:
            print("Blink!")
    """

    def __init__(self, threshold: float, consec_frames: int) -> None:
        """
        Parameters
        ----------
        threshold : float
            EAR value below which an eye is considered closed (e.g. 0.20).
        consec_frames : int
            Minimum number of consecutive frames the eye must stay closed
            before the closure is counted (filters camera noise).
        """
        self.threshold = threshold
        self.consec_frames = consec_frames

        # Internal counters — reset() brings them back to these values.
        self._consec_count: int = 0   # frames eye has been continuously closed
        self._total_blinks: int = 0   # cumulative blink count this session
        self._eye_was_closed: bool = False  # True while in a closing event

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _dist(self, a: Tuple[float, float], b: Tuple[float, float]) -> float:
        """Euclidean distance between two 2-D points."""
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def compute_ear(
        self,
        landmarks,          # mediapipe NormalizedLandmarkList
        indices: List[int],
        img_w: int,
        img_h: int,
    ) -> float:
        """
        Compute the Eye Aspect Ratio for one eye.

        MediaPipe landmarks are normalised to [0, 1].  We multiply by image
        dimensions to get pixel coordinates before computing distances.

        Parameters
        ----------
        landmarks : mediapipe landmark list
            All 478 face-mesh landmarks for the current frame.
        indices : list of int
            Six landmark indices in the order [p1, p2, p3, p4, p5, p6].
        img_w, img_h : int
            Frame width and height in pixels.

        Returns
        -------
        float
            EAR value (typically 0.0–0.4).
        """
        # Extract pixel coordinates for the six landmarks.
        pts: List[Tuple[float, float]] = []
        for idx in indices:
            lm = landmarks.landmark[idx]
            pts.append((lm.x * img_w, lm.y * img_h))

        # p1..p6 mapping:  pts[0]=p1, pts[1]=p2, pts[2]=p3,
        #                   pts[3]=p4, pts[4]=p5, pts[5]=p6
        vertical_1 = self._dist(pts[1], pts[5])   # ||p2-p6||
        vertical_2 = self._dist(pts[2], pts[4])   # ||p3-p5||
        horizontal = self._dist(pts[0], pts[3])   # ||p1-p4||

        # Guard against degenerate case (landmarks collapsed to a point).
        if horizontal < 1e-6:
            return 0.0

        ear = (vertical_1 + vertical_2) / (2.0 * horizontal)
        return ear

    def update(self, left_ear: float, right_ear: float) -> Dict:
        """
        Feed new EAR values and advance the blink-detection state machine.

        A blink is registered when:
          1. The *average* EAR drops below ``threshold`` for at least
             ``consec_frames`` consecutive frames.
          2. The average EAR then rises back above ``threshold`` (eye opens).

        This two-stage detection avoids counting every low-EAR frame as a
        separate blink.

        Parameters
        ----------
        left_ear, right_ear : float
            EAR values computed by :meth:`compute_ear` for each eye.

        Returns
        -------
        dict with keys:
            ``ear``            – average of left and right EAR
            ``left_ear``       – raw left EAR
            ``right_ear``      – raw right EAR
            ``eye_closed``     – True if currently below threshold
            ``blink_detected`` – True *only* on the frame a blink completes
            ``total_blinks``   – cumulative blink count since last reset
        """
        avg_ear = (left_ear + right_ear) / 2.0
        eye_closed = avg_ear < self.threshold
        blink_detected = False

        if eye_closed:
            # Eye is currently closed — accumulate consecutive frame count.
            self._consec_count += 1
            self._eye_was_closed = True
        else:
            # Eye is currently open.
            if self._eye_was_closed and self._consec_count >= self.consec_frames:
                # Transition: closed (long enough) → open  ⟹  blink confirmed.
                self._total_blinks += 1
                blink_detected = True
            # Reset the in-progress closure tracker.
            self._consec_count = 0
            self._eye_was_closed = False

        return {
            "ear": avg_ear,
            "left_ear": left_ear,
            "right_ear": right_ear,
            "eye_closed": eye_closed,
            "blink_detected": blink_detected,
            "total_blinks": self._total_blinks,
        }

    def reset(self) -> None:
        """Reset all internal counters to their initial state."""
        self._consec_count = 0
        self._total_blinks = 0
        self._eye_was_closed = False
