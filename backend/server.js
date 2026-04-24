require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mysql   = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── DB Pool ──────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              process.env.DB_PORT     || 3306,
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASS     || '',
  database:          process.env.DB_NAME     || 'attendance_system',
  waitForConnections: true,
  connectionLimit:   10,
  queueLimit:        0,
  dateStrings:       true,
});

pool.getConnection()
  .then(conn => { console.log('MySQL connected.'); conn.release(); })
  .catch(err  => console.error('MySQL connection failed:', err.message));

// ─── Tenant middleware ─────────────────────────────────────────────────────────
// Reads X-Tenant-ID header, validates it exists in DB, attaches req.tenantId
const requireTenant = async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(401).json({ error: 'Missing X-Tenant-ID header.' });
  }
  try {
    const [rows] = await pool.execute('SELECT id FROM tenants WHERE id = ?', [tenantId]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid tenant.' });
    req.tenantId = Number(tenantId);
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── POST /tenants ─────────────────────────────────────────────────────────────
// Create a new tenant/organisation
// Body: { name, slug, admin_pass?, user_pass? }
app.post('/tenants', async (req, res) => {
  const { name, slug, admin_pass = 'Kagzso@123', user_pass = 'Kagzso@123' } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'name and slug are required.' });
  }
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  try {
    const [result] = await pool.execute(
      'INSERT INTO tenants (name, slug, admin_pass, user_pass) VALUES (?, ?, ?, ?)',
      [name.trim(), cleanSlug, admin_pass, user_pass]
    );
    res.json({ success: true, id: result.insertId, slug: cleanSlug, name: name.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Organisation slug "${cleanSlug}" already exists.` });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /tenants ─────────────────────────────────────────────────────────────
// List all tenants (public names + slugs only, no passwords)
app.get('/tenants', async (_, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, slug, created_at FROM tenants ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /tenants/resolve/:slug ───────────────────────────────────────────────
// Returns public tenant info (id, name, slug) — no passwords exposed
app.get('/tenants/resolve/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, slug FROM tenants WHERE slug = ?',
      [slug.trim().toLowerCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Organisation not found. Check your org code.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /tenants/login ───────────────────────────────────────────────────────
// Validate org slug + role + password → return tenant context
// Body: { slug, role, password }
app.post('/tenants/login', async (req, res) => {
  const { slug, role, password } = req.body;
  if (!slug || !role || password === undefined) {
    return res.status(400).json({ error: 'slug, role, and password are required.' });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, slug, admin_pass, user_pass FROM tenants WHERE slug = ?',
      [slug.trim().toLowerCase()]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Organisation not found. Check your org code.' });
    }
    const tenant = rows[0];
    const expected = role === 'admin' ? tenant.admin_pass : tenant.user_pass;
    if (password !== expected) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.json({ success: true, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /register ───────────────────────────────────────────────────────────
// Body: { name, employee_id, department?, face_encoding }
app.post('/register', requireTenant, async (req, res) => {
  const { name, employee_id, department = '', face_encoding } = req.body;

  if (!name || !employee_id || !face_encoding) {
    return res.status(400).json({ error: 'name, employee_id, and face_encoding are required.' });
  }

  const encodingStr = typeof face_encoding === 'string'
    ? face_encoding
    : JSON.stringify(face_encoding);

  try {
    const [result] = await pool.execute(
      'INSERT INTO users (tenant_id, name, employee_id, department, face_encoding) VALUES (?, ?, ?, ?, ?)',
      [req.tenantId, name.trim(), employee_id.trim(), department.trim(), encodingStr]
    );
    res.json({ success: true, id: result.insertId, message: 'User registered successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: `Employee ID "${employee_id}" already exists in this organisation.` });
    }
    console.error('POST /register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /users ───────────────────────────────────────────────────────────────
app.get('/users', requireTenant, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, employee_id, department, face_encoding, created_at FROM users WHERE tenant_id = ? ORDER BY id ASC',
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /users/:id ────────────────────────────────────────────────────────
app.delete('/users/:id', requireTenant, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /attendance ─────────────────────────────────────────────────────────
// Body: { user_id, name, status?, punch_type? }
app.post('/attendance', requireTenant, async (req, res) => {
  const { user_id, name, status = 'present', punch_type = 'in' } = req.body;

  if (!user_id || !name) {
    return res.status(400).json({ error: 'user_id and name are required.' });
  }

  const validStatuses   = ['present', 'late', 'absent'];
  const validPunchTypes = ['in', 'out'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  if (!validPunchTypes.includes(punch_type))
    return res.status(400).json({ error: `punch_type must be 'in' or 'out'` });

  try {
    if (status === 'present' || status === 'late') {
      // Check duplicate for same punch_type today
      const [existing] = await pool.execute(
        "SELECT id FROM attendance WHERE tenant_id = ? AND user_id = ? AND date = CURDATE() AND punch_type = ? AND status IN ('present','late')",
        [req.tenantId, user_id, punch_type]
      );
      if (existing.length > 0) {
        return res.json({ success: false, message: `Already punched ${punch_type.toUpperCase()} today` });
      }
      // Was auto-marked absent (IN punch) → upgrade to present/late
      if (punch_type === 'in') {
        const [absent] = await pool.execute(
          "SELECT id FROM attendance WHERE tenant_id = ? AND user_id = ? AND date = CURDATE() AND status = 'absent' AND punch_type = 'in'",
          [req.tenantId, user_id]
        );
        if (absent.length > 0) {
          await pool.execute(
            'UPDATE attendance SET status = ?, time = CURTIME() WHERE id = ? AND tenant_id = ?',
            [status, absent[0].id, req.tenantId]
          );
          return res.json({ success: true, id: absent[0].id, message: `Punch IN updated to ${status}.` });
        }
      }
    } else {
      // absent: only for IN punch, skip if already attended IN
      const [attendedRow] = await pool.execute(
        "SELECT id FROM attendance WHERE tenant_id = ? AND user_id = ? AND date = CURDATE() AND punch_type = 'in' AND status IN ('present','late')",
        [req.tenantId, user_id]
      );
      if (attendedRow.length > 0)
        return res.json({ success: false, message: 'Already present — skip absent mark.' });
      const [absentRow] = await pool.execute(
        "SELECT id FROM attendance WHERE tenant_id = ? AND user_id = ? AND date = CURDATE() AND punch_type = 'in' AND status = 'absent'",
        [req.tenantId, user_id]
      );
      if (absentRow.length > 0)
        return res.json({ success: false, message: 'Already marked absent.' });
    }

    const [result] = await pool.execute(
      'INSERT INTO attendance (tenant_id, user_id, name, date, time, status, punch_type) VALUES (?, ?, ?, CURDATE(), CURTIME(), ?, ?)',
      [req.tenantId, user_id, name, status, punch_type]
    );
    res.json({ success: true, id: result.insertId, punch_type, message: `Punch ${punch_type.toUpperCase()} marked as ${status}.` });
  } catch (err) {
    console.error('POST /attendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /attendance/auto-absent ──────────────────────────────────────────
// Mark all users who haven't marked attendance today as 'absent'
app.post('/attendance/auto-absent', requireTenant, async (req, res) => {
  try {
    const [users] = await pool.execute('SELECT id, name FROM users WHERE tenant_id = ?', [req.tenantId]);
    if (!users.length) return res.json({ success: true, count: 0 });

    const [present] = await pool.execute(
      "SELECT user_id FROM attendance WHERE tenant_id = ? AND date = CURDATE() AND status IN ('present','late')",
      [req.tenantId]
    );
    const presentIds = new Set(present.map(p => p.user_id));

    const [absent] = await pool.execute(
      "SELECT user_id FROM attendance WHERE tenant_id = ? AND date = CURDATE() AND status = 'absent'",
      [req.tenantId]
    );
    const alreadyAbsentIds = new Set(absent.map(a => a.user_id));

    const toMark = users.filter(u => !presentIds.has(u.id) && !alreadyAbsentIds.has(u.id));
    if (!toMark.length) return res.json({ success: true, count: 0 });

    const insertQuery = 'INSERT INTO attendance (tenant_id, user_id, name, status, punch_type, date, time) VALUES ?';
    const insertValues = toMark.map(u => [
      req.tenantId,
      u.id,
      u.name,
      'absent',
      'in',
      new Date().toISOString().split('T')[0],
      new Date().toTimeString().split(' ')[0]
    ]);
    
    await pool.query(insertQuery, [insertValues]);
    res.json({ success: true, count: toMark.length });
  } catch (err) {
    console.error('POST /attendance/auto-absent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /attendance ──────────────────────────────────────────────────────────
app.get('/attendance', requireTenant, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.user_id, a.name, a.date, a.time, a.status, a.punch_type,
              u.employee_id, u.department
       FROM   attendance a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE  a.tenant_id = ?
       ORDER  BY a.date DESC, a.time DESC`,
      [req.tenantId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /attendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /attendance/:id ───────────────────────────────────────────────────
app.delete('/attendance/:id', requireTenant, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute(
      'DELETE FROM attendance WHERE id = ? AND tenant_id = ?',
      [id, req.tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    console.error('DELETE /attendance/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /attendance ───────────────────────────────────────────────────────
app.delete('/attendance', requireTenant, async (req, res) => {
  try {
    await pool.execute('DELETE FROM attendance WHERE tenant_id = ?', [req.tenantId]);
    res.json({ success: true, message: 'All attendance records cleared.' });
  } catch (err) {
    console.error('DELETE /attendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /attendance-windows ──────────────────────────────────────────────────
app.get('/attendance-windows', requireTenant, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, label, start_time as start, end_time as end, enabled, late_absent, late_cutoff, window_type FROM attendance_windows WHERE tenant_id = ?',
      [req.tenantId]
    );
    res.json(rows.map(r => ({
      ...r,
      enabled:    Boolean(r.enabled),
      lateAbsent: Boolean(r.late_absent),
      start:      r.start.substring(0, 5),
      end:        r.end.substring(0, 5),
      lateAfter:  r.late_cutoff ? r.late_cutoff.substring(0, 5) : '',
      windowType: r.window_type || 'in',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /attendance-windows ─────────────────────────────────────────────────
// Body: [ { label, start, end, enabled, lateAbsent }, ... ]
app.post('/attendance-windows', requireTenant, async (req, res) => {
  const windows = req.body;
  if (!Array.isArray(windows)) return res.status(400).json({ error: 'Body must be an array.' });

  try {
    // Transactional sync: Delete all and re-insert
    await pool.query('DELETE FROM attendance_windows WHERE tenant_id = ?', [req.tenantId]);
    
    if (windows.length > 0) {
      const values = windows.map(w => [
        req.tenantId, w.label, w.start, w.end, !!w.enabled, !!w.lateAbsent, w.lateAfter || null, w.windowType || 'in'
      ]);
      await pool.query(
        'INSERT INTO attendance_windows (tenant_id, label, start_time, end_time, enabled, late_absent, late_cutoff, window_type) VALUES ?',
        [values]
      );
    }
    res.json({ success: true, count: windows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running → http://localhost:${PORT}`);
  console.log('Tenant routes: POST /tenants | GET /tenants | POST /tenants/login');
  console.log('Protected:     POST /register | GET /users | DELETE /users/:id');
  console.log('               POST /attendance | GET /attendance | DELETE /attendance[/:id]');
});
