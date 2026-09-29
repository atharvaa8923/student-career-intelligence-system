const express = require('express');
const { query } = require('../db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

// GET /api/admin/stats - system overview
router.get('/stats', asyncHandler(async (req, res) => {
  const [programs, courses, students, enrollments, auditLogs] = await Promise.all([
    query('SELECT COUNT(*) FROM programs WHERE is_active=true'),
    query('SELECT COUNT(*) FROM courses WHERE is_active=true'),
    query('SELECT COUNT(*) FROM students'),
    query(`SELECT status, COUNT(*) FROM student_courses GROUP BY status`),
    query(`SELECT action, COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY action`)
  ]);

  const enrollmentMap = {};
  enrollments.rows.forEach(r => { enrollmentMap[r.status] = parseInt(r.count); });

  res.json({
    programs: parseInt(programs.rows[0].count),
    courses: parseInt(courses.rows[0].count),
    students: parseInt(students.rows[0].count),
    enrollments: enrollmentMap,
    recentActivity: auditLogs.rows
  });
}));

// GET /api/admin/students - all students with progress
router.get('/students', asyncHandler(async (req, res) => {
  const { program_id, search, role: roleFilter } = req.query;
  let sql = `
    SELECT u.id as user_id, u.email, u.first_name, u.last_name, u.utd_id,
           u.is_active, u.role, u.created_at as registered_at,
           s.id as student_id, s.program_id, s.concentration_id, s.enrollment_year,
           s.enrollment_semester, s.expected_graduation, s.gpa,
           p.program_name, p.total_sch,
           c.name as concentration_name,
           COALESCE(SUM(CASE WHEN sc.status='completed' THEN cr.credit_hours ELSE 0 END), 0) as completed_sch,
           COUNT(CASE WHEN sc.status='enrolled' THEN 1 END) as enrolled_count
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN programs p ON p.id = s.program_id
    LEFT JOIN concentrations c ON c.id = s.concentration_id
    LEFT JOIN student_courses sc ON sc.student_id = s.id
    LEFT JOIN courses cr ON cr.id = sc.course_id
    WHERE 1=1
  `;
  const params = [];
  if (roleFilter) { params.push(roleFilter); sql += ` AND u.role = $${params.length}`; }
  if (program_id) { params.push(program_id); sql += ` AND s.program_id = $${params.length}`; }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.utd_id ILIKE $${params.length})`;
  }
  sql += ` GROUP BY u.id, u.email, u.first_name, u.last_name, u.utd_id, u.is_active,
           u.role, u.created_at, s.id, s.program_id, s.concentration_id,
           s.enrollment_year, s.enrollment_semester, s.expected_graduation,
           s.gpa, p.program_name, p.total_sch, c.name
           ORDER BY u.role, u.last_name, u.first_name`;

  const result = await query(sql, params);
  res.json(result.rows);
}));

// Supabase Auth owns credentials. A future admin invitation flow must use a
// server-only Edge Function or Auth Admin API and then assign private.app_roles.
router.post('/users', asyncHandler(async (req, res) => {
  res.status(410).json({ error: 'Create the identity in Supabase Auth; it will link to this application on first sign-in.' });
}));

// PATCH /api/admin/users/:id/toggle-active
router.patch('/users/:id/toggle-active', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE users SET is_active = NOT is_active, updated_at=NOW() WHERE id=$1 RETURNING id, is_active`,
    [req.params.id]
  );
  if (!result.rows.length) throw AppError('User not found', 404);
  res.json(result.rows[0]);
}));

// GET /api/admin/audit-log
router.get('/audit-log', asyncHandler(async (req, res) => {
  const { limit = 50, offset = 0, entity_type } = req.query;
  let sql = `
    SELECT al.*, u.email as user_email, u.first_name, u.last_name
    FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;
  const params = [];
  if (entity_type) { params.push(entity_type); sql += ` AND al.entity_type = $${params.length}`; }
  sql += ` ORDER BY al.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  params.push(parseInt(limit), parseInt(offset));
  const result = await query(sql, params);
  res.json(result.rows);
}));

// POST /api/admin/courses/bulk-update - batch update courses
router.post('/courses/bulk-update', asyncHandler(async (req, res) => {
  const { updates } = req.body; // [{ id, title, credit_hours }]
  if (!Array.isArray(updates)) throw AppError('updates must be an array', 400);
  let updated = 0;
  for (const u of updates) {
    if (!u.id) continue;
    await query(
      `UPDATE courses SET title=COALESCE($1,title), credit_hours=COALESCE($2,credit_hours), updated_at=NOW() WHERE id=$3`,
      [u.title, u.credit_hours, u.id]
    );
    updated++;
  }
  res.json({ updated });
}));

// GET /api/admin/graph/stats - knowledge graph statistics
router.get('/graph/stats', asyncHandler(async (req, res) => {
  const [nodes, edges, topCrossListed, isolatedCourses] = await Promise.all([
    query('SELECT COUNT(*) FROM courses WHERE is_active=true'),
    query('SELECT COUNT(*) FROM course_prerequisites'),
    query(`
      SELECT c.full_code, c.title,
             COUNT(DISTINCT pcc.program_id) + COUNT(DISTINCT cc.concentration_id) as connections
      FROM courses c
      LEFT JOIN program_core_courses pcc ON pcc.course_id = c.id
      LEFT JOIN concentration_courses cc ON cc.course_id = c.id
      GROUP BY c.id, c.full_code, c.title
      HAVING COUNT(DISTINCT pcc.program_id) + COUNT(DISTINCT cc.concentration_id) > 3
      ORDER BY connections DESC LIMIT 10`),
    query(`
      SELECT c.full_code, c.title FROM courses c
      WHERE c.is_active = true
        AND NOT EXISTS (SELECT 1 FROM program_core_courses WHERE course_id=c.id)
        AND NOT EXISTS (SELECT 1 FROM concentration_courses WHERE course_id=c.id)`)
  ]);

  res.json({
    graph_nodes: parseInt(nodes.rows[0].count),
    graph_edges: parseInt(edges.rows[0].count),
    top_cross_listed: topCrossListed.rows,
    isolated_courses: isolatedCourses.rows,
    graph_density: parseFloat(((parseInt(edges.rows[0].count) / Math.max(1, parseInt(nodes.rows[0].count))) * 100).toFixed(2))
  });
}));

// POST /api/admin/graph/refresh - refresh materialized view
router.post('/graph/refresh', asyncHandler(async (req, res) => {
  await query('REFRESH MATERIALIZED VIEW CONCURRENTLY course_graph');
  res.json({ message: 'Knowledge graph refreshed successfully' });
}));

module.exports = router;
