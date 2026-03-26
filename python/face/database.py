"""
Manages the known-faces database stored as a pickle file on disk.

Each record is a plain Python dict:

    {
        "id":            str   — UUID4 string
        "name":          str   — display name
        "department":    str   — department / group label
        "encoding":      np.ndarray (128,) — face embedding from face_recognition
        "registered_at": str   — ISO-8601 timestamp
    }

The file is loaded into memory on construction and written back to disk on
every mutating operation (add / remove).  This is fine for small databases
(< 1 000 entries); for larger deployments replace with SQLite + numpy arrays.
"""

import os
import pickle
import uuid
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
import face_recognition


class FaceDatabase:
    """
    Persistent store for known-face encodings.

    Usage::

        db = FaceDatabase("face/known_faces.pkl")
        record = db.add("Alice", "Engineering", encoding_array)
        match  = db.find_match(new_encoding, tolerance=0.5)
    """

    def __init__(self, db_path: str) -> None:
        """
        Parameters
        ----------
        db_path : str
            Path to the pickle file.  The file (and parent directory) will
            be created automatically if it does not exist.
        """
        self.db_path = db_path
        self._records: List[Dict] = []
        self._load()

    # ------------------------------------------------------------------ #
    #  Persistence                                                         #
    # ------------------------------------------------------------------ #

    def _load(self) -> None:
        """Load records from disk, or start with an empty list."""
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "rb") as fh:
                    data = pickle.load(fh)
                # Support both list-of-dicts and legacy wrapped format.
                if isinstance(data, list):
                    self._records = data
                elif isinstance(data, dict) and "records" in data:
                    self._records = data["records"]
                else:
                    print(f"[FaceDatabase] Unrecognised format in {self.db_path}; starting fresh.")
                    self._records = []
                print(f"[FaceDatabase] Loaded {len(self._records)} record(s) from {self.db_path}")
            except (pickle.UnpicklingError, EOFError, Exception) as exc:
                print(f"[FaceDatabase] Could not load {self.db_path}: {exc}; starting fresh.")
                self._records = []
        else:
            self._records = []

    def save(self) -> None:
        """
        Persist the current records list to disk as a pickle file.
        Creates the parent directory if necessary.
        """
        parent = os.path.dirname(self.db_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(self.db_path, "wb") as fh:
            pickle.dump(self._records, fh, protocol=pickle.HIGHEST_PROTOCOL)
        print(f"[FaceDatabase] Saved {len(self._records)} record(s) to {self.db_path}")

    # ------------------------------------------------------------------ #
    #  CRUD operations                                                     #
    # ------------------------------------------------------------------ #

    def add(self, name: str, department: str, encoding: np.ndarray) -> Dict:
        """
        Register a new person in the database.

        Parameters
        ----------
        name : str
            Person's display name.
        department : str
            Department or group label.
        encoding : np.ndarray
            128-dimensional face embedding produced by face_recognition.

        Returns
        -------
        dict
            The newly created record (including generated id and timestamp).
        """
        record: Dict = {
            "id": str(uuid.uuid4()),
            "name": name,
            "department": department,
            "encoding": encoding,
            "registered_at": datetime.now().isoformat(timespec="seconds"),
        }
        self._records.append(record)
        self.save()
        print(f"[FaceDatabase] Registered '{name}' ({department}) — id={record['id'][:8]}…")
        return record

    def get_all(self) -> List[Dict]:
        """Return a shallow copy of all records."""
        return list(self._records)

    def remove(self, person_id: str) -> bool:
        """
        Remove a person by their UUID.

        Returns
        -------
        bool
            True if a record was found and deleted, False otherwise.
        """
        original_len = len(self._records)
        self._records = [r for r in self._records if r["id"] != person_id]
        if len(self._records) < original_len:
            self.save()
            print(f"[FaceDatabase] Removed record id={person_id[:8]}…")
            return True
        print(f"[FaceDatabase] No record found with id={person_id[:8]}…")
        return False

    def find_match(
        self, encoding: np.ndarray, tolerance: float
    ) -> Optional[Dict]:
        """
        Compare *encoding* against every stored record and return the best
        match whose distance is within *tolerance*.

        Uses ``face_recognition.face_distance`` which computes the Euclidean
        distance in the 128-d embedding space.  Lower distance = better match.

        Parameters
        ----------
        encoding : np.ndarray
            128-d query embedding.
        tolerance : float
            Maximum allowed distance to count as a match (typically 0.5).

        Returns
        -------
        dict or None
            The best-matching record (with added ``distance`` key), or None
            if no record is within tolerance.
        """
        if not self._records:
            return None

        known_encodings = [r["encoding"] for r in self._records]
        distances = face_recognition.face_distance(known_encodings, encoding)

        best_idx = int(np.argmin(distances))
        best_dist = float(distances[best_idx])

        if best_dist <= tolerance:
            result = dict(self._records[best_idx])  # shallow copy
            result["distance"] = best_dist
            return result

        return None

    # ------------------------------------------------------------------ #
    #  Utility                                                             #
    # ------------------------------------------------------------------ #

    def __len__(self) -> int:
        return len(self._records)

    def __repr__(self) -> str:
        return f"FaceDatabase(path={self.db_path!r}, records={len(self._records)})"
