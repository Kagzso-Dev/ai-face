# attendance/__init__.py
# ---------------------------------------------------------------------------
# Convenience re-export so callers can do:
#   from attendance import AttendanceRecorder
# ---------------------------------------------------------------------------

from attendance.recorder import AttendanceRecorder

__all__ = ["AttendanceRecorder"]
