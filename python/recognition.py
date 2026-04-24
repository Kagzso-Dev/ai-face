"""
recognition.py — Real-time face recognition attendance system.

Fetches registered users from MySQL (via backend API), matches faces from
webcam in real-time, and records attendance via the backend API.

Usage:
    python recognition.py

Controls:
    Q / ESC  → quit
    R        → reload user list from database
"""

import json
import time
from datetime import datetime

import cv2
import face_recognition
import numpy as np
import requests

API_URL          = "http://localhost:3001"
TOLERANCE        = 0.50   # Lower = stricter matching
FRAME_SCALE      = 0.50   # Downsample for faster processing
PROCESS_EVERY_N  = 2      # Process every Nth frame
COOLDOWN_SECS    = 5      # Min seconds between API calls for same user
RELOAD_INTERVAL  = 30     # Auto-reload user list every N seconds


# ─── API helpers ─────────────────────────────────────────────────────────────

def fetch_users():
    """GET /users → (list of encodings, list of user dicts)."""
    try:
        resp = requests.get(f"{API_URL}/users", timeout=10)
        resp.raise_for_status()
        users = resp.json()
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Cannot connect to backend at {API_URL}.")
        print("        Make sure the Node.js server is running:  cd backend && npm start")
        return [], []
    except Exception as exc:
        print(f"[ERROR] fetch_users: {exc}")
        return [], []

    known_encodings = []
    known_users     = []

    for user in users:
        raw = user.get("face_encoding")
        if not raw:
            continue
        try:
            enc_list = json.loads(raw) if isinstance(raw, str) else raw
            known_encodings.append(np.array(enc_list, dtype=np.float64))
            known_users.append({
                "id":          str(user["id"]),
                "name":        user["name"],
                "employee_id": user.get("employee_id", ""),
                "department":  user.get("department", ""),
            })
        except (json.JSONDecodeError, ValueError) as exc:
            print(f"[WARN] Skipping user {user.get('name')}: bad encoding — {exc}")

    print(f"[INFO] Loaded {len(known_encodings)} user(s) from database.")
    return known_encodings, known_users


def mark_attendance(user_id: str, name: str) -> dict | None:
    """POST /attendance → response dict, or None on network error."""
    try:
        resp = requests.post(
            f"{API_URL}/attendance",
            json={"user_id": user_id, "name": name},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Cannot connect to backend at {API_URL}.")
        return None
    except Exception as exc:
        print(f"[ERROR] mark_attendance: {exc}")
        return None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 54)
    print("   ai+face  —  Real-Time Attendance")
    print("=" * 54)

    known_encodings, known_users = fetch_users()
    if not known_encodings:
        print("\nNo registered users found. Please register users first:")
        print("  python register.py")
        return

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("\nWebcam started. Press Q/ESC to quit, R to reload users.\n")

    # Track last API call time per user to avoid hammering the server
    last_api_call: dict[str, float] = {}

    last_reload   = time.time()
    frame_count   = 0

    # Cache: face locations / names drawn on screen (updated every PROCESS_EVERY_N frames)
    cached_locations: list = []
    cached_labels:    list = []  # list of (name, status)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read frame.")
            break

        frame_count += 1
        now = time.time()

        # Auto-reload user list
        if now - last_reload > RELOAD_INTERVAL:
            known_encodings, known_users = fetch_users()
            last_reload = now

        # ── Process every Nth frame ──
        if frame_count % PROCESS_EVERY_N == 0:
            small = cv2.resize(frame, (0, 0), fx=FRAME_SCALE, fy=FRAME_SCALE)
            rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

            locations = face_recognition.face_locations(rgb_small, model="hog")
            cached_locations = locations
            cached_labels    = []

            if locations and known_encodings:
                face_encs = face_recognition.face_encodings(rgb_small, locations)

                for enc in face_encs:
                    distances = face_recognition.face_distance(known_encodings, enc)
                    best_idx  = int(np.argmin(distances))

                    if distances[best_idx] <= TOLERANCE:
                        user     = known_users[best_idx]
                        uid      = user["id"]
                        uname    = user["name"]

                        # Rate-limit API calls per user
                        if now - last_api_call.get(uid, 0) >= COOLDOWN_SECS:
                            result = mark_attendance(uid, uname)
                            last_api_call[uid] = now

                            if result is None:
                                status = "error"
                            elif result.get("success"):
                                status = "marked"
                                ts = datetime.now().strftime("%H:%M:%S")
                                print(f"[{ts}]  Marked present: {uname}")
                            else:
                                status = "already"
                        else:
                            status = "recognized"

                        cached_labels.append((uname, status))
                    else:
                        cached_labels.append(("Unknown", "unknown"))
            else:
                cached_labels = [("Unknown", "unknown")] * len(locations)

        # ── Draw overlays ──
        display = frame.copy()
        scale   = 1.0 / FRAME_SCALE

        for i, (top, right, bottom, left) in enumerate(cached_locations):
            top    = int(top    * scale)
            right  = int(right  * scale)
            bottom = int(bottom * scale)
            left   = int(left   * scale)

            name, status = cached_labels[i] if i < len(cached_labels) else ("?", "unknown")

            COLOR = {
                "marked":     (0,   220,   0),   # green
                "already":    (0,   165, 255),   # orange
                "recognized": (0,   200, 255),   # cyan
                "error":      (0,     0, 255),   # red
                "unknown":    (128, 128, 128),   # grey
            }.get(status, (128, 128, 128))

            cv2.rectangle(display, (left, top), (right, bottom), COLOR, 2)
            cv2.rectangle(display, (left, bottom - 32), (right, bottom), COLOR, cv2.FILLED)
            cv2.putText(display, name, (left + 6, bottom - 9),
                        cv2.FONT_HERSHEY_DUPLEX, 0.6, (255, 255, 255), 1)

        # HUD
        ts_str = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
        cv2.putText(display, ts_str, (10, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 220, 220), 2)
        cv2.putText(display, f"Users: {len(known_users)}", (10, 62),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
        cv2.putText(display, "Q/ESC: Quit  |  R: Reload users",
                    (10, display.shape[0] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.50, (150, 150, 150), 1)

        cv2.imshow("ai+face  —  Attendance", display)
        key = cv2.waitKey(1) & 0xFF

        if key in (ord('q'), 27):
            break
        elif key == ord('r'):
            print("[INFO] Reloading users from database…")
            known_encodings, known_users = fetch_users()
            last_reload = now

    cap.release()
    cv2.destroyAllWindows()
    print("\nSession ended.")


if __name__ == "__main__":
    main()
