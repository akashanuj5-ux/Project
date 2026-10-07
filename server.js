import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
dotenv.config();

const app = express();
app.use(cors({ exposedHeaders: ['X-Total-Count'] }));
app.use(express.json({ limit: '25mb' }));

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'routing_deviation_db',
  port: Number(process.env.MYSQL_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Run a query and return rows
async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Parse a JSON column value safely (mysql2 may return string or object)
function parseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Standard error responder
function fail(res, err) {
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with that unique value already exists' });
  }
  res.status(500).json({ error: err.message });
}


// ---------------------------------------------------------------------------
// Auth (Phase 2): JWT (HS256, 7-day expiry) + bcrypt hashing (cost 10)
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET missing from .env — using insecure dev fallback. Set JWT_SECRET in .env.');
}
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 10;

// Precomputed hash so login attempts for unknown emails still run one bcrypt compare
const DUMMY_HASH = bcrypt.hashSync('timing-neutral-placeholder', BCRYPT_ROUNDS);

// Sign an HS256 JWT. Payload carries identity only — never the hash.
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name || '' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
  );
}

// Load profile + roles. Selects explicit profiles columns — password_hash lives
// only on auth_users and is never queried here, so it can never be serialized.
async function loadProfileAndRoles(userId) {
  const profileRows = await query(
    'SELECT id, email, full_name, is_active, permissions, created_at, updated_at FROM profiles WHERE id = ? LIMIT 1',
    [userId]
  );
  if (profileRows.length === 0) return null;
  const roleRows = await query('SELECT role FROM user_roles WHERE user_id = ?', [userId]);
  return {
    profile: { ...profileRows[0], permissions: parseJson(profileRows[0].permissions) },
    roles: roleRows.map((r) => r.role),
  };
}

// requireAuth middleware: verifies Bearer JWT (HS256 only), sets req.user
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }
    const payload = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------------------------------------------------------------------------
// Phase 3 helpers: role loading + Supabase-compatible row mappers
// ---------------------------------------------------------------------------

async function loadRoles(userId) {
  const rows = await query('SELECT role FROM user_roles WHERE user_id = ?', [userId]);
  return rows.map((r) => r.role);
}

// requireAuth variant that also loads the caller's roles into req.roles
function requireAuthWithRoles(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }
    const payload = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  loadRoles(req.user.id)
    .then((roles) => {
      req.roles = roles;
      next();
    })
    .catch((err) => fail(res, err));
}

function hasAnyRole(req, allowed) {
  const roles = req.roles || [];
  return roles.some((r) => allowed.includes(r));
}

// Sends 403 and returns false when the caller has none of the allowed roles
function forbiddenUnless(res, req, allowed) {
  if (!hasAnyRole(req, allowed)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// Roles allowed to read every deviation/audit row (RLS parity: requesters see own only)
const DEVIATION_READ_ROLES = ['ADMIN', 'FLOOR_MANAGER', 'PPC_REVIEWER', 'VIEWER'];

// MySQL returns 1/0 for TINYINT and strings for JSON columns; normalize to
// the exact shapes the Supabase client used to return (booleans + objects).
function toBool(v) {
  return v === true || v === 1 || v === '1';
}

function toDateOnly(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(v).slice(0, 10);
}

// ISO timestamp -> 'YYYY-MM-DD HH:MM:SS' so MySQL strict mode accepts it
function toSqlDateTime(v) {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  );
}

function mapDeviation(row) {
  const out = { ...row, movement_date: toDateOnly(row.movement_date) };
  out.custom_fields = parseJson(out.custom_fields);
  if (out.custom_fields === null || out.custom_fields === undefined) out.custom_fields = {};
  return out;
}

function mapProfile(row) {
  return { ...row, is_active: toBool(row.is_active), permissions: parseJson(row.permissions) };
}

function mapFormField(row) {
  const out = { ...row };
  out.options = parseJson(out.options) || [];
  out.required = toBool(out.required);
  out.visible = toBool(out.visible);
  out.is_core = toBool(out.is_core);
  out.lookup_enabled = toBool(out.lookup_enabled);
  out.lookup_min_chars = Number(out.lookup_min_chars) || 0;
  out.sort_order = Number(out.sort_order) || 0;
  return out;
}

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    res.json({ status: 'Connected to MySQL', result: rows[0].result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deviations', requireAuthWithRoles, async (req, res) => {
  try {
    // RLS parity: reviewers/admin/viewers see every ticket; requesters see their own
    const seesAll = hasAnyRole(req, DEVIATION_READ_ROLES);
    const paramRequester = req.query.requester_id || req.query.requesterId || null;
    const where = [];
    const params = [];
    if (!seesAll) {
      where.push('requester_id = ?');
      params.push(req.user.id);
    }
    if (paramRequester) {
      where.push('requester_id = ?');
      params.push(paramRequester);
    }
    const sql =
      'SELECT * FROM deviations' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY submitted_at DESC';
    const rows = await query(sql, params);
    res.json(rows.map(mapDeviation));
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/form-fields', requireAuthWithRoles, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM form_fields ORDER BY sort_order ASC');
    res.json(rows.map(mapFormField));
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Deviations - single ticket
// ---------------------------------------------------------------------------
app.get('/api/deviations/:id', requireAuthWithRoles, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM deviations WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Deviation not found' });
    const seesAll = hasAnyRole(req, DEVIATION_READ_ROLES);
    if (!seesAll && rows[0].requester_id !== req.user.id) {
      return res.status(404).json({ error: 'Deviation not found' });
    }
    res.json(mapDeviation(rows[0]));
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Audit trail (?deviationId= optional filter, newest first, max 500)
// ---------------------------------------------------------------------------
app.get('/api/audit-trail', requireAuthWithRoles, async (req, res) => {
  try {
    const { deviationId, limit } = req.query;
    const max = Math.min(Number(limit) || 500, 500);
    // RLS parity: reviewers/admin/viewer see all audit rows; requesters see only their own tickets
    const seesAll = hasAnyRole(req, DEVIATION_READ_ROLES);
    const where = [];
    const params = [];
    if (!seesAll) {
      where.push('deviation_id IN (SELECT id FROM deviations WHERE requester_id = ?)');
      params.push(req.user.id);
    }
    if (deviationId) {
      where.push('deviation_id = ?');
      params.push(deviationId);
    }
    const sql =
      'SELECT * FROM audit_trail' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY created_at DESC LIMIT ?';
    const rows = await query(sql, [...params, max]);
    res.json(rows.map((row) => ({ ...row, changes: parseJson(row.changes) || [] })));
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Master routing (?q= optional type-ahead search, default limit 100)
// ---------------------------------------------------------------------------
app.get('/api/master-routing', requireAuthWithRoles, async (req, res) => {
  try {
    const { q, limit, offset } = req.query;
    const max = Math.min(Number(limit) || 100, 1000);
    const off = Math.max(Number(offset) || 0, 0);
    const where = [];
    const params = [];
    if (q) {
      const like = '%' + q + '%';
      where.push('(item LIKE ? OR op_code LIKE ? OR op_desc LIKE ? OR dept_code LIKE ? OR dept_desc LIKE ?)');
      params.push(like, like, like, like, like);
    }
    const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const countRows = await query('SELECT COUNT(*) AS n FROM master_routing' + whereSql, params);
    const rows = await query(
      'SELECT * FROM master_routing' + whereSql + ' ORDER BY item ASC, id ASC LIMIT ? OFFSET ?',
      [...params, max, off]
    );
    res.set('X-Total-Count', String(countRows[0].n));
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
app.get('/api/profiles', requireAuthWithRoles, async (req, res) => {
  try {
    // RLS parity: admins see every profile; everyone else sees only their own
    const rows = hasAnyRole(req, ['ADMIN'])
      ? await query('SELECT * FROM profiles ORDER BY created_at ASC')
      : await query('SELECT * FROM profiles WHERE id = ? ORDER BY created_at ASC', [req.user.id]);
    res.json(rows.map(mapProfile));
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/profiles/:id', requireAuthWithRoles, async (req, res) => {
  try {
    if (!hasAnyRole(req, ['ADMIN']) && req.params.id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await query('SELECT * FROM profiles WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(mapProfile(rows[0]));
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// User roles (?userId= optional filter)
// ---------------------------------------------------------------------------
app.get('/api/user-roles', requireAuthWithRoles, async (req, res) => {
  try {
    const { userId } = req.query;
    // RLS parity: admins see every role row; everyone else sees only their own
    if (hasAnyRole(req, ['ADMIN'])) {
      if (userId) {
        const rows = await query('SELECT * FROM user_roles WHERE user_id = ?', [userId]);
        return res.json(rows);
      }
      const rows = await query('SELECT * FROM user_roles');
      return res.json(rows);
    }
    const rows = await query('SELECT * FROM user_roles WHERE user_id = ?', [req.user.id]);
    res.json(rows);
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------
app.get('/api/app-settings', requireAuthWithRoles, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM app_settings');
    res.json(rows.map((row) => ({ ...row, value: parseJson(row.value) })));
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Auth: signup — immediate session, no email confirmation (local MySQL)
// The on_auth_user_created DB trigger creates the profiles row and assigns
// ADMIN to the very first account (preserves existing role behavior).
// ---------------------------------------------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name } = req.body || {};
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const fullName = String(full_name ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await query('SELECT id FROM auth_users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const id = crypto.randomUUID();
    // raw_user_meta_data carries ONLY { full_name } (trigger reads $.full_name/$.role);
    // the bcrypt hash goes exclusively into the password_hash column.
    await query(
      'INSERT INTO auth_users (id, email, raw_user_meta_data, password_hash) VALUES (?, ?, ?, ?)',
      [id, normalizedEmail, JSON.stringify({ full_name: fullName }), passwordHash]
    );

    const data = await loadProfileAndRoles(id);
    if (!data) return res.status(500).json({ error: 'Profile was not created' });

    const user = { id, email: normalizedEmail };
    const token = signToken({ id, email: normalizedEmail, name: data.profile.full_name || fullName });
    // Hand-built response — the auth_users row (and password_hash) is never serialized
    return res.status(201).json({ token, user, profile: data.profile, roles: data.roles });
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Auth: login
// ---------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email ?? '').trim().toLowerCase();
    const rows = await query(
      'SELECT id, email, password_hash FROM auth_users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );
    const row = rows[0];
    // Always perform one bcrypt compare (dummy hash if user unknown) for flat timing
    const passwordOk = await bcrypt.compare(
      String(password ?? ''),
      (row && row.password_hash) || DUMMY_HASH
    );
    if (!row || !row.password_hash || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const data = await loadProfileAndRoles(row.id);
    if (!data) return res.status(401).json({ error: 'Invalid email or password' });

    const user = { id: row.id, email: row.email };
    const token = signToken({ id: row.id, email: row.email, name: data.profile.full_name });
    return res.json({ token, user, profile: data.profile, roles: data.roles });
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Auth: me — source of truth for session validity (revalidates profile/roles fresh)
// ---------------------------------------------------------------------------
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const data = await loadProfileAndRoles(req.user.id);
    if (!data) return res.status(401).json({ error: 'Invalid or expired token' });
    res.json({
      user: { id: data.profile.id, email: data.profile.email },
      profile: data.profile,
      roles: data.roles,
    });
  } catch (err) {
    fail(res, err);
  }
});

// ---------------------------------------------------------------------------
// Auth: logout — stateless JWT; client discards its token. Endpoint kept as a
// validated round-trip and as an anchor for a future token denylist.
// ---------------------------------------------------------------------------
app.post('/api/auth/logout', requireAuth, (req, res) => {
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Phase 3: database CRUD API (migrated from Supabase client calls).
// Parameterized queries only; RLS-equivalent role rules enforced server-side.
// ---------------------------------------------------------------------------
const APP_ROLES = ['ADMIN', 'REQUESTER', 'FLOOR_MANAGER', 'PPC_REVIEWER', 'VIEWER'];

// POST /api/deviations — id + ticket_no are produced by trg_deviations_insert
app.post('/api/deviations', requireAuthWithRoles, async (req, res) => {
  try {
    if (!hasAnyRole(req, ['REQUESTER', 'ADMIN'])) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const body = req.body || {};
    const id = crypto.randomUUID();
    // RLS parity: requester_id is always the authenticated user
    const numOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const result = await query(
      'INSERT INTO deviations (id, requester_id, requester_name, requester_email, supervisor_name, item_name, last_seq_no, last_operation_name, next_dept_code, next_dept_desc, next_seq_no, next_op_code, proposed_operation, movement_date, change_type, remarks, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        req.user.id,
        String(body.requester_name ?? ''),
        String(body.requester_email ?? req.user.email ?? ''),
        String(body.supervisor_name ?? ''),
        String(body.item_name ?? ''),
        numOrNull(body.last_seq_no),
        body.last_operation_name || null,
        body.next_dept_code || null,
        body.next_dept_desc || null,
        numOrNull(body.next_seq_no),
        body.next_op_code || null,
        String(body.proposed_operation ?? ''),
        body.movement_date ? String(body.movement_date).slice(0, 10) : null,
        String(body.change_type || 'Permanent'),
        body.remarks || null,
        JSON.stringify(body.custom_fields && typeof body.custom_fields === 'object' ? body.custom_fields : {}),
      ]
    );
    if (result.affectedRows !== 1) {
      return res.status(500).json({ error: 'Insert failed' });
    }
    const created = await query('SELECT id, ticket_no FROM deviations WHERE id = ?', [id]);
    return res.status(201).json({ id: created[0].id, ticket_no: created[0].ticket_no });
  } catch (err) {
    return fail(res, err);
  }
});

// PATCH /api/deviations/:id — review edits, L1/L2 decisions, fusion sync updates
app.patch('/api/deviations/:id', requireAuthWithRoles, async (req, res) => {
  try {
    // RLS parity: only ADMIN / FLOOR_MANAGER / PPC_REVIEWER may update deviations
    if (!forbiddenUnless(res, req, ['ADMIN', 'FLOOR_MANAGER', 'PPC_REVIEWER'])) return;
    const patch = req.body || {};
    const allowed = [
      'supervisor_name', 'item_name', 'last_seq_no', 'last_operation_name',
      'next_dept_code', 'next_dept_desc', 'next_seq_no', 'next_op_code',
      'proposed_operation', 'movement_date', 'change_type', 'remarks', 'custom_fields',
      'floor_status', 'floor_reviewed_by', 'floor_reviewer_name', 'floor_reviewed_at', 'floor_remarks',
      'ppc_status', 'ppc_reviewed_by', 'ppc_reviewer_name', 'ppc_reviewed_at', 'ppc_remarks',
      'eco_no', 'eco_attachment_url', 'fusion_sync', 'fusion_synced_at',
    ];
    const sets = [];
    const params = [];
    for (const col of allowed) {
      if (!Object.prototype.hasOwnProperty.call(patch, col)) continue;
      let value = patch[col];
      if (col === 'custom_fields') {
        value = value === null || value === undefined ? null : JSON.stringify(value);
      } else if (col === 'movement_date') {
        value = value ? String(value).slice(0, 10) : null;
      } else if (col === 'fusion_synced_at' || col === 'floor_reviewed_at' || col === 'ppc_reviewed_at') {
        value = toSqlDateTime(value);
      } else if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
        value = String(value);
      }
      sets.push(col + ' = ?');
      params.push(value === undefined ? null : value);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const result = await query('UPDATE deviations SET ' + sets.join(', ') + ' WHERE id = ?', [...params, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Deviation not found' });
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

// POST /api/audit-trail — actor_id always forced to the authenticated user (RLS parity)
app.post('/api/audit-trail', requireAuthWithRoles, async (req, res) => {
  try {
    const body = req.body || {};
    const deviationId = String(body.deviation_id || '');
    if (!deviationId) return res.status(400).json({ error: 'deviation_id is required' });
    await query(
      'INSERT INTO audit_trail (deviation_id, action, actor_id, actor_name, actor_email, actor_role, remarks, changes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        deviationId,
        String(body.action || ''),
        req.user.id,
        String(body.actor_name || ''),
        String(body.actor_email || ''),
        String(body.actor_role || ''),
        body.remarks ?? null,
        JSON.stringify(Array.isArray(body.changes) ? body.changes : []),
      ]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    return fail(res, err);
  }
});


// POST /api/form-fields — admin only (RLS: form fields admin write)
app.post('/api/form-fields', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    const body = req.body || {};
    const fieldKey = String(body.field_key || '').trim();
    const label = String(body.label || '').trim();
    if (!fieldKey || !label) return res.status(400).json({ error: 'field_key and label are required' });
    const intOr = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
    await query(
      'INSERT INTO form_fields (field_key, label, field_type, options, required, visible, is_core, sort_order, lookup_enabled, lookup_column, lookup_mode, lookup_min_chars, autofill_target, autofill_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        fieldKey,
        label,
        String(body.field_type || 'text'),
        JSON.stringify(Array.isArray(body.options) ? body.options : []),
        toBool(body.required) ? 1 : 0,
        toBool(body.visible) ? 1 : 0,
        toBool(body.is_core) ? 1 : 0,
        intOr(body.sort_order, 0),
        toBool(body.lookup_enabled) ? 1 : 0,
        body.lookup_column || null,
        String(body.lookup_mode || 'prefix'),
        intOr(body.lookup_min_chars, 0),
        body.autofill_target || null,
        body.autofill_source || null,
      ]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    return fail(res, err);
  }
});

// PATCH /api/form-fields/:id — admin only
app.patch('/api/form-fields/:id', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    const patch = req.body || {};
    const allowed = [
      'label', 'field_type', 'options', 'required', 'visible', 'is_core', 'sort_order',
      'lookup_enabled', 'lookup_column', 'lookup_mode', 'lookup_min_chars',
      'autofill_target', 'autofill_source',
    ];
    const boolCols = ['required', 'visible', 'is_core', 'lookup_enabled'];
    const sets = [];
    const params = [];
    for (const col of allowed) {
      if (!Object.prototype.hasOwnProperty.call(patch, col)) continue;
      let value = patch[col];
      if (col === 'options') {
        value = JSON.stringify(Array.isArray(value) ? value : []);
      } else if (boolCols.includes(col)) {
        value = toBool(value) ? 1 : 0;
      } else if (col === 'sort_order' || col === 'lookup_min_chars') {
        value = Number.isFinite(Number(value)) ? Number(value) : 0;
      }
      sets.push(col + ' = ?');
      params.push(value === undefined ? null : value);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const result = await query('UPDATE form_fields SET ' + sets.join(', ') + ' WHERE id = ?', [...params, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Field not found' });
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

// DELETE /api/form-fields/:id — admin only, idempotent like PostgREST
app.delete('/api/form-fields/:id', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    await query('DELETE FROM form_fields WHERE id = ?', [req.params.id]);
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

// PUT /api/users/:id/role — atomic replace of a user's roles (admin only)
app.put('/api/users/:id/role', requireAuthWithRoles, async (req, res) => {
  let conn;
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    const role = String((req.body || {}).role || '');
    if (!APP_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    conn = await pool.getConnection();
    const [profiles] = await conn.query('SELECT id FROM profiles WHERE id = ? LIMIT 1', [req.params.id]);
    if (profiles.length === 0) {
      conn.release();
      return res.status(404).json({ error: 'User not found' });
    }
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_roles WHERE user_id = ?', [req.params.id]);
    await conn.query('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [req.params.id, role]);
    await conn.commit();
    return res.status(204).end();
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore rollback error */ }
    }
    return fail(res, err);
  } finally {
    if (conn) conn.release();
  }
});

// PATCH /api/profiles/:id — whitelist: full_name, permissions, is_active (self or admin, RLS parity)
app.patch('/api/profiles/:id', requireAuthWithRoles, async (req, res) => {
  try {
    if (!hasAnyRole(req, ['ADMIN']) && req.params.id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const patch = req.body || {};
    const sets = [];
    const params = [];
    if (Object.prototype.hasOwnProperty.call(patch, 'full_name')) {
      sets.push('full_name = ?');
      params.push(String(patch.full_name ?? ''));
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'is_active')) {
      sets.push('is_active = ?');
      params.push(toBool(patch.is_active) ? 1 : 0);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'permissions')) {
      sets.push('permissions = ?');
      params.push(patch.permissions === null || patch.permissions === undefined ? null : JSON.stringify(patch.permissions));
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const result = await query('UPDATE profiles SET ' + sets.join(', ') + ' WHERE id = ?', [...params, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Profile not found' });
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});


// POST /api/master-routing — insert rows, admin only (RLS: master admin write)
app.post('/api/master-routing', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    const input = Array.isArray(req.body) ? req.body : [];
    const rows = input
      .map((r) => [
        r && r.item !== undefined ? r.item : null,
        r && r.op_code !== undefined ? r.op_code : null,
        r && r.op_desc !== undefined ? r.op_desc : null,
        r && r.dept_code !== undefined ? r.dept_code : null,
        r && r.dept_desc !== undefined ? r.dept_desc : null,
      ])
      .filter((vals) => vals.some((v) => v !== null && v !== ''));
    if (rows.length === 0) return res.status(400).json({ error: 'No rows to insert' });
    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const params = [];
      for (const vals of chunk) params.push(...vals);
      // id is filled by trg_master_routing_uuid
      const result = await query(
        'INSERT INTO master_routing (item, op_code, op_desc, dept_code, dept_desc) VALUES ' + placeholders,
        params
      );
      inserted += result.affectedRows;
    }
    return res.status(201).json({ inserted });
  } catch (err) {
    return fail(res, err);
  }
});

// DELETE /api/master-routing — clear all rows (replace-import flow, admin only)
app.delete('/api/master-routing', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    await query('DELETE FROM master_routing');
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

// DELETE /api/master-routing/:id — single row, admin only, idempotent like PostgREST
app.delete('/api/master-routing/:id', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    await query('DELETE FROM master_routing WHERE id = ?', [req.params.id]);
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

// PATCH /api/master-routing/:id — single row, partial update, admin only
app.patch('/api/master-routing/:id', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    const patch = req.body || {};
    const map = {
      item: 'item',
      op_code: 'op_code',
      op_desc: 'op_desc',
      dept_code: 'dept_code',
      dept_desc: 'dept_desc',
    };
    const sets = [];
    const params = [];
    for (const [bodyKey, col] of Object.entries(map)) {
      if (!Object.prototype.hasOwnProperty.call(patch, bodyKey)) continue;
      let value = patch[bodyKey];
      if (value === undefined || value === null) continue;
      const str = String(value);
      if (str === '') continue;
      sets.push(col + ' = ?');
      params.push(str);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const result = await query('UPDATE master_routing SET ' + sets.join(', ') + ' WHERE id = ?', [...params, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Master routing row not found' });
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

// PUT /api/app-settings/:key — upsert (RLS: settings admin write)
app.put('/api/app-settings/:key', requireAuthWithRoles, async (req, res) => {
  try {
    if (!forbiddenUnless(res, req, ['ADMIN'])) return;
    const key = String(req.params.key || '');
    if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key)) return res.status(400).json({ error: 'Invalid settings key' });
    const body = req.body || {};
    if (body.value === undefined) return res.status(400).json({ error: 'value is required' });
    await query(
      'INSERT INTO app_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      [key, JSON.stringify(body.value)]
    );
    return res.status(204).end();
  } catch (err) {
    return fail(res, err);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
