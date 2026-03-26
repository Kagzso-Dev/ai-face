"""
Head movement tracker using the nose-tip landmark (MediaPipe index 4).

Strategy
--------
We track the pixel position of the nose tip across frames.  If the
Euclidean displacement between the *current* position and the *previous*
position exceeds ``threshold`` pixels, we record a movement event and
accumulate it into ``total_movement``.

This is intentionally simple: a static printed photo or a replay attack
from a frozen video will not produce large nose-tip displacements, while
a real person naturally sways, nods, and breathes — generating enough
sub-pixel movement to pass the check quickly.

The head-movement check is used *in addition to* the EAR blink check for
a two-factor liveness confirmation.

MediaPipe nose-tip landmark index: 4
"""

import math
from typing import Dict, Optional, Tuple


class HeadTracker:
    """
    Stateful nose-tip displacement tracker.

    Usage::

        tracker = HeadTracker(threshold=12)
        # per frame:
        result = tracker.update(face_landmarks, img_w, img_h)
        if result["movement_detected"]:
            print(f"Head moved {result['delta']:.1f} px")
    """

    def __init__(self, threshold: float) -> None:
        """
        Parameters
        ----------
        threshold : float
            Minimum pixel displacement of the nose tip between consecutive
            frames that counts as a "movement" event (e.g. 12 px).
        """
        self.threshold = threshold

        # Nose-tip position from the previous frame.  None until first update.
        self._prev_position: Optional[Tuple[float, float]] = None

        # Cumulative sum of all above-threshold displacements this session.
        self._total_movement: float = 0.0

        # True once at least one above-threshold movement has been observed.
        self._movement_detected: bool = False

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _dist(self, a: Tuple[float, float], b: Tuple[float, float]) -> float:
        """Euclidean distance between two 2-D points."""
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def update(self, landmarks, img_w: int, img_h: int) -> Dict:
        """
        Compute nose-tip displacement and update movement state.

        Parameters
        ----------
        landmarks : mediapipe NormalizedLandmarkList
            All 478 face-mesh landmarks for the current frame.
        img_w, img_h : int
            Frame dimensions in pixels (used to de-normalise landmarks).

        Returns
        -------
        dict with keys:
            ``position``          – (x, y) pixel coords of nose tip this frame
            ``delta``             – pixel distance moved since last frame
                                    (0.0 on the very first call)
            ``movement_detected`` – True if cumulative threshold has been crossed
                                    *at least once* since last reset
            ``total_movement``    – sum of all above-threshold displacements
        """
        # MediaPipe nose-tip landmark is index 4.
        nose_lm = landmarks.landmark[4]
        current_pos: Tuple[float, float] = (
            nose_lm.x * img_w,
            nose_lm.y * img_h,
        )

        delta = 0.0
        if self._prev_position is not None:
            delta = self._dist(current_pos, self._prev_position)
            if delta >= self.threshold:
                self._total_movement += delta
                self._movement_detected = True

        self._prev_position = current_pos

        return {
            "position": current_pos,
            "delta": delta,
            "movement_detected": self._movement_detected,
            "total_movement": self._total_movement,
        }

    def reset(self) -> None:
        """Reset all internal state (call between liveness sessions)."""
        self._prev_position = None
        self._total_movement = 0.0
        self._movement_detected = False
