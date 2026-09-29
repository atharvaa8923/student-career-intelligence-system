const express = require('express');
const { query } = require('../db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/programs - list all programs
router.get('/', asyncHandler(async (req, res) => {
  const { type, department, search } = req.query;
  let sql = `
    SELECT p.id, p.program_name, p.program_type, p.total_sch, p.is_stem,
           p.total_core_sch, p.total_elective_sch, p.num_concentrations,
           p.catalog_url, p.notes, d.name as department_name
    FROM programs p
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE p.is_active = true
  `;
  const params = [];
  if (type) { params.push(type); sql += ` AND p.program_type = $${params.length}`; }
  if (department) { params.push(`%${department}%`); sql += ` AND d.name ILIKE $${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND p.program_name ILIKE $${params.length}`; }
  sql += ' ORDER BY d.name, p.program_name';
  const result = await query(sql, params);
  res.json(result.rows);
}));

// GET /api/programs/:id - program detail with concentrations and core courses
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const progResult = await query(
    `SELECT p.*, d.name as department_name FROM programs p
     LEFT JOIN departments d ON d.id = p.department_id
     WHERE p.id = $1 AND p.is_active = true`, [id]
  );
  if (!progResult.rows.length) throw AppError('Program not found', 404);
  const program = progResult.rows[0];

  // Core courses with OR group info
  const coreResult = await query(
    `SELECT c.id, c.full_code, c.title, c.credit_hours, c.prereq_text,
            pcc.or_group_id, pcc.sort_order
     FROM program_core_courses pcc
     JOIN courses c ON c.id = pcc.course_id
     WHERE pcc.program_id = $1
     ORDER BY pcc.sort_order, c.subject, c.course_number`, [id]
  );

  // Group into slots for frontend: each required course = 1 slot, all same or_group_id = 1 slot
  const slotsMap = {};
  for (const row of coreResult.rows) {
    const key = row.or_group_id > 0 ? `or_${row.or_group_id}` : `req_${row.id}`;
    if (!slotsMap[key]) slotsMap[key] = { type: row.or_group_id > 0 ? 'or_group' : 'required', courses: [], sort_order: row.sort_order };
    slotsMap[key].courses.push(row);
  }
  const core_slots = Object.values(slotsMap).sort((a,b) => a.sort_order - b.sort_order);

  // Concentrations with their courses
  const concResult = await query(
    `SELECT c.id, c.name, c.required_sch, c.free_elective_sch, c.free_elective_notes, c.sort_order
     FROM concentrations c
     WHERE c.program_id = $1 AND c.is_active = true
     ORDER BY c.sort_order`, [id]
  );

  const concentrations = await Promise.all(concResult.rows.map(async (conc) => {
    const electivesResult = await query(
      `SELECT c.id, c.full_code, c.title, c.credit_hours, cc.group_label
       FROM concentration_courses cc
       JOIN courses c ON c.id = cc.course_id
       WHERE cc.concentration_id = $1
       ORDER BY cc.group_label, c.subject, c.course_number`, [conc.id]
    );
    return { ...conc, elective_courses: electivesResult.rows };
  }));

  res.json({ ...program, core_courses: coreResult.rows, core_slots, concentrations });
}));

// PUT /api/programs/:id - admin update
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { program_name, total_sch, total_core_sch, total_elective_sch, is_stem, notes, prerequisites_notes } = req.body;
  const result = await query(
    `UPDATE programs SET program_name=$1, total_sch=$2, total_core_sch=$3,
     total_elective_sch=$4, is_stem=$5, notes=$6, prerequisites_notes=$7, updated_at=NOW()
     WHERE id=$8 RETURNING *`,
    [program_name, total_sch, total_core_sch, total_elective_sch, is_stem, notes, prerequisites_notes, id]
  );
  if (!result.rows.length) throw AppError('Program not found', 404);
  res.json(result.rows[0]);
}));

// POST /api/programs/:id/core-courses - admin add core course
router.post('/:id/core-courses', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { course_id } = req.body;
  await query(
    `INSERT INTO program_core_courses (program_id, course_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [id, course_id]
  );
  // Update core count
  await query(
    `UPDATE programs SET num_core_courses = (SELECT COUNT(*) FROM program_core_courses WHERE program_id=$1),
     updated_at=NOW() WHERE id=$1`, [id]
  );
  res.json({ message: 'Core course added' });
}));

// DELETE /api/programs/:id/core-courses/:courseId
router.delete('/:id/core-courses/:courseId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id, courseId } = req.params;
  await query(`DELETE FROM program_core_courses WHERE program_id=$1 AND course_id=$2`, [id, courseId]);
  await query(
    `UPDATE programs SET num_core_courses = (SELECT COUNT(*) FROM program_core_courses WHERE program_id=$1),
     updated_at=NOW() WHERE id=$1`, [id]
  );
  res.json({ message: 'Core course removed' });
}));

// POST /api/programs/:id/concentrations - admin add concentration
router.post('/:id/concentrations', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, required_sch, free_elective_sch, free_elective_notes } = req.body;
  const result = await query(
    `INSERT INTO concentrations (program_id, name, required_sch, free_elective_sch, free_elective_notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [id, name, required_sch || 0, free_elective_sch || 0, free_elective_notes]
  );
  await query(`UPDATE programs SET num_concentrations=(SELECT COUNT(*) FROM concentrations WHERE program_id=$1) WHERE id=$1`, [id]);
  res.status(201).json(result.rows[0]);
}));

// PUT /api/programs/:programId/concentrations/:concId
router.put('/:programId/concentrations/:concId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { programId, concId } = req.params;
  const { name, required_sch, free_elective_sch, free_elective_notes } = req.body;
  const result = await query(
    `UPDATE concentrations SET name=$1, required_sch=$2, free_elective_sch=$3,
     free_elective_notes=$4, updated_at=NOW()
     WHERE id=$5 AND program_id=$6 RETURNING *`,
    [name, required_sch, free_elective_sch, free_elective_notes, concId, programId]
  );
  if (!result.rows.length) throw AppError('Concentration not found', 404);
  res.json(result.rows[0]);
}));

// DELETE /api/programs/:programId/concentrations/:concId
router.delete('/:programId/concentrations/:concId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { programId, concId } = req.params;
  await query(`DELETE FROM concentrations WHERE id=$1 AND program_id=$2`, [concId, programId]);
  await query(`UPDATE programs SET num_concentrations=(SELECT COUNT(*) FROM concentrations WHERE program_id=$1) WHERE id=$1`, [programId]);
  res.json({ message: 'Concentration removed' });
}));

// POST /api/programs/:programId/concentrations/:concId/courses
router.post('/:programId/concentrations/:concId/courses', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { concId } = req.params;
  const { course_id, group_label } = req.body;
  await query(
    `INSERT INTO concentration_courses (concentration_id, course_id, group_label)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [concId, course_id, group_label || 'A']
  );
  res.json({ message: 'Elective course added to concentration' });
}));

// DELETE /api/programs/:programId/concentrations/:concId/courses/:courseId
router.delete('/:programId/concentrations/:concId/courses/:courseId', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { concId, courseId } = req.params;
  await query(`DELETE FROM concentration_courses WHERE concentration_id=$1 AND course_id=$2`, [concId, courseId]);
  res.json({ message: 'Elective course removed' });
}));

module.exports = router;
