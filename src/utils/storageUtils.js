// ─── Backend base URL ─────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Tenant helpers ───────────────────────────────────────────────────────────
const getTenantId = () => {
  try {
    const t = sessionStorage.getItem('fa_tenant');
    return t ? JSON.parse(t).id : null;
  } catch { return null; }
};

export const resolveTenant = async (slug) => {
  const res = await fetch(`${API_BASE}/tenants/resolve/${encodeURIComponent(slug.trim().toLowerCase())}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body; // { id, name, slug }
};

export const tenantLogin = async (slug, role, password) => {
  const res = await fetch(`${API_BASE}/tenants/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, role, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body.tenant; // { id, name, slug }
};

export const fetchTenants = async () => {
  const res = await fetch(`${API_BASE}/tenants`);
  return res.ok ? res.json() : [];
};

export const createTenant = async ({ name, slug, admin_pass, user_pass }) => {
  const res = await fetch(`${API_BASE}/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug, admin_pass, user_pass }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  const tenantId = getTenantId();
  const headers = {
    'Content-Type': 'application/json',
    ...(tenantId ? { 'X-Tenant-ID': String(tenantId) } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
};

// Maps a raw DB user row → shape expected by face-api.js components
const mapUser = (u) => ({
  id:          String(u.id),
  name:        u.name,
  department:  u.department || '',
  employee_id: u.employee_id || '',
  descriptor:  typeof u.face_encoding === 'string'
                 ? JSON.parse(u.face_encoding)
                 : u.face_encoding,
  registeredAt: u.created_at || new Date().toISOString(),
  avatar:       u.name.charAt(0).toUpperCase(),
});

// Maps a raw DB attendance row → shape expected by components
const mapRecord = (r) => ({
  id:          String(r.id),
  userId:      String(r.user_id),
  name:        r.name,
  department:  r.department || '',
  employee_id: r.employee_id || '',
  date:        r.date,
  time:        r.time,
  timestamp:   `${r.date}T${r.time}`,
  status:      r.status,
  punchType:   r.punch_type || 'in',
});

// ─── Registered Faces ─────────────────────────────────────────────────────────

/**
 * Fetch all registered users from MySQL.
 * @returns {Promise<object[]>}
 */
export const getRegisteredFaces = async () => {
  try {
    const rows = await apiFetch('/users');
    return rows.map(mapUser);
  } catch (err) {
    console.error('getRegisteredFaces:', err.message);
    return [];
  }
};

/**
 * Register a new user (name + department + 128-d descriptor + optional employee_id).
 * @returns {Promise<object>} saved user record
 */
export const saveRegisteredFace = async (name, department, descriptor, employee_id) => {
  const empId = (employee_id || '').trim() || `EMP_${Date.now()}`;
  const data = await apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({
      name:          name.trim(),
      employee_id:   empId,
      department:    department.trim(),
      face_encoding: Array.from(descriptor),
    }),
  });
  return {
    id:          String(data.id),
    name:        name.trim(),
    department:  department.trim(),
    employee_id: empId,
    descriptor:  Array.from(descriptor),
    registeredAt: new Date().toISOString(),
    avatar:       name.trim().charAt(0).toUpperCase(),
  };
};

/**
 * Delete a registered user by id.
 * @returns {Promise<void>}
 */
export const deleteRegisteredFace = async (id) => {
  await apiFetch(`/users/${id}`, { method: 'DELETE' });
};

// ─── Attendance Records ───────────────────────────────────────────────────────

/**
 * Fetch all attendance records from MySQL.
 * @returns {Promise<object[]>}
 */
export const getAttendanceRecords = async () => {
  try {
    const rows = await apiFetch('/attendance');
    return rows.map(mapRecord);
  } catch (err) {
    console.error('getAttendanceRecords:', err.message);
    return [];
  }
};

/**
 * Mark attendance for a recognised user.
 * Returns null if the user is already marked present today.
 * @param {object} user  - registered user object { id, name, department }
 * @returns {Promise<object|null>} new record or null (duplicate)
 */
export const markAttendance = async (user, status = 'present', punchType = 'in') => {
  try {
    const data = await apiFetch('/attendance', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, name: user.name, status, punch_type: punchType }),
    });
    if (!data.success) return null;

    const now = new Date();
    return {
      id:         String(data.id || Date.now()),
      userId:     String(user.id),
      name:       user.name,
      department: user.department || '',
      date:       now.toISOString().split('T')[0],
      time:       now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp:  now.toISOString(),
      status,
      punchType,
    };
  } catch (err) {
    console.error('markAttendance:', err.message);
    return null;
  }
};

/**
 * Mark a user absent for today.
 * @returns {Promise<object|null>} new record or null (skipped)
 */
export const markAbsent = async (user, windowLabel = '') => {
  try {
    const data = await apiFetch('/attendance', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, name: user.name, status: 'absent' }),
    });
    if (!data.success) return null;

    const now = new Date();
    return {
      id:          String(data.id || Date.now()),
      userId:      String(user.id),
      name:        user.name,
      department:  user.department || '',
      date:        now.toISOString().split('T')[0],
      time:        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp:   now.toISOString(),
      status:      'absent',
      windowLabel,
    };
  } catch (err) {
    console.error('markAbsent:', err.message);
    return null;
  }
};

/**
 * Auto-mark all unrecorded users as absent.
 * Calls the optimized backend endpoint.
 * @returns {Promise<number>} count of newly-marked absent users
 */
export const autoMarkAbsents = async (windowLabel = '') => {
  try {
    const data = await apiFetch('/attendance/auto-absent', { method: 'POST' });
    return data.count || 0;
  } catch (err) {
    console.error('autoMarkAbsents error:', err.message);
    return 0;
  }
};

/**
 * Delete a single attendance record.
 * @returns {Promise<void>}
 */
export const deleteAttendanceRecord = async (id) => {
  await apiFetch(`/attendance/${id}`, { method: 'DELETE' });
};

/**
 * Clear ALL attendance records.
 * @returns {Promise<void>}
 */
export const clearAttendanceRecords = async () => {
  await apiFetch('/attendance', { method: 'DELETE' });
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

/**
 * Compute summary statistics for the dashboard.
 * @returns {Promise<object>}
 */
export const getDashboardStats = async () => {
  const [users, records] = await Promise.all([getRegisteredFaces(), getAttendanceRecords()]);
  const today = new Date().toISOString().split('T')[0];

  const todayRecords    = records.filter(r => r.date === today);
  const totalRegistered = users.length;
  const presentIds      = new Set(todayRecords.filter(r => r.status === 'present').map(r => r.userId));
  const lateIds         = new Set(todayRecords.filter(r => r.status === 'late' && !presentIds.has(r.userId)).map(r => r.userId));
  const attendedIds     = new Set([...presentIds, ...lateIds]);
  const presentToday    = presentIds.size;
  const lateToday       = lateIds.size;
  const confirmedAbsent = new Set(
    todayRecords.filter(r => r.status === 'absent' && !attendedIds.has(r.userId)).map(r => r.userId)
  );
  const absentToday = confirmedAbsent.size;
  const notMarked   = Math.max(0, totalRegistered - attendedIds.size - absentToday);

  // Last 7 days
  const last7 = {};
  for (let i = 6; i >= 0; i--) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    last7[d.toISOString().split('T')[0]] = 0;
  }
  records.forEach(r => { if (r.date in last7) last7[r.date]++; });

  return {
    totalRegistered,
    presentToday,
    lateToday,
    absentToday,
    notMarked,
    todayRecords,
    weeklyData:    Object.entries(last7).map(([date, count]) => ({ date, count })),
    recentRecords: records.filter(r => r.status === 'present').slice(0, 10),
  };
};

// ─── Attendance Time Windows (localStorage — config only) ────────────────────

const KEYS = { TIME_WINDOWS: 'fa_attendance_windows' };

const safeGet = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const safeSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { console.error('Storage error:', e); return false; }
};

const DEFAULT_WINDOWS = [
  { id: 'morning', label: 'Morning', start: '08:00', end: '09:35', enabled: true,  lateAbsent: true,  lateAfter: '08:30', windowType: 'in'  },
  { id: 'evening', label: 'Evening', start: '16:15', end: '18:00', enabled: true,  lateAbsent: false, lateAfter: '',      windowType: 'out' },
];

export const getTimeWindows = async () => {
  try {
    const rows = await apiFetch('/attendance-windows');
    return rows.length > 0 ? rows : DEFAULT_WINDOWS;
  } catch (err) {
    console.error('getTimeWindows:', err.message);
    return DEFAULT_WINDOWS;
  }
};

export const saveTimeWindows = async (windows) => {
  try {
    await apiFetch('/attendance-windows', {
      method: 'POST',
      body: JSON.stringify(windows),
    });
    return true;
  } catch (err) {
    console.error('saveTimeWindows:', err.message);
    return false;
  }
};

const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const hr     = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export const checkAttendanceWindow = async () => {
  const windows = await getTimeWindows();
  const active  = windows.filter(w => w.enabled);
  if (active.length === 0) return { allowed: true, reason: '', activeWindow: null, justClosedWindow: null, isLate: false, windowType: 'in' };

  const now  = new Date();
  const hhmm = now.getHours() * 60 + now.getMinutes();

  for (const w of active) {
    const [sh, sm] = w.start.split(':').map(Number);
    const [eh, em] = w.end.split(':').map(Number);
    if (hhmm >= sh * 60 + sm && hhmm <= eh * 60 + em) {
      let isLate = false;
      if (w.lateAfter) {
        const [lh, lm] = w.lateAfter.split(':').map(Number);
        isLate = hhmm > lh * 60 + lm;
      }
      return { allowed: true, reason: '', activeWindow: w, justClosedWindow: null, isLate, windowType: w.windowType || 'in' };
    }
  }

  let justClosedWindow = null;
  for (const w of active) {
    if (!w.lateAbsent) continue;
    const [eh, em] = w.end.split(':').map(Number);
    const endMin   = eh * 60 + em;
    if (hhmm > endMin && hhmm <= endMin + 2) { justClosedWindow = w; break; }
  }

  const windowList = active.map(w => `${w.label} ${fmtTime(w.start)}–${fmtTime(w.end)}`).join(', ');
  return { allowed: false, reason: `Attendance is only allowed during: ${windowList}`, activeWindow: null, justClosedWindow, isLate: false, windowType: 'in' };
};

// ─── Export to CSV (sync — operates on passed-in data) ───────────────────────

export const exportToCSV = (records, filename = 'attendance_records.csv') => {
  if (!records.length) return;
  const headers = ['Name', 'Department', 'Date', 'Time', 'Status'];
  const rows    = records.map(r => [`"${r.name}"`, `"${r.department}"`, r.date, `"${r.time}"`, r.status]);
  const csv     = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
