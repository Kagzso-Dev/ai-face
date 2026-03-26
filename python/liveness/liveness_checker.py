"""
State machine that combines EAR blink detection + head movement to confirm
a real human is in front of the camera (anti-spoofing / presentation attack
detection).

States
------
PENDING   — No face has been seen yet.  Waiting to start.
CHECKING  — Face detected, timer running, challenges being evaluated.
CONFIRMED — All challenges passed within the time limit.  Person is live.
FAILED    — Timer expired before challenges were satisfied.

Transitions
-----------
  PENDING   → CHECKING   : start() is called (face first appears)
  CHECKING  → CONFIRMED  : blinks >= blinks_required
                           AND (head_moved OR NOT head_movement_required)
                           AND elapsed < timeout
  CHECKING  → FAILED     : elapsed >= timeout
  Any       → PENDING    : reset() is called
"""

import time
from enum import Enum
from typing import Dict, Optional


class LivenessState(Enum):
    PENDING = "PENDING"
    CHECKING = "CHECKING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class LivenessChecker:
    """
    Two-factor liveness state machine.

    Combine with :class:`~liveness.ear_detector.EARDetector` and
    :class:`~liveness.head_tracker.HeadTracker`:

    Example::

        checker = LivenessChecker(
            blinks_required=1,
            head_movement_required=True,
            timeout_seconds=8,
        )
        # When face first appears:
        checker.start()
        # Each frame:
        result = checker.update(ear_result, head_result)
        if checker.is_confirmed():
            # proceed to face recognition
    """

    def __init__(
        self,
        blinks_required: int,
        head_movement_required: bool,
        timeout_seconds: float,
    ) -> None:
        """
        Parameters
        ----------
        blinks_required : int
            Number of confirmed blinks needed to pass (e.g. 1).
        head_movement_required : bool
            If True, the user must also move their head.
        timeout_seconds : float
            Seconds allowed before the check fails automatically.
        """
        self.blinks_required = blinks_required
        self.head_movement_required = head_movement_required
        self.timeout_seconds = timeout_seconds

        # Runtime state — reset() restores these.
        self._state: LivenessState = LivenessState.PENDING
        self._start_time: Optional[float] = None
        self._head_moved: bool = False

    # ------------------------------------------------------------------ #
    #  State queries                                                       #
    # ------------------------------------------------------------------ #

    @property
    def state(self) -> LivenessState:
        return self._state

    def is_confirmed(self) -> bool:
        """Return True if liveness has been fully verified."""
        return self._state == LivenessState.CONFIRMED

    def is_failed(self) -> bool:
        """Return True if the check timed out."""
        return self._state == LivenessState.FAILED

    def is_checking(self) -> bool:
        """Return True if challenges are currently being evaluated."""
        return self._state == LivenessState.CHECKING

    # ------------------------------------------------------------------ #
    #  Control                                                             #
    # ------------------------------------------------------------------ #

    def start(self) -> None:
        """
        Transition from PENDING to CHECKING.
        Call this the first time a face is detected in the frame.
        Safe to call from FAILED state to restart (equivalent to reset+start).
        """
        self._state = LivenessState.CHECKING
        self._start_time = time.time()
        self._head_moved = False

    def reset(self) -> None:
        """
        Return to PENDING state and clear all timers/flags.
        Call this when the face leaves the frame or on a manual reset.
        """
        self._state = LivenessState.PENDING
        self._start_time = None
        self._head_moved = False

    # ------------------------------------------------------------------ #
    #  Per-frame update                                                    #
    # ------------------------------------------------------------------ #

    def update(self, ear_result: Dict, head_result: Dict) -> Dict:
        """
        Advance the state machine using the latest detector outputs.

        Parameters
        ----------
        ear_result : dict
            Output from :meth:`EARDetector.update` — must contain keys
            ``total_blinks`` and ``blink_detected``.
        head_result : dict
            Output from :meth:`HeadTracker.update` — must contain key
            ``movement_detected``.

        Returns
        -------
        dict with keys:
            ``state``           – current :class:`LivenessState`
            ``blinks``          – blinks accumulated so far
            ``blinks_required`` – target blink count
            ``head_moved``      – True if sufficient head movement seen
            ``message``         – human-readable status string
            ``elapsed``         – seconds since start() (0 if PENDING)
            ``progress``        – float 0-1 representing overall challenge progress
        """
        elapsed = 0.0
        total_blinks: int = ear_result.get("total_blinks", 0)
        head_moved: bool = head_result.get("movement_detected", False)

        # Persist head_moved across frames (once satisfied, stays True).
        if head_moved:
            self._head_moved = True

        # ── State transitions ──────────────────────────────────────────
        if self._state == LivenessState.CHECKING:
            if self._start_time is not None:
                elapsed = time.time() - self._start_time

            # Check for timeout first.
            if elapsed >= self.timeout_seconds:
                self._state = LivenessState.FAILED

            # Check for success conditions.
            elif total_blinks >= self.blinks_required:
                head_ok = self._head_moved or not self.head_movement_required
                if head_ok:
                    self._state = LivenessState.CONFIRMED

        elif self._state in (LivenessState.PENDING, LivenessState.CONFIRMED, LivenessState.FAILED):
            # No automatic transitions from these states; they are driven by
            # start() / reset() calls from the main loop.
            if self._start_time is not None:
                elapsed = time.time() - self._start_time

        # ── Build message ──────────────────────────────────────────────
        message = self._build_message(total_blinks, elapsed)

        # ── Progress (0 → 1) ──────────────────────────────────────────
        # Progress is a weighted average of blink progress and (optionally)
        # head-movement progress, clamped to [0, 1].
        blink_progress = min(total_blinks / max(self.blinks_required, 1), 1.0)
        if self.head_movement_required:
            head_progress = 1.0 if self._head_moved else 0.0
            progress = (blink_progress + head_progress) / 2.0
        else:
            progress = blink_progress

        # Override progress for terminal states.
        if self._state == LivenessState.CONFIRMED:
            progress = 1.0
        elif self._state == LivenessState.FAILED:
            progress = 0.0

        return {
            "state": self._state,
            "blinks": total_blinks,
            "blinks_required": self.blinks_required,
            "head_moved": self._head_moved,
            "message": message,
            "elapsed": elapsed,
            "progress": progress,
        }

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _build_message(self, total_blinks: int, elapsed: float) -> str:
        """Compose a concise status string for the on-screen overlay."""
        if self._state == LivenessState.PENDING:
            return "Look at the camera to begin"

        if self._state == LivenessState.CONFIRMED:
            return "Liveness confirmed!"

        if self._state == LivenessState.FAILED:
            return "Liveness check failed — press SPACE to retry"

        # CHECKING — tell the user what is still needed.
        remaining = max(0.0, self.timeout_seconds - elapsed)
        parts = []

        blinks_left = max(0, self.blinks_required - total_blinks)
        if blinks_left > 0:
            parts.append(
                f"Blink {blinks_left}x"
                if blinks_left > 1
                else "Blink once"
            )

        if self.head_movement_required and not self._head_moved:
            parts.append("Move your head")

        if parts:
            return f"{' + '.join(parts)}  ({remaining:.1f}s)"
        else:
            # All challenges met but state not yet flipped (races)
            return f"Processing…  ({remaining:.1f}s)"
