const express = require('express');
const { STATUSES, SOURCES, validateLead } = require('../utils/validation');
const { badRequest, notFound, asyncHandler } = require('../utils/errors');
const { requireAuth } = require('../middleware/auth');

// Whitelisted sort columns -> SQL expression (never interpolate user input directly).
const SORT_COLUMNS = {
  name: 'name COLLATE NOCASE',
  company: 'company COLLATE NOCASE',
  status: 'status',
  source: 'source',
  created_at: 'created_at',
  updated_at: 'updated_at',
};

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

module.exports = function leadRoutes(db) {
  const router = express.Router();
  router.use(requireAuth);

  const findOwned = (id, userId) => db.prepare('SELECT * FROM leads WHERE id = ? AND user_id = ?').get(id, userId);

  const parseId = (raw) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid lead id');
    return id;
  };

  // Metadata used by the UI dropdowns
  router.get('/meta', (_req, res) => res.json({ statuses: STATUSES, sources: SOURCES }));

  // Count of leads per status (dashboard)
  router.get('/stats', (req, res) => {
    const rows = db
      .prepare('SELECT status, COUNT(*) AS count FROM leads WHERE user_id = ? GROUP BY status')
      .all(req.user.id);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    rows.forEach((r) => { byStatus[r.status] = r.count; });
    res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
  });

  // List with search, status filter, sorting, pagination
  router.get('/', (req, res) => {
    const { q = '', status = '', sortBy = 'created_at', order = 'desc' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

    if (status && !STATUSES.includes(status)) throw badRequest(`Status must be one of: ${STATUSES.join(', ')}`);
    if (!SORT_COLUMNS[sortBy]) throw badRequest(`sortBy must be one of: ${Object.keys(SORT_COLUMNS).join(', ')}`);
    const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const where = ['user_id = ?'];
    const params = [req.user.id];

    const term = String(q).trim();
    if (term) {
      // Search by name (also matches email/company for convenience)
      where.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(term)}%`;
      params.push(like, like, like);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }

    const whereSql = where.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) AS c FROM leads WHERE ${whereSql}`).get(...params).c;
    const items = db
      .prepare(
        `SELECT * FROM leads WHERE ${whereSql}
         ORDER BY ${SORT_COLUMNS[sortBy]} ${direction}, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);

    res.json({
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  });

  router.get('/:id', (req, res) => {
    const lead = findOwned(parseId(req.params.id), req.user.id);
    if (!lead) throw notFound('Lead not found');
    res.json(lead);
  });

  router.post('/', asyncHandler(async (req, res) => {
    const { errors, data } = validateLead(req.body);
    if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

    const info = db
      .prepare(
        `INSERT INTO leads (user_id, name, email, phone, company, source, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, data.name, data.email, data.phone, data.company, data.source, data.status);

    res.status(201).json(findOwned(info.lastInsertRowid, req.user.id));
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!findOwned(id, req.user.id)) throw notFound('Lead not found');

    const { errors, data } = validateLead(req.body);
    if (Object.keys(errors).length) throw badRequest('Validation failed', errors);

    db.prepare(
      `UPDATE leads
         SET name = ?, email = ?, phone = ?, company = ?, source = ?, status = ?,
             updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(data.name, data.email, data.phone, data.company, data.source, data.status, id, req.user.id);

    res.json(findOwned(id, req.user.id));
  }));

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const info = db.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').run(id, req.user.id);
    if (!info.changes) throw notFound('Lead not found');
    res.status(204).end();
  });

  return router;
};
