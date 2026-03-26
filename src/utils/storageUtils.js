// ─── Storage Keys ────────────────────────────────────────────────────────────
const KEYS = {
  REGISTERED_FACES: 'face_attendance_registered',
  ATTENDANCE_RECORDS: 'face_attendance_records',
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const safeGet = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Storage error:', e);
    return false;
  }
};

// ─── Registered Faces ─────────────────────────────────────────────────────────

/**
 * Returns all registered users.
 * Each entry: { id, name, department, descriptor: number[], registeredAt }
 */
export const getRegisteredFaces = () => safeGet(KEYS.REGISTERED_FACES, []);

/**
 * Saves a new registered face.
 * @param {string} name
 * @param {string} department
 * @param {Float32Array|number[]} descriptor - 128-dim face descriptor
 * @returns {object} saved user record
 */
export const saveRegisteredFace = (name, department, descriptor) => {
  const users = getRegisteredFaces();
  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    department: department.trim(),
    descriptor: Array.from(descriptor),   // Float32Array → plain array for JSON
    registeredAt: new Date().toISOString(),
    avatar: name.trim().charAt(0).toUpperCase(),
  };
  users.push(newUser);
  safeSet(KEYS.REGISTERED_FACES, users);
  return newUser;
};

/**
 * Deletes a registered user by id.
 */
export const deleteRegisteredFace = (id) => {
  const users = getRegisteredFaces().filter(u => u.id !== id);
  safeSet(KEYS.REGISTERED_FACES, users);
};

/**
 * Clears all registered faces.
 */
export const clearRegisteredFaces = () => safeSet(KEYS.REGISTERED_FACES, []);

// ─── Attendance Records ───────────────────────────────────────────────────────

/**
 * Returns all attendance records.
 * Each entry: { id, userId, name, department, date, time, timestamp }
 */
export const getAttendanceRecords = () => safeGet(KEYS.ATTENDANCE_RECORDS, []);

/**
 * Marks attendance for a recognised user.
 * Returns null if the user already has an entry for today.
 * @param {object} user  - registered user object
 * @returns {object|null} new record or null (duplicate)
 */
export const markAttendance = (user) => {
  const records = getAttendanceRecords();
  const today = new Date().toISOString().split('T')[0];   // "YYYY-MM-DD"

  // Prevent duplicate for same day
  const alreadyMarked = records.some(
    r => r.userId === user.id && r.date === today
  );
  if (alreadyMarked) return null;

  const now = new Date();
  const newRecord = {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: user.id,
    name: user.name,
    department: user.department,
    date: today,
    time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: now.toISOString(),
    status: 'present',
  };

  records.unshift(newRecord);   // newest first
  safeSet(KEYS.ATTENDANCE_RECORDS, records);
  return newRecord;
};

/**
 * Checks if a user has already been marked present today.
 */
export const isAlreadyMarkedToday = (userId) => {
  const today = new Date().toISOString().split('T')[0];
  return getAttendanceRecords().some(r => r.userId === userId && r.date === today);
};

/**
 * Deletes a single attendance record by id.
 */
export const deleteAttendanceRecord = (id) => {
  const records = getAttendanceRecords().filter(r => r.id !== id);
  safeSet(KEYS.ATTENDANCE_RECORDS, records);
};

/**
 * Clears all attendance records.
 */
export const clearAttendanceRecords = () => safeSet(KEYS.ATTENDANCE_RECORDS, []);

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * Computes summary statistics for the dashboard.
 */
export const getDashboardStats = () => {
  const users = getRegisteredFaces();
  const records = getAttendanceRecords();
  const today = new Date().toISOString().split('T')[0];

  const todayRecords = records.filter(r => r.date === today);
  const presentToday = todayRecords.length;
  const totalRegistered = users.length;
  const absentToday = Math.max(0, totalRegistered - presentToday);

  // Last 7 days unique dates
  const last7 = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    last7[key] = 0;
  }
  records.forEach(r => {
    if (r.date in last7) last7[r.date]++;
  });

  return {
    totalRegistered,
    presentToday,
    absentToday,
    todayRecords,
    weeklyData: Object.entries(last7).map(([date, count]) => ({ date, count })),
    recentRecords: records.slice(0, 10),
  };
};

// ─── Export to CSV ────────────────────────────────────────────────────────────

/**
 * Triggers a CSV download of attendance records.
 * @param {object[]} records - filtered records to export
 * @param {string} filename
 */
export const exportToCSV = (records, filename = 'attendance_records.csv') => {
  if (!records.length) return;

  const headers = ['Name', 'Department', 'Date', 'Time', 'Status'];
  const rows = records.map(r => [
    `"${r.name}"`,
    `"${r.department}"`,
    r.date,
    `"${r.time}"`,
    r.status,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
