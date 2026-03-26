"""
Records attendance to a CSV file and prevents duplicate entries.

CSV columns
-----------
id, name, department, date, time, method

Duplicate prevention
--------------------
A person is considered "already marked" if their ``id`` already appears in
the CSV for the current calendar date (local time).  We check this on every
call to :meth:`mark` by scanning the in-memory today-records cache, which is
refreshed when :meth:`get_today` is called or when a new entry is written.

The CSV file is opened in append mode for writes so that it is never fully
read into memory (safe for long-running deployments with thousands of rows).
"""

import csv
import os
from datetime import date, datetime
from typing import Dict, List, Optional


# Fixed column order for the CSV.
_FIELDNAMES = ["id", "name", "department", "date", "time", "method"]

# Value written to the "method" column for every entry created by this system.
_METHOD_LABEL = "face_recognition+liveness"


class AttendanceRecorder:
    """
    Append-only attendance logger with per-day duplicate detection.

    Usage::

        recorder = AttendanceRecorder("attendance/records.csv")
        record   = recorder.mark("uuid-abc", "Alice", "Engineering")
        if record is None:
            print("Already marked today")
    """

    def __init__(self, csv_path: str) -> None:
        """
        Parameters
        ----------
        csv_path : str
            Path to the CSV file.  The parent directory and file (with
            header row) are created automatically if they do not exist.
        """
        self.csv_path = csv_path
        self._ensure_file()

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def mark(
        self,
        person_id: str,
        name: str,
        department: str,
    ) -> Optional[Dict]:
        """
        Record attendance for *person_id* if not already marked today.

        Parameters
        ----------
        person_id : str
            UUID of the person (from FaceDatabase record).
        name : str
            Display name (written to CSV for human readability).
        department : str
            Department label.

        Returns
        -------
        dict or None
            The written record, or None if the person was already marked
            earlier today (duplicate suppressed).
        """
        if self._is_marked_today(person_id):
            return None

        now = datetime.now()
        record: Dict = {
            "id":         person_id,
            "name":       name,
            "department": department,
            "date":       now.strftime("%Y-%m-%d"),
            "time":       now.strftime("%H:%M:%S"),
            "method":     _METHOD_LABEL,
        }

        self._append_row(record)
        print(
            f"[Attendance] Marked: {name} ({department}) at {record['time']}"
        )
        return record

    def get_today(self) -> List[Dict]:
        """
        Return all attendance records for the current calendar day.

        Reads the full CSV on every call (fine for typical daily volumes of
        < 1 000 entries; cache if needed for larger deployments).

        Returns
        -------
        list of dict
            Each element mirrors a CSV row.
        """
        today_str = date.today().strftime("%Y-%m-%d")
        records: List[Dict] = []

        if not os.path.exists(self.csv_path):
            return records

        try:
            with open(self.csv_path, "r", newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    if row.get("date") == today_str:
                        records.append(dict(row))
        except Exception as exc:
            print(f"[Attendance] Could not read CSV: {exc}")

        return records

    # ------------------------------------------------------------------ #
    #  Private helpers                                                     #
    # ------------------------------------------------------------------ #

    def _is_marked_today(self, person_id: str) -> bool:
        """Return True if *person_id* already has a record for today."""
        for record in self.get_today():
            if record.get("id") == person_id:
                return True
        return False

    def _ensure_file(self) -> None:
        """Create parent directory and write CSV header if file is missing."""
        parent = os.path.dirname(self.csv_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

        if not os.path.exists(self.csv_path):
            with open(self.csv_path, "w", newline="", encoding="utf-8") as fh:
                writer = csv.DictWriter(fh, fieldnames=_FIELDNAMES)
                writer.writeheader()
            print(f"[Attendance] Created new CSV at {self.csv_path}")

    def _append_row(self, record: Dict) -> None:
        """Append a single row to the CSV without re-reading the file."""
        with open(self.csv_path, "a", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=_FIELDNAMES)
            writer.writerow(record)
