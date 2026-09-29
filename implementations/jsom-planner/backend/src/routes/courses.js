const express = require('express');
const { query } = require('../db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/courses - search courses
router.get('/', asyncHandler(async (req, res) => {
  const { subject, search, limit = 400, offset = 0, program_id } = req.query;
  const params = [];

  let sql;

  if (program_id) {
    // ── Program-filtered mode ──────────────────────────────────
    // Returns only courses that are:
    //   (a) core courses for this program, OR
    //   (b) electives in any concentration of this program
    // Also includes course_type and concentration_name labels
    sql = `
      SELECT DISTINCT ON (c.subject, c.course_number)
             c.id, c.full_code, c.subject, c.course_number, c.title,
             c.credit_hours, c.prereq_text, c.description,
             CASE
               WHEN pcc.course_id IS NOT NULL THEN 'core'
               ELSE 'elective'
             END as course_type,
             conc.name as concentration_name
      FROM courses c
      LEFT JOIN program_core_courses pcc
             ON pcc.course_id = c.id AND pcc.program_id = $1
      LEFT JOIN concentration_courses cc ON cc.course_id = c.id
      LEFT JOIN concentrations conc ON conc.id = cc.concentration_id
             AND conc.program_id = $1
      WHERE c.is_active = true
        AND (pcc.program_id = $1 OR conc.program_id = $1)
    `;
    params.push(program_id);

    if (subject) {
      params.push(subject);
      sql += ` AND c.subject = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.full_code ILIKE $${params.length} OR c.title ILIKE $${params.length})`;
    }
    sql += ` ORDER BY c.subject, c.course_number, course_type`;
    sql += ` LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));

  } else {
    // ── Default mode: all courses ──────────────────────────────
    sql = `
      SELECT c.id, c.full_code, c.subject, c.course_number, c.title,
             c.credit_hours, c.prereq_text, c.description,
             NULL as course_type, NULL as concentration_name
      FROM courses c WHERE c.is_active = true
    `;
    if (subject) { params.push(subject); sql += ` AND c.subject = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.full_code ILIKE $${params.length} OR c.title ILIKE $${params.length})`;
    }
    sql += ` ORDER BY c.subject, c.course_number`;
    sql += ` LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(parseInt(limit), parseInt(offset));
  }

  const result = await query(sql, params);
  res.json(result.rows);
}));

// GET /api/courses/subjects - list subjects (optionally filtered by program)
router.get('/subjects', asyncHandler(async (req, res) => {
  const { program_id } = req.query;
  let sql, params = [];

  if (program_id) {
    params.push(program_id);
    sql = `
      SELECT c.subject, COUNT(DISTINCT c.id) as count
      FROM courses c
      LEFT JOIN program_core_courses pcc ON pcc.course_id = c.id AND pcc.program_id = $1
      LEFT JOIN concentration_courses cc ON cc.course_id = c.id
      LEFT JOIN concentrations conc ON conc.id = cc.concentration_id AND conc.program_id = $1
      WHERE c.is_active = true AND (pcc.program_id = $1 OR conc.program_id = $1)
      GROUP BY c.subject ORDER BY c.subject
    `;
  } else {
    sql = `SELECT subject, COUNT(*) as count FROM courses WHERE is_active=true GROUP BY subject ORDER BY subject`;
  }

  const result = await query(sql, params);
  res.json(result.rows);
}));

// GET /api/courses/:id - course detail with graph relationships
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query('SELECT * FROM courses WHERE id = $1', [id]);
  if (!result.rows.length) throw AppError('Course not found', 404);
  const course = result.rows[0];

  // Prerequisites (what this course requires)
  const prereqResult = await query(
    `SELECT c.id, c.full_code, c.title, cp.prereq_type, cp.group_id
     FROM course_prerequisites cp
     JOIN courses c ON c.id = cp.requires_course_id
     WHERE cp.course_id = $1`, [id]
  );

  // Dependents (courses that require this one)
  const depResult = await query(
    `SELECT c.id, c.full_code, c.title, cp.prereq_type
     FROM course_prerequisites cp
     JOIN courses c ON c.id = cp.course_id
     WHERE cp.requires_course_id = $1`, [id]
  );

  // Programs this is core in
  const coreResult = await query(
    `SELECT p.id, p.program_name, p.program_type FROM program_core_courses pcc
     JOIN programs p ON p.id = pcc.program_id WHERE pcc.course_id = $1`, [id]
  );

  // Concentrations this appears in
  const electiveResult = await query(
    `SELECT conc.id, conc.name, p.program_name
     FROM concentration_courses cc
     JOIN concentrations conc ON conc.id = cc.concentration_id
     JOIN programs p ON p.id = conc.program_id
     WHERE cc.course_id = $1`, [id]
  );

  res.json({
    ...course,
    prerequisites: prereqResult.rows,
    required_by: depResult.rows,
    core_in_programs: coreResult.rows,
    elective_in_concentrations: electiveResult.rows
  });
}));

// GET /api/courses/:id/prereq-chain - full prerequisite chain (graph traversal)
router.get('/:id/prereq-chain', asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Recursive CTE to traverse prerequisite graph
  const result = await query(`
    WITH RECURSIVE prereq_chain AS (
      SELECT cp.course_id, cp.requires_course_id, cp.prereq_type, 1 as depth
      FROM course_prerequisites cp WHERE cp.course_id = $1
      UNION ALL
      SELECT cp2.course_id, cp2.requires_course_id, cp2.prereq_type, pc.depth + 1
      FROM course_prerequisites cp2
      JOIN prereq_chain pc ON pc.requires_course_id = cp2.course_id
      WHERE pc.depth < 5
    )
    SELECT DISTINCT c.id, c.full_code, c.title, c.credit_hours, pc.depth, pc.prereq_type
    FROM prereq_chain pc
    JOIN courses c ON c.id = pc.requires_course_id
    ORDER BY pc.depth, c.full_code
  `, [id]);
  res.json(result.rows);
}));

// POST /api/courses - admin create course
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { subject, course_number, title, credit_hours, description, prereq_text } = req.body;
  if (!subject || !course_number || !title) throw AppError('subject, course_number, and title are required', 400);
  const result = await query(
    `INSERT INTO courses (subject, course_number, title, credit_hours, description, prereq_text)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [subject.toUpperCase(), course_number, title, credit_hours || 3, description, prereq_text]
  );
  res.status(201).json(result.rows[0]);
}));

// PUT /api/courses/:id - admin update course
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, credit_hours, description, prereq_text } = req.body;
  const result = await query(
    `UPDATE courses SET title=$1, credit_hours=$2, description=$3, prereq_text=$4, updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [title, credit_hours, description, prereq_text, id]
  );
  if (!result.rows.length) throw AppError('Course not found', 404);
  res.json(result.rows[0]);
}));

// POST /api/courses/:id/prerequisites - admin add prereq edge
router.post('/:id/prerequisites', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { requires_course_id, prereq_type, group_id } = req.body;
  if (id === requires_course_id) throw AppError('Course cannot be its own prerequisite', 400);
  await query(
    `INSERT INTO course_prerequisites (course_id, requires_course_id, prereq_type, group_id)
     VALUES ($1,$2,$3,$4) ON CONFLICT (course_id, requires_course_id) DO NOTHING`,
    [id, requires_course_id, prereq_type || 'required', group_id || 0]
  );
  res.json({ message: 'Prerequisite added' });
}));

// DELETE /api/courses/:id/prerequisites/:reqId
router.delete('/:id/prerequisites/:reqId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  await query(
    `DELETE FROM course_prerequisites WHERE course_id=$1 AND requires_course_id=$2`,
    [req.params.id, req.params.reqId]
  );
  res.json({ message: 'Prerequisite removed' });
}));

module.exports = router;

