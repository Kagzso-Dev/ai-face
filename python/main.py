"""
FaceAttend AI — Python Liveness Detection System
=================================================
Real-time face recognition with anti-spoofing via EAR blink + head movement.

How it works
------------
1. MediaPipe FaceMesh runs every frame (fast, ~5 ms) to track 478 landmarks.
2. From the landmarks we compute:
     - Eye Aspect Ratio (EAR) for blink detection (liveness challenge 1).
     - Nose-tip displacement for head-movement detection (liveness challenge 2).
3. LivenessChecker accumulates these results in a state machine:
     PENDING → CHECKING → CONFIRMED (or FAILED on timeout).
4. Only when CONFIRMED do we run face_recognition.face_encodings() (expensive,
   ~100 ms on CPU) to identify the person.
5. Identified person's attendance is logged to a CSV, and a flash overlay is
   shown for 2 seconds.
6. A "session" is maintained per face: once confirmed + recognized the system
   won't re-verify until the face disappears from the frame for 2+ seconds.

Usage
-----
  python main.py              # attendance mode
  python main.py --register   # register a new face interactively

Controls (attendance mode)
--------------------------
  Q / ESC  — quit
  R        — register new face (switches to register mode briefly)
  SPACE    — reset liveness checker (e.g. after FAILED)
"""

import argparse
import os
import sys
import time
from typing import Optional, Dict

import cv2
import mediapipe as mp
import numpy as np

# ── Project modules ────────────────────────────────────────────────────────────
import config
from liveness import EARDetector, HeadTracker, LivenessChecker, LivenessState
from liveness.ear_detector import LEFT_EYE_INDICES, RIGHT_EYE_INDICES
from face import FaceDetector, FaceRecognizer, FaceDatabase
from attendance import AttendanceRecorder
from utils.overlay import (
    draw_face_box,
    draw_ear_bars,
    draw_liveness_status,
    draw_attendance_flash,
    draw_scanline,
    draw_hud,
    get_state_color,
)


# ── Constants ─────────────────────────────────────────────────────────────────
FLASH_DURATION   = 2.5   # seconds to show the green attendance flash
SESSION_GAP      = 2.0   # seconds face must be absent to reset session
REGISTER_SAMPLES = 5     # number of encodings averaged during registration


# ─────────────────────────────────────────────────────────────────────────────
# Helper: initialise camera
# ─────────────────────────────────────────────────────────────────────────────

def open_camera() -> cv2.VideoCapture:
    """Open the camera and configure resolution. Exits on failure."""
    cap = cv2.VideoCapture(config.CAMERA_INDEX)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open camera index {config.CAMERA_INDEX}.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  config.FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.FRAME_HEIGHT)
    cap.set(cv2.CAP_PROP_BUFFERSIZE,   1)   # reduce latency

    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[Camera] Opened index {config.CAMERA_INDEX} at {actual_w}x{actual_h}")
    return cap


# ─────────────────────────────────────────────────────────────────────────────
# Helper: initialise MediaPipe FaceMesh
# ─────────────────────────────────────────────────────────────────────────────

def create_face_mesh() -> mp.solutions.face_mesh.FaceMesh:
    """Return a configured MediaPipe FaceMesh instance."""
    return mp.solutions.face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True,       # uses the 478-point iris model
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Registration flow
# ─────────────────────────────────────────────────────────────────────────────

def register_face(
    cap: cv2.VideoCapture,
    face_mesh,
    recognizer: FaceRecognizer,
    detector: FaceDetector,
    database: FaceDatabase,
) -> None:
    """
    Interactive face registration routine.

    Prompts the user to enter their name and department via the terminal,
    then captures REGISTER_SAMPLES frames, extracts an encoding from each,
    averages them, and saves to the database.
    """
    print("\n" + "=" * 50)
    print("  FACE REGISTRATION")
    print("=" * 50)
    name       = input("  Enter name       : ").strip()
    department = input("  Enter department : ").strip()

    if not name:
        print("[Register] Name cannot be empty.  Aborting.")
        return

    print(f"\n[Register] Registering '{name}' ({department})")
    print(f"[Register] Look directly at the camera.")
    print(f"[Register] Collecting {REGISTER_SAMPLES} sample(s)…  (press Q to cancel)\n")

    encodings_collected = []
    attempts            = 0
    max_attempts        = 200   # give up after this many frames with no face

    while len(encodings_collected) < REGISTER_SAMPLES and attempts < max_attempts:
        ret, frame = cap.read()
        if not ret:
            continue

        frame      = cv2.flip(frame, 1)
        frame_rgb  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img_h, img_w = frame.shape[:2]

        # Detect face.
        faces = detector.detect(frame_rgb)

        # Show live preview.
        display = frame.copy()
        progress_text = f"Collecting {len(encodings_collected)}/{REGISTER_SAMPLES}"
        cv2.putText(
            display, progress_text,
            (20, 40), cv2.FONT_HERSHEY_DUPLEX, 0.9, (0, 220, 255), 2, cv2.LINE_AA,
        )
        cv2.putText(
            display, "Look directly at camera",
            (20, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1, cv2.LINE_AA,
        )

        if faces:
            best = max(faces, key=lambda f: f["confidence"])
            x, y, w, h = best["bbox"]
            cv2.rectangle(display, (x, y), (x + w, y + h), (0, 220, 255), 2)

            encoding = recognizer.encode(frame_rgb, best["bbox"])
            if encoding is not None:
                encodings_collected.append(encoding)
                # Brief green flash when a sample is captured.
                cv2.rectangle(display, (x, y), (x + w, y + h), (50, 205, 50), 3)
                time.sleep(0.15)   # short pause between samples

        cv2.imshow("FaceAttend — Register", display)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), ord('Q'), 27):
            print("[Register] Cancelled by user.")
            cv2.destroyWindow("FaceAttend — Register")
            return

        attempts += 1

    cv2.destroyWindow("FaceAttend — Register")

    if len(encodings_collected) < REGISTER_SAMPLES:
        print(f"[Register] Could not collect enough samples ({len(encodings_collected)}/{REGISTER_SAMPLES}). Aborting.")
        return

    # Average the collected encodings for a more robust representation.
    avg_encoding = np.mean(np.vstack(encodings_collected), axis=0)
    record = database.add(name, department, avg_encoding)
    print(f"\n[Register] SUCCESS — '{name}' registered with id={record['id'][:8]}…")
    print("=" * 50 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# Session state container
# ─────────────────────────────────────────────────────────────────────────────

class FaceSession:
    """
    Tracks the per-face session so we don't re-run face recognition on
    someone we already confirmed in the same continuous appearance.

    A session ends (resets) when the face disappears for SESSION_GAP seconds.
    """

    def __init__(self) -> None:
        self.recognized_id:   Optional[str]   = None
        self.recognized_name: Optional[str]   = None
        self.recognized_dept: Optional[str]   = None
        self.confirmed_at:    Optional[float] = None   # time.time() of confirmation
        self.last_seen:       Optional[float] = None   # time.time() of last frame with face
        self.attendance_marked: bool          = False
        self.flash_start:     Optional[float] = None   # when to show the green flash

    @property
    def is_active(self) -> bool:
        """True if we are currently tracking a recognised person."""
        return self.recognized_id is not None

    def reset(self) -> None:
        self.recognized_id    = None
        self.recognized_name  = None
        self.recognized_dept  = None
        self.confirmed_at     = None
        self.last_seen        = None
        self.attendance_marked = False
        self.flash_start      = None

    def should_expire(self) -> bool:
        """Return True if the face has been absent long enough to end the session."""
        if self.last_seen is None:
            return False
        return (time.time() - self.last_seen) > SESSION_GAP


# ─────────────────────────────────────────────────────────────────────────────
# Main attendance loop
# ─────────────────────────────────────────────────────────────────────────────

def run_attendance(
    cap: cv2.VideoCapture,
    face_mesh,
    ear_detector: EARDetector,
    head_tracker: HeadTracker,
    liveness_checker: LivenessChecker,
    face_detector: FaceDetector,
    recognizer: FaceRecognizer,
    database: FaceDatabase,
    recorder: AttendanceRecorder,
) -> None:
    """
    Main real-time attendance loop.

    Runs until the user presses Q/ESC.
    """
    session     = FaceSession()
    frame_count = 0
    fps         = 0.0
    fps_timer   = time.time()
    fps_frames  = 0

    # Cache today's attendance count so we don't re-read CSV every frame.
    today_count         = len(recorder.get_today())
    today_count_refresh = time.time()

    print("\n[Attendance] Starting…  Press Q or ESC to quit, SPACE to reset, R to register.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARNING] Failed to read frame from camera.")
            time.sleep(0.05)
            continue

        frame      = cv2.flip(frame, 1)   # mirror so it feels like a selfie
        frame_rgb  = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img_h, img_w = frame.shape[:2]
        frame_count += 1

        # ── FPS calculation ─────────────────────────────────────────────
        fps_frames += 1
        elapsed_fps = time.time() - fps_timer
        if elapsed_fps >= 0.5:
            fps       = fps_frames / elapsed_fps
            fps_timer  = time.time()
            fps_frames = 0

        # ── Refresh today's attendance count every 10 seconds ───────────
        if time.time() - today_count_refresh > 10:
            today_count         = len(recorder.get_today())
            today_count_refresh = time.time()

        # ── MediaPipe FaceMesh ──────────────────────────────────────────
        mesh_results = face_mesh.process(frame_rgb)
        face_present = (
            mesh_results.multi_face_landmarks is not None
            and len(mesh_results.multi_face_landmarks) > 0
        )

        # Defaults for overlay when no face is visible.
        left_ear       = 0.0
        right_ear      = 0.0
        ear_result:  Dict = {"ear": 0.0, "left_ear": 0.0, "right_ear": 0.0,
                             "eye_closed": False, "blink_detected": False,
                             "total_blinks": 0}
        head_result: Dict = {"position": (0, 0), "delta": 0.0,
                             "movement_detected": False, "total_movement": 0.0}
        liveness_result: Dict = liveness_checker.update(ear_result, head_result)

        detected_faces = []  # list of bbox dicts from FaceDetector

        # ── Process landmarks if face is present ────────────────────────
        if face_present:
            face_landmarks = mesh_results.multi_face_landmarks[0]

            # Compute EAR for both eyes.
            left_ear  = ear_detector.compute_ear(face_landmarks, LEFT_EYE_INDICES,  img_w, img_h)
            right_ear = ear_detector.compute_ear(face_landmarks, RIGHT_EYE_INDICES, img_w, img_h)
            ear_result  = ear_detector.update(left_ear, right_ear)
            head_result = head_tracker.update(face_landmarks, img_w, img_h)

            # ── Liveness state machine ───────────────────────────────────
            if liveness_checker.state == LivenessState.PENDING:
                liveness_checker.start()

            liveness_result = liveness_checker.update(ear_result, head_result)

            # Update session heartbeat.
            session.last_seen = time.time()

            # ── Recognition (only when liveness is CONFIRMED) ────────────
            if (
                liveness_checker.is_confirmed()
                and not session.is_active
            ):
                # Run the (slower) MediaPipe face detection to get a bbox.
                detected_faces = face_detector.detect(frame_rgb)

                if detected_faces:
                    best_face = max(detected_faces, key=lambda f: f["confidence"])
                    encoding  = recognizer.encode(frame_rgb, best_face["bbox"])

                    if encoding is not None:
                        match = recognizer.match(encoding, database)

                        if match:
                            session.recognized_id   = match["id"]
                            session.recognized_name = match["name"]
                            session.recognized_dept = match["department"]
                            session.confirmed_at    = time.time()

                            # Mark attendance.
                            record = recorder.mark(
                                match["id"], match["name"], match["department"]
                            )
                            if record is not None:
                                session.attendance_marked = True
                                session.flash_start       = time.time()
                                today_count += 1
                                print(
                                    f"[Attendance] Marked: {match['name']} "
                                    f"({match['department']})  "
                                    f"dist={match['distance']:.3f}"
                                )
                            else:
                                print(
                                    f"[Attendance] Already marked today: "
                                    f"{match['name']}"
                                )
                                session.flash_start = None
                        else:
                            print("[Recognition] No match found — Unknown face.")
                            session.recognized_id   = "__unknown__"
                            session.recognized_name = "Unknown"
                            session.recognized_dept = ""
                            session.confirmed_at    = time.time()

        else:
            # No face in frame — check if the session has expired.
            if session.is_active and session.should_expire():
                print("[Session] Face gone — resetting liveness.")
                session.reset()
                liveness_checker.reset()
                ear_detector.reset()
                head_tracker.reset()
            elif not session.is_active and liveness_checker.state != LivenessState.PENDING:
                # Face vanished before confirming.
                liveness_checker.reset()
                ear_detector.reset()
                head_tracker.reset()

        # ── Draw overlays ───────────────────────────────────────────────

        # Scanline animation.
        draw_scanline(frame, frame_count * 2)

        # Face bounding box(es).
        if face_present:
            if not detected_faces:
                # If we haven't run FaceDetector this frame, use mesh bounding box.
                lms = mesh_results.multi_face_landmarks[0].landmark
                xs = [int(lm.x * img_w) for lm in lms]
                ys = [int(lm.y * img_h) for lm in lms]
                mx, my = min(xs), min(ys)
                mw = max(xs) - mx
                mh = max(ys) - my
                pad_factor = 0.12
                mx = max(0, mx - int(mw * pad_factor))
                my = max(0, my - int(mh * pad_factor))
                mw = min(img_w - mx, int(mw * (1 + 2 * pad_factor)))
                mh = min(img_h - my, int(mh * (1 + 2 * pad_factor)))
                mesh_bbox = (mx, my, mw, mh)
                detected_faces = [{"bbox": mesh_bbox, "confidence": 1.0}]

            for face in detected_faces:
                x, y, w, h = face["bbox"]
                liveness_color = get_state_color(liveness_checker.state)

                # Determine label.
                if session.recognized_id == "__unknown__":
                    box_label = "Unknown"
                elif session.recognized_name:
                    box_label = session.recognized_name
                else:
                    box_label = "Verifying…"

                draw_face_box(
                    frame,
                    (x, y, w, h),
                    liveness_color,
                    box_label,
                    face["confidence"],
                )

        # EAR bars (bottom-left).
        draw_ear_bars(frame, left_ear, right_ear, config.EAR_THRESHOLD)

        # Liveness status panel (bottom-right).
        draw_liveness_status(frame, liveness_result)

        # HUD (top-left).
        face_count_display = 1 if face_present else 0
        draw_hud(frame, fps, face_count_display, today_count)

        # Attendance flash (centred, shown for FLASH_DURATION seconds).
        if (
            session.flash_start is not None
            and (time.time() - session.flash_start) < FLASH_DURATION
            and session.recognized_name
            and session.recognized_name != "Unknown"
        ):
            draw_attendance_flash(
                frame,
                session.recognized_name,
                session.recognized_dept or "",
            )

        # ── Instruction strip at top ────────────────────────────────────
        instr = "Q/ESC=Quit  SPACE=Reset  R=Register"
        cv2.putText(
            frame, instr,
            (img_w // 2 - 180, img_h - 12),
            cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150, 150, 150), 1, cv2.LINE_AA,
        )

        # ── Show frame ──────────────────────────────────────────────────
        cv2.imshow("FaceAttend AI", frame)

        # ── Key handling ────────────────────────────────────────────────
        key = cv2.waitKey(1) & 0xFF

        if key in (ord('q'), ord('Q'), 27):   # Q or ESC
            print("[Main] Quit requested.")
            break

        elif key == ord(' '):                  # SPACE — manual reset
            print("[Main] Liveness reset by user.")
            session.reset()
            liveness_checker.reset()
            ear_detector.reset()
            head_tracker.reset()

        elif key in (ord('r'), ord('R')):      # R — quick register
            print("[Main] Entering registration mode…")
            # Temporarily close the attendance window.
            cv2.destroyWindow("FaceAttend AI")
            register_face(cap, face_mesh, recognizer, face_detector, database)
            # Re-open after registration completes.
            cv2.namedWindow("FaceAttend AI", cv2.WINDOW_NORMAL)
            today_count = len(recorder.get_today())


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    # ── Argument parsing ────────────────────────────────────────────────
    parser = argparse.ArgumentParser(
        description="FaceAttend AI — Real-time face recognition with liveness detection."
    )
    parser.add_argument(
        "--register",
        action="store_true",
        help="Launch in registration mode to add a new face to the database.",
    )
    args = parser.parse_args()

    # ── Component initialisation ────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  FaceAttend AI  —  starting up")
    print("=" * 60)

    database  = FaceDatabase(config.FACE_DB_PATH)
    recorder  = AttendanceRecorder(config.ATTENDANCE_CSV)
    print(f"[Init] Database: {len(database)} known face(s).")
    print(f"[Init] Attendance CSV: {config.ATTENDANCE_CSV}")

    ear_detector = EARDetector(
        threshold=config.EAR_THRESHOLD,
        consec_frames=config.EAR_CONSEC_FRAMES,
    )
    head_tracker = HeadTracker(threshold=config.HEAD_MOVEMENT_THRESHOLD)
    liveness_checker = LivenessChecker(
        blinks_required=config.BLINKS_REQUIRED,
        head_movement_required=config.HEAD_MOVEMENT_REQUIRED,
        timeout_seconds=config.LIVENESS_TIMEOUT_SECONDS,
    )
    face_detector = FaceDetector(min_confidence=config.MIN_FACE_CONFIDENCE)
    recognizer    = FaceRecognizer(tolerance=config.FACE_RECOGNITION_TOLERANCE)

    # ── Camera ──────────────────────────────────────────────────────────
    cap       = open_camera()
    face_mesh = create_face_mesh()

    try:
        if args.register:
            # Pure registration mode — no live attendance loop.
            register_face(cap, face_mesh, recognizer, face_detector, database)
        else:
            run_attendance(
                cap,
                face_mesh,
                ear_detector,
                head_tracker,
                liveness_checker,
                face_detector,
                recognizer,
                database,
                recorder,
            )
    finally:
        # ── Cleanup ─────────────────────────────────────────────────────
        print("[Main] Releasing resources…")
        cap.release()
        face_mesh.close()
        face_detector.close()
        cv2.destroyAllWindows()
        print("[Main] Done.")


if __name__ == "__main__":
    main()
