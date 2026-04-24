"""
register.py — Register a new user via webcam and save to MySQL via backend API.

Usage:
    python register.py
"""

import sys
import json
import requests
import cv2
import face_recognition

API_URL = "http://localhost:3001"


# ─── Face capture ─────────────────────────────────────────────────────────────

def capture_face_encoding():
    """Open webcam, let user position their face, capture on SPACE."""
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return None

    print("\nWebcam started.")
    print("  SPACE  → capture face")
    print("  Q/ESC  → cancel\n")

    encoding = None

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to read frame.")
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        locations = face_recognition.face_locations(rgb, model="hog")

        display = frame.copy()

        # Draw bounding boxes
        for (top, right, bottom, left) in locations:
            cv2.rectangle(display, (left, top), (right, bottom), (0, 255, 0), 2)

        # Status overlay
        face_count = len(locations)
        status_text = f"Faces: {face_count}"
        color = (0, 255, 0) if face_count == 1 else (0, 165, 255)
        cv2.putText(display, status_text, (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
        cv2.putText(display, "SPACE: Capture  |  Q/ESC: Quit",
                    (10, display.shape[0] - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)

        cv2.imshow("ai+face  —  Register", display)
        key = cv2.waitKey(1) & 0xFF

        if key in (ord('q'), 27):
            print("Registration cancelled.")
            break

        if key == ord(' '):
            if face_count == 0:
                print("  No face detected — try again.")
            elif face_count > 1:
                print("  Multiple faces detected — ensure only one face is visible.")
            else:
                encodings = face_recognition.face_encodings(rgb, locations)
                if encodings:
                    encoding = encodings[0].tolist()  # numpy → plain list for JSON
                    print("  Face captured!")
                    break
                else:
                    print("  Could not generate encoding — try again.")

    cap.release()
    cv2.destroyAllWindows()
    return encoding


# ─── API call ─────────────────────────────────────────────────────────────────

def register_user(name: str, employee_id: str, department: str, encoding: list):
    """POST to /register and return the response dict or None on error."""
    try:
        resp = requests.post(
            f"{API_URL}/register",
            json={
                "name": name,
                "employee_id": employee_id,
                "department": department,
                "face_encoding": encoding,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        print(f"\nError: Cannot connect to backend at {API_URL}.")
        print("  Make sure the Node.js server is running:  cd backend && npm start")
        return None
    except requests.exceptions.HTTPError as exc:
        body = {}
        try:
            body = exc.response.json()
        except Exception:
            pass
        print(f"\nAPI Error {exc.response.status_code}: {body.get('error', str(exc))}")
        return None
    except Exception as exc:
        print(f"\nUnexpected error: {exc}")
        return None


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    print("=" * 52)
    print("   ai+face  —  User Registration")
    print("=" * 52)

    name = input("Full name        : ").strip()
    if not name:
        print("Name cannot be empty.")
        sys.exit(1)

    employee_id = input("Employee ID      : ").strip()
    if not employee_id:
        print("Employee ID cannot be empty.")
        sys.exit(1)

    department = input("Department (opt) : ").strip()

    print("\nOpening webcam for face capture…")
    encoding = capture_face_encoding()

    if encoding is None:
        print("No encoding captured. Aborting.")
        sys.exit(1)

    print(f"\nSending registration to {API_URL}/register …")
    result = register_user(name, employee_id, department, encoding)

    if result and result.get("success"):
        print(f"\n  Registered: {name}  |  ID: {employee_id}  |  DB row: {result['id']}")
        print("  Registration complete.")
    else:
        print("\nRegistration failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
