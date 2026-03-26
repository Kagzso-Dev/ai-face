"""
All OpenCV drawing utilities for the live display.

Design goals
------------
- Zero external dependencies beyond opencv-python and numpy.
- Every function accepts a frame (BGR uint8 ndarray) and draws *in-place*,
  returning the same array for convenience.
- Colours use BGR tuples throughout (OpenCV convention).
- Semi-transparent overlays are rendered by blending onto a copy and then
  compositing with cv2.addWeighted so we don't need an alpha channel.

Colour scheme (BGR)
-------------------
  PENDING   : grey   (180, 180, 180)
  CHECKING  : yellow (0, 220, 255)
  CONFIRMED : green  (50, 205, 50)
  FAILED    : red    (50, 50, 220)
  HUD text  : white  (255, 255, 255)
"""

import cv2
import numpy as np
from typing import Tuple

# Import LivenessState for type hints / colour lookup.
# Guard against circular imports by doing it lazily inside get_state_color().


# ── Palette ───────────────────────────────────────────────────────────────────
_COLOR_PENDING   = (180, 180, 180)   # grey
_COLOR_CHECKING  = (0, 220, 255)     # amber/yellow
_COLOR_CONFIRMED = (50, 205, 50)     # lime green
_COLOR_FAILED    = (50, 50, 220)     # red
_COLOR_WHITE     = (255, 255, 255)
_COLOR_BLACK     = (0, 0, 0)
_COLOR_DARK_BG   = (20, 20, 20)

# Font used throughout (OpenCV's built-in Hershey fonts).
_FONT            = cv2.FONT_HERSHEY_SIMPLEX
_FONT_BOLD       = cv2.FONT_HERSHEY_DUPLEX


# ── Helpers ───────────────────────────────────────────────────────────────────

def _alpha_rect(
    frame: np.ndarray,
    x1: int, y1: int,
    x2: int, y2: int,
    color: Tuple[int, int, int],
    alpha: float = 0.45,
) -> None:
    """Draw a filled semi-transparent rectangle on *frame* (in-place)."""
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


# ── Public drawing functions ──────────────────────────────────────────────────

def get_state_color(state) -> Tuple[int, int, int]:
    """
    Return a BGR colour tuple for the given :class:`LivenessState`.

    Works with the enum or its string ``.value``.
    """
    # Avoid a top-level import to prevent circular dependency.
    from liveness.liveness_checker import LivenessState

    mapping = {
        LivenessState.PENDING:   _COLOR_PENDING,
        LivenessState.CHECKING:  _COLOR_CHECKING,
        LivenessState.CONFIRMED: _COLOR_CONFIRMED,
        LivenessState.FAILED:    _COLOR_FAILED,
    }
    return mapping.get(state, _COLOR_WHITE)


def draw_face_box(
    frame: np.ndarray,
    bbox: Tuple[int, int, int, int],
    color: Tuple[int, int, int],
    label: str = "",
    confidence: float = 0.0,
) -> np.ndarray:
    """
    Draw a stylised bounding box with corner brackets around a detected face.

    Parameters
    ----------
    frame : np.ndarray
        BGR frame to draw on (mutated in-place).
    bbox : (x, y, w, h)
        Pixel bounding box.
    color : BGR tuple
        Colour of the brackets and label.
    label : str
        Text label drawn above the box (e.g. person's name or "Unknown").
    confidence : float
        If > 0, appended to the label as a percentage.

    Returns
    -------
    np.ndarray
        The same *frame* (mutated).
    """
    x, y, w, h = bbox
    x2, y2 = x + w, y + h
    corner_len = max(15, min(30, w // 6))   # scale corner with box size
    thickness  = 2

    # ── Corner brackets ──────────────────────────────────────────────────
    # Top-left
    cv2.line(frame, (x, y),              (x + corner_len, y),       color, thickness)
    cv2.line(frame, (x, y),              (x, y + corner_len),       color, thickness)
    # Top-right
    cv2.line(frame, (x2, y),             (x2 - corner_len, y),      color, thickness)
    cv2.line(frame, (x2, y),             (x2, y + corner_len),      color, thickness)
    # Bottom-left
    cv2.line(frame, (x, y2),             (x + corner_len, y2),      color, thickness)
    cv2.line(frame, (x, y2),             (x, y2 - corner_len),      color, thickness)
    # Bottom-right
    cv2.line(frame, (x2, y2),            (x2 - corner_len, y2),     color, thickness)
    cv2.line(frame, (x2, y2),            (x2, y2 - corner_len),     color, thickness)

    # ── Label ─────────────────────────────────────────────────────────────
    if label:
        text = label
        if confidence > 0:
            text = f"{label}  {confidence*100:.0f}%"

        font_scale = 0.55
        thickness_txt = 1
        (tw, th), baseline = cv2.getTextSize(text, _FONT_BOLD, font_scale, thickness_txt)

        # Background pill behind the label.
        pad = 4
        lx1 = x
        ly1 = y - th - baseline - pad * 2
        lx2 = x + tw + pad * 2
        ly2 = y

        # Clamp so the label never goes off the top of the frame.
        if ly1 < 0:
            ly1 = y
            ly2 = y + th + baseline + pad * 2

        _alpha_rect(frame, lx1, ly1, lx2, ly2, _COLOR_DARK_BG, alpha=0.6)
        cv2.putText(
            frame, text,
            (lx1 + pad, ly2 - baseline - pad),
            _FONT_BOLD, font_scale, color, thickness_txt, cv2.LINE_AA,
        )

    return frame


def draw_ear_bars(
    frame: np.ndarray,
    left_ear: float,
    right_ear: float,
    threshold: float,
) -> np.ndarray:
    """
    Draw two small vertical EAR bars in the bottom-left corner of the frame.

    Each bar fills from bottom to top proportional to the current EAR value.
    A horizontal red line marks the threshold.

    Parameters
    ----------
    frame : np.ndarray
        BGR frame (mutated in-place).
    left_ear, right_ear : float
        Current EAR values (0–0.4 typical range).
    threshold : float
        EAR threshold below which the eye is "closed" (e.g. 0.20).

    Returns
    -------
    np.ndarray
        The same *frame*.
    """
    img_h = frame.shape[0]

    bar_w     = 14
    bar_h     = 80
    margin    = 12
    gap       = 6
    bar_max   = 0.40    # EAR value that fills the bar completely

    # Bottom-left anchor.
    origin_x = margin
    origin_y = img_h - margin - bar_h

    bars = [
        ("L", left_ear,  origin_x),
        ("R", right_ear, origin_x + bar_w + gap),
    ]

    for label, ear, bx in bars:
        by = origin_y

        # Background track.
        cv2.rectangle(frame, (bx, by), (bx + bar_w, by + bar_h), (50, 50, 50), -1)

        # Filled portion.
        fill_ratio = _clamp(int((ear / bar_max) * bar_h), 0, bar_h)
        fill_color = _COLOR_CONFIRMED if ear >= threshold else _COLOR_FAILED
        cv2.rectangle(
            frame,
            (bx, by + bar_h - fill_ratio),
            (bx + bar_w, by + bar_h),
            fill_color, -1,
        )

        # Border.
        cv2.rectangle(frame, (bx, by), (bx + bar_w, by + bar_h), (100, 100, 100), 1)

        # Threshold line.
        thresh_y = by + bar_h - int((threshold / bar_max) * bar_h)
        cv2.line(frame, (bx, thresh_y), (bx + bar_w, thresh_y), _COLOR_FAILED, 1)

        # Label.
        cv2.putText(
            frame, label,
            (bx + 2, by + bar_h + 14),
            _FONT, 0.38, _COLOR_WHITE, 1, cv2.LINE_AA,
        )

        # EAR value text above bar.
        cv2.putText(
            frame, f"{ear:.2f}",
            (bx - 1, by - 4),
            _FONT, 0.32, _COLOR_WHITE, 1, cv2.LINE_AA,
        )

    return frame


def draw_liveness_status(
    frame: np.ndarray,
    liveness_result: dict,
) -> np.ndarray:
    """
    Draw a status panel in the bottom-right corner showing:
      - State label (PENDING / CHECKING / CONFIRMED / FAILED)
      - Blink count  vs  required
      - Head movement indicator
      - Progress bar
      - Message string

    Parameters
    ----------
    frame : np.ndarray
        BGR frame (mutated in-place).
    liveness_result : dict
        Output from :meth:`LivenessChecker.update`.

    Returns
    -------
    np.ndarray
    """
    img_h, img_w = frame.shape[:2]

    state         = liveness_result.get("state")
    blinks        = liveness_result.get("blinks", 0)
    blinks_req    = liveness_result.get("blinks_required", 1)
    head_moved    = liveness_result.get("head_moved", False)
    message       = liveness_result.get("message", "")
    progress      = liveness_result.get("progress", 0.0)
    elapsed       = liveness_result.get("elapsed", 0.0)

    color = get_state_color(state)

    # Panel geometry.
    panel_w = 280
    panel_h = 110
    pad     = 10
    px1     = img_w - panel_w - pad
    py1     = img_h - panel_h - pad
    px2     = img_w - pad
    py2     = img_h - pad

    _alpha_rect(frame, px1, py1, px2, py2, _COLOR_DARK_BG, alpha=0.6)
    cv2.rectangle(frame, (px1, py1), (px2, py2), color, 1)

    # State label.
    state_text = state.value if state is not None else "—"
    cv2.putText(
        frame, state_text,
        (px1 + 8, py1 + 22),
        _FONT_BOLD, 0.55, color, 1, cv2.LINE_AA,
    )

    # Blink count.
    blink_text = f"Blinks: {blinks}/{blinks_req}"
    cv2.putText(
        frame, blink_text,
        (px1 + 8, py1 + 44),
        _FONT, 0.44, _COLOR_WHITE, 1, cv2.LINE_AA,
    )

    # Head movement.
    head_text  = "Head: moved" if head_moved else "Head: waiting"
    head_color = _COLOR_CONFIRMED if head_moved else _COLOR_CHECKING
    cv2.putText(
        frame, head_text,
        (px1 + 8, py1 + 62),
        _FONT, 0.44, head_color, 1, cv2.LINE_AA,
    )

    # Progress bar.
    bar_x1 = px1 + 8
    bar_y1 = py1 + 72
    bar_x2 = px2 - 8
    bar_y2 = py1 + 84
    bar_fill = int((px2 - 8 - bar_x1) * max(0.0, min(1.0, progress)))
    cv2.rectangle(frame, (bar_x1, bar_y1), (bar_x2, bar_y2), (60, 60, 60), -1)
    if bar_fill > 0:
        cv2.rectangle(frame, (bar_x1, bar_y1), (bar_x1 + bar_fill, bar_y2), color, -1)
    cv2.rectangle(frame, (bar_x1, bar_y1), (bar_x2, bar_y2), (100, 100, 100), 1)

    # Message text (truncated if too long).
    max_chars = 36
    display_msg = message[:max_chars] + ("…" if len(message) > max_chars else "")
    cv2.putText(
        frame, display_msg,
        (px1 + 8, py2 - 6),
        _FONT, 0.36, _COLOR_WHITE, 1, cv2.LINE_AA,
    )

    return frame


def draw_attendance_flash(
    frame: np.ndarray,
    name: str,
    department: str,
) -> np.ndarray:
    """
    Draw a full-width green success banner in the upper third of the frame.

    Intended to be called for a short duration (e.g. 2 seconds) after a
    successful attendance mark.

    Parameters
    ----------
    frame : np.ndarray
        BGR frame (mutated in-place).
    name : str
        Person's display name.
    department : str
        Department label.

    Returns
    -------
    np.ndarray
    """
    img_h, img_w = frame.shape[:2]

    banner_h = 90
    bx1, by1 = 0, img_h // 2 - banner_h // 2
    bx2, by2 = img_w, img_h // 2 + banner_h // 2

    # Semi-transparent dark green background.
    _alpha_rect(frame, bx1, by1, bx2, by2, (20, 100, 20), alpha=0.75)
    # Bright green border top/bottom.
    cv2.line(frame, (bx1, by1), (bx2, by1), _COLOR_CONFIRMED, 2)
    cv2.line(frame, (bx1, by2), (bx2, by2), _COLOR_CONFIRMED, 2)

    # Big tick icon (simple V shape).
    tick_x, tick_y = 50, img_h // 2
    cv2.line(frame, (tick_x - 12, tick_y),     (tick_x - 2, tick_y + 14), _COLOR_CONFIRMED, 3)
    cv2.line(frame, (tick_x - 2,  tick_y + 14),(tick_x + 18, tick_y - 12), _COLOR_CONFIRMED, 3)

    # "ATTENDANCE MARKED" heading.
    heading = "ATTENDANCE MARKED"
    (hw, _), _ = cv2.getTextSize(heading, _FONT_BOLD, 0.9, 2)
    cv2.putText(
        frame, heading,
        ((img_w - hw) // 2, img_h // 2 - 10),
        _FONT_BOLD, 0.9, _COLOR_CONFIRMED, 2, cv2.LINE_AA,
    )

    # Name + department subtitle.
    sub = f"{name}  —  {department}"
    (sw, _), _ = cv2.getTextSize(sub, _FONT, 0.55, 1)
    cv2.putText(
        frame, sub,
        ((img_w - sw) // 2, img_h // 2 + 24),
        _FONT, 0.55, _COLOR_WHITE, 1, cv2.LINE_AA,
    )

    return frame


def draw_scanline(
    frame: np.ndarray,
    y_offset: int,
) -> np.ndarray:
    """
    Draw an animated horizontal scanline that drifts down the frame.

    Parameters
    ----------
    frame : np.ndarray
        BGR frame (mutated in-place).
    y_offset : int
        Current Y position of the scanline (e.g. ``frame_count % img_h``).

    Returns
    -------
    np.ndarray
    """
    img_h, img_w = frame.shape[:2]
    y = y_offset % img_h

    # Primary bright line.
    cv2.line(frame, (0, y), (img_w, y), (80, 80, 255), 1)

    # Faint trailing glow (two extra lines above).
    if y > 1:
        overlay = frame.copy()
        cv2.line(overlay, (0, y - 1), (img_w, y - 1), (40, 40, 180), 1)
        cv2.line(overlay, (0, y - 2), (img_w, y - 2), (20, 20, 100), 1)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)

    return frame


def draw_hud(
    frame: np.ndarray,
    fps: float,
    face_count: int,
    today_count: int,
) -> np.ndarray:
    """
    Draw a compact HUD panel in the top-left corner.

    Shows:
      - FPS (frames per second)
      - Number of faces currently detected
      - Number of attendances logged today

    Parameters
    ----------
    frame : np.ndarray
        BGR frame (mutated in-place).
    fps : float
        Current rendering frame rate.
    face_count : int
        Number of faces visible in the current frame.
    today_count : int
        Total attendance records logged today.

    Returns
    -------
    np.ndarray
    """
    lines = [
        f"FPS:      {fps:5.1f}",
        f"Faces:    {face_count}",
        f"Today:    {today_count}",
    ]

    pad       = 8
    line_h    = 18
    panel_w   = 160
    panel_h   = len(lines) * line_h + pad * 2

    _alpha_rect(frame, 0, 0, panel_w, panel_h, _COLOR_DARK_BG, alpha=0.55)
    cv2.rectangle(frame, (0, 0), (panel_w, panel_h), (70, 70, 70), 1)

    for i, text in enumerate(lines):
        cv2.putText(
            frame, text,
            (pad, pad + (i + 1) * line_h - 2),
            _FONT, 0.42, _COLOR_WHITE, 1, cv2.LINE_AA,
        )

    return frame
