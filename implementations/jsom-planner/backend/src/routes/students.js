const express = require('express');
const { query, withTransaction } = require('../db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { requireStudentOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper: ensure student can only access their own data (unless admin)
function assertOwnership(req, studentUserId) {
  if (req.user.role !== 'admin' && req.user.id !== studentUserId) {
    throw AppError('Access denied', 403);
  }
}

// GET /api/students/dashboard - student's full dashboard data
router.get('/dashboard', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get student + program info
  const studentResult = await query(
    `SELECT s.id, s.program_id, s.concentration_id, s.enrollment_year,
            s.enrollment_semester, s.expected_graduation, s.gpa, s.is_full_time,
            p.program_name, p.total_sch, p.total_core_sch, p.total_elective_sch,
            p.num_core_courses, p.program_type, p.is_stem, p.catalog_url,
            c.name as concentration_name, c.required_sch as conc_required_sch
     FROM students s
     LEFT JOIN programs p ON p.id = s.program_id
     LEFT JOIN concentrations c ON c.id = s.concentration_id
     WHERE s.user_id = $1`, [userId]
  );

  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const student = studentResult.rows[0];

  // SCH breakdown
  const schResult = await query(
    `SELECT
       SUM(CASE WHEN sc.status='completed' THEN c.credit_hours ELSE 0 END) as completed_sch,
       SUM(CASE WHEN sc.status='enrolled' THEN c.credit_hours ELSE 0 END) as enrolled_sch,
       SUM(CASE WHEN sc.status='planned' THEN c.credit_hours ELSE 0 END) as planned_sch,
       COUNT(CASE WHEN sc.status='completed' THEN 1 END) as completed_count,
       AVG(CASE WHEN sc.status='completed' AND sc.grade_points IS NOT NULL THEN sc.grade_points END) as calc_gpa
     FROM student_courses sc
     JOIN courses c ON c.id = sc.course_id
     WHERE sc.student_id = $1`, [student.id]
  );
  const sch = schResult.rows[0];

  // Core courses completion — count SLOTS not raw rows
  // A slot is satisfied if: required=student took it, or_group=student took ANY course in that group
  const coreResult = await query(
    `WITH core_slots AS (
       SELECT
         CASE WHEN pcc.or_group_id > 0 THEN 'or_' || pcc.or_group_id::text
              ELSE 'req_' || pcc.course_id::text END as slot_key,
         pcc.or_group_id,
         pcc.course_id,
         CASE WHEN sc.id IS NOT NULL THEN sc.status ELSE NULL END as status
       FROM program_core_courses pcc
       LEFT JOIN student_courses sc ON sc.course_id = pcc.course_id
         AND sc.student_id = $1
       WHERE pcc.program_id = $2
     ),
     slot_status AS (
       SELECT slot_key,
         bool_or(status IN ('completed','enrolled')) as is_satisfied,
         bool_or(status = 'completed') as is_completed
       FROM core_slots
       GROUP BY slot_key
     )
     SELECT
       COUNT(*) as total_core,
       COUNT(*) FILTER (WHERE is_satisfied) as completed_or_enrolled_core,
       COUNT(*) FILTER (WHERE is_completed) as completed_core
     FROM slot_status`, [student.id, student.program_id]
  );
  const core = coreResult.rows[0];

  // Recent activity (last 5 status changes)
  const recentResult = await query(
    `SELECT c.full_code, c.title, sc.status, sc.semester, sc.year, sc.grade
     FROM student_courses sc
     JOIN courses c ON c.id = sc.course_id
     WHERE sc.student_id = $1
     ORDER BY sc.updated_at DESC LIMIT 5`, [student.id]
  );

  // Semester breakdown
  const semesterResult = await query(
    `SELECT sc.semester, sc.year, sc.status,
            COUNT(*) as course_count,
            SUM(c.credit_hours) as total_sch
     FROM student_courses sc
     JOIN courses c ON c.id = sc.course_id
     WHERE sc.student_id = $1
     GROUP BY sc.semester, sc.year, sc.status
     ORDER BY sc.year, CASE sc.semester WHEN 'Spring' THEN 1 WHEN 'Summer' THEN 2 ELSE 3 END`, [student.id]
  );

  const completedSch = parseInt(sch.completed_sch) || 0;
  const enrolledSch = parseInt(sch.enrolled_sch) || 0;
  const plannedSch = parseInt(sch.planned_sch) || 0;
  const totalRequired = student.total_sch || 0;

  res.json({
    student: {
      id: student.id,
      programId: student.program_id,
      concentrationId: student.concentration_id,
      programName: student.program_name,
      programType: student.program_type,
      isStem: student.is_stem,
      catalogUrl: student.catalog_url,
      concentrationName: student.concentration_name,
      enrollmentYear: student.enrollment_year,
      enrollmentSemester: student.enrollment_semester,
      expectedGraduation: student.expected_graduation,
      isFullTime: student.is_full_time
    },
    progress: {
      totalRequired,
      completedSch,
      enrolledSch,
      plannedSch,
      remainingSch: Math.max(0, totalRequired - completedSch - enrolledSch),
      percentComplete: totalRequired > 0 ? Math.round((completedSch / totalRequired) * 100) : 0,
      gpa: student.gpa || (sch.calc_gpa ? parseFloat(sch.calc_gpa).toFixed(2) : null),
      totalCoreRequired: parseInt(core.total_core) || 0,
      coreCompleted: parseInt(core.completed_core) || 0,
      coreInProgress: parseInt(core.completed_or_enrolled_core) - parseInt(core.completed_core) || 0,
      coreRemaining: Math.max(0, (parseInt(core.total_core) || 0) - (parseInt(core.completed_or_enrolled_core) || 0))
    },
    recentActivity: recentResult.rows,
    semesterBreakdown: semesterResult.rows
  });
}));

// GET /api/students/courses - all student courses
router.get('/courses', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const { status, semester, year } = req.query;

  const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const studentId = studentResult.rows[0].id;

  let sql = `
    SELECT sc.id, sc.status, sc.semester, sc.year, sc.grade, sc.grade_points,
           sc.section_id, sc.notes,
           c.id as course_id, c.full_code, c.title, c.credit_hours, c.subject,
           c.prereq_text
    FROM student_courses sc
    JOIN courses c ON c.id = sc.course_id
    WHERE sc.student_id = $1
  `;
  const params = [studentId];
  if (status) { params.push(status); sql += ` AND sc.status = $${params.length}`; }
  if (semester) { params.push(semester); sql += ` AND sc.semester = $${params.length}`; }
  if (year) { params.push(parseInt(year)); sql += ` AND sc.year = $${params.length}`; }
  sql += ' ORDER BY sc.year, CASE sc.semester WHEN \'Spring\' THEN 1 WHEN \'Summer\' THEN 2 ELSE 3 END, c.subject';

  const result = await query(sql, params);
  res.json(result.rows);
}));

// POST /api/students/courses - add course to plan
router.post('/courses', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const { course_id, semester, year, status = 'planned', notes } = req.body;
  if (!course_id || !semester || !year) throw AppError('course_id, semester, and year are required', 400);

  const studentResult = await query('SELECT id, program_id FROM students WHERE user_id = $1', [req.user.id]);
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const { id: studentId, program_id } = studentResult.rows[0];

  // Prerequisite check (with OR group logic)
  const prereqResult = await query(
    `WITH prereq_groups AS (
       SELECT DISTINCT group_id
       FROM course_prerequisites
       WHERE course_id = $1 AND prereq_type = 'required'
     )
     SELECT DISTINCT cp.group_id,
            bool_or(sc.id IS NOT NULL) as group_satisfied
     FROM course_prerequisites cp
     LEFT JOIN student_courses sc ON sc.course_id = cp.requires_course_id
       AND sc.student_id = $2 AND sc.status = 'completed'
     WHERE cp.course_id = $1 AND cp.prereq_type = 'required'
     GROUP BY cp.group_id
     HAVING NOT bool_or(sc.id IS NOT NULL)`,
    [course_id, studentId]
  );

  if (prereqResult.rows.length > 0) {
    // Get the actual missing course codes for the response
    const missingResult = await query(
      `SELECT DISTINCT c.full_code
       FROM course_prerequisites cp
       JOIN courses c ON c.id = cp.requires_course_id
       LEFT JOIN student_courses sc ON sc.course_id = cp.requires_course_id
         AND sc.student_id = $2 AND sc.status = 'completed'
       WHERE cp.course_id = $1 AND cp.prereq_type = 'required'
         AND sc.id IS NULL
         AND cp.group_id IN (
           SELECT group_id FROM course_prerequisites cp2
           LEFT JOIN student_courses sc2 ON sc2.course_id = cp2.requires_course_id
             AND sc2.student_id = $2 AND sc2.status = 'completed'
           WHERE cp2.course_id = $1 AND cp2.prereq_type = 'required'
           GROUP BY cp2.group_id
           HAVING NOT bool_or(sc2.id IS NOT NULL)
         )`, [course_id, studentId]
    );
    return res.status(409).json({
      error: 'Prerequisites not met',
      missing_prerequisites: missingResult.rows.map(r => r.full_code)
    });
  }

  // ── OR group core course restriction ──────────────────────────
  // If this course is in an OR group in the student's program core,
  // check if student has already taken another course from that same OR group
  if (program_id) {
    const orGroupResult = await query(
      `SELECT pcc.or_group_id,
              array_agg(c.full_code) as group_codes,
              array_agg(pcc.course_id) as group_course_ids
       FROM program_core_courses pcc
       JOIN courses c ON c.id = pcc.course_id
       WHERE pcc.program_id = $1
         AND pcc.or_group_id > 0
         AND pcc.or_group_id = (
           SELECT or_group_id FROM program_core_courses
           WHERE program_id = $1 AND course_id = $2 AND or_group_id > 0
           LIMIT 1
         )
       GROUP BY pcc.or_group_id`,
      [program_id, course_id]
    );

    if (orGroupResult.rows.length > 0) {
      const orGroup = orGroupResult.rows[0];
      const groupIds = orGroup.group_course_ids;

      // Check if student already has any course from this OR group (completed or enrolled)
      const alreadyTakenResult = await query(
        `SELECT c.full_code, sc.status
         FROM student_courses sc
         JOIN courses c ON c.id = sc.course_id
         WHERE sc.student_id = $1
           AND sc.course_id = ANY($2::uuid[])
           AND sc.course_id != $3
           AND sc.status IN ('completed', 'enrolled')`,
        [studentId, groupIds, course_id]
      );

      if (alreadyTakenResult.rows.length > 0) {
        const taken = alreadyTakenResult.rows[0];
        return res.status(409).json({
          error: `OR group conflict: You have already ${taken.status} ${taken.full_code} which satisfies this requirement. You cannot enroll in multiple courses from the same OR group.`,
          or_group_conflict: true,
          already_taken: taken.full_code,
          all_group_courses: orGroup.group_codes
        });
      }
    }
  }

  // Check course is valid for student's program (core or elective in their concentration)
  const validityResult = await query(
    `SELECT 'core' as type FROM program_core_courses WHERE program_id=$1 AND course_id=$2
     UNION
     SELECT 'elective' as type FROM concentration_courses cc
     JOIN concentrations conc ON conc.id = cc.concentration_id
     JOIN students s ON s.concentration_id = conc.id
     WHERE s.id=$3 AND cc.course_id=$2`,
    [program_id, course_id, studentId]
  );

  const courseType = validityResult.rows.length > 0 ? validityResult.rows[0].type : 'free_elective';

  const result = await query(
    `INSERT INTO student_courses (student_id, course_id, semester, year, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (student_id, course_id, semester, year) DO UPDATE
     SET status=$5, notes=$6, updated_at=NOW()
     RETURNING *`,
    [studentId, course_id, semester, parseInt(year), status, notes]
  );

  res.status(201).json({ ...result.rows[0], course_type: courseType });
}));

// PATCH /api/students/courses/:id - update course status/grade
router.patch('/courses/:id', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, grade, grade_points, section_id, notes, semester, year } = req.body;

  const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const studentId = studentResult.rows[0].id;

  // Verify ownership
  const ownerCheck = await query('SELECT id FROM student_courses WHERE id=$1 AND student_id=$2', [id, studentId]);
  if (!ownerCheck.rows.length && req.user.role !== 'admin') throw AppError('Course record not found', 404);

  const result = await query(
    `UPDATE student_courses SET
       status = COALESCE($1, status),
       grade = COALESCE($2, grade),
       grade_points = COALESCE($3, grade_points),
       section_id = COALESCE($4, section_id),
       notes = COALESCE($5, notes),
       semester = COALESCE($6, semester),
       year = COALESCE($7::int, year),
       updated_at = NOW()
     WHERE id = $8 RETURNING *`,
    [status, grade, grade_points, section_id, notes, semester, year, id]
  );

  // Recalculate GPA if grade updated
  if (grade_points !== undefined) {
    await query(
      `UPDATE students SET gpa = (
         SELECT ROUND(AVG(sc.grade_points)::numeric, 2)
         FROM student_courses sc
         WHERE sc.student_id = $1 AND sc.grade_points IS NOT NULL AND sc.status = 'completed'
       ), updated_at=NOW() WHERE id = $1`, [studentId]
    );
  }

  res.json(result.rows[0]);
}));

// DELETE /api/students/courses/:id
router.delete('/courses/:id', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const studentId = studentResult.rows[0].id;
  await query(`DELETE FROM student_courses WHERE id=$1 AND student_id=$2`, [req.params.id, studentId]);
  res.json({ message: 'Course removed from plan' });
}));

// GET /api/students/check-prerequisites/:courseId
router.get('/check-prerequisites/:courseId', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const studentResult = await query(
    'SELECT id, program_id FROM students WHERE user_id = $1', [req.user.id]
  );
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const { id: studentId, program_id } = studentResult.rows[0];

  const prereqResult = await query(
    `SELECT c.id, c.full_code, c.title,
            cp.prereq_type, cp.group_id,
            CASE WHEN sc.id IS NOT NULL THEN true ELSE false END as is_met,
            sc.status as student_status
     FROM course_prerequisites cp
     JOIN courses c ON c.id = cp.requires_course_id
     LEFT JOIN student_courses sc ON sc.course_id = cp.requires_course_id
       AND sc.student_id = $1 AND sc.status IN ('completed','enrolled')
     WHERE cp.course_id = $2
     ORDER BY cp.group_id, cp.prereq_type, c.full_code`, [studentId, courseId]
  );

  const groups = {};
  for (const row of prereqResult.rows) {
    if (row.prereq_type !== 'required') continue;
    if (!groups[row.group_id]) groups[row.group_id] = [];
    groups[row.group_id].push(row);
  }
  const allMet = Object.values(groups).every(g => g.some(r => r.is_met));

  // ── Check OR group conflict ────────────────────────────────
  let orGroupConflict = null;
  if (program_id) {
    const orConflictResult = await query(
      `SELECT c_taken.full_code as taken_code, sc.status,
              array_agg(c_group.full_code ORDER BY c_group.full_code) as all_group_courses
       FROM program_core_courses pcc_target
       JOIN program_core_courses pcc_group
         ON pcc_group.program_id = pcc_target.program_id
        AND pcc_group.or_group_id = pcc_target.or_group_id
        AND pcc_group.or_group_id > 0
       JOIN student_courses sc ON sc.course_id = pcc_group.course_id
         AND sc.student_id = $1
         AND sc.status IN ('completed','enrolled')
       JOIN courses c_taken ON c_taken.id = pcc_group.course_id
       JOIN courses c_group ON c_group.id IN (
         SELECT course_id FROM program_core_courses
         WHERE program_id = $2 AND or_group_id = pcc_target.or_group_id
       )
       WHERE pcc_target.program_id = $2
         AND pcc_target.course_id = $3
         AND pcc_group.course_id != $3
       GROUP BY c_taken.full_code, sc.status
       LIMIT 1`,
      [studentId, program_id, courseId]
    );

    if (orConflictResult.rows.length > 0) {
      const row = orConflictResult.rows[0];
      orGroupConflict = {
        blocked: true,
        reason: `You have already ${row.status} ${row.taken_code} which satisfies this OR group requirement.`,
        already_taken: row.taken_code,
        all_group_courses: row.all_group_courses
      };
    }
  }

  res.json({
    can_enroll: allMet && !orGroupConflict,
    prerequisites: prereqResult.rows,
    groups,
    or_group_conflict: orGroupConflict
  });
}));

// GET /api/students/eligible-courses - courses student can take next
router.get('/eligible-courses', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const studentResult = await query(
    'SELECT id, program_id, concentration_id FROM students WHERE user_id = $1', [req.user.id]
  );
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const { id: studentId, program_id, concentration_id } = studentResult.rows[0];

  // Get all courses in program (core + concentration electives) not yet taken
  const result = await query(
    `SELECT DISTINCT c.id, c.full_code, c.title, c.credit_hours, c.prereq_text,
            CASE WHEN pcc.course_id IS NOT NULL THEN 'core' ELSE 'elective' END as course_type,
            -- Check if all required prereq GROUPS are met
            -- Within a group, only ONE course needs to be completed (OR logic)
            -- Across groups, ALL groups must be satisfied (AND logic)
            NOT EXISTS (
              SELECT 1 FROM (
                SELECT DISTINCT group_id
                FROM course_prerequisites
                WHERE course_id = c.id AND prereq_type = 'required'
              ) grp
              WHERE NOT EXISTS (
                SELECT 1 FROM course_prerequisites cp2
                JOIN student_courses sc2 ON sc2.course_id = cp2.requires_course_id
                WHERE cp2.course_id = c.id
                  AND cp2.prereq_type = 'required'
                  AND cp2.group_id = grp.group_id
                  AND sc2.student_id = $1
                  AND sc2.status = 'completed'
              )
            ) as prereqs_met
     FROM courses c
     LEFT JOIN program_core_courses pcc ON pcc.course_id = c.id AND pcc.program_id = $2
     LEFT JOIN concentration_courses cc ON cc.course_id = c.id
     LEFT JOIN concentrations conc ON conc.id = cc.concentration_id AND conc.id = $3
     WHERE c.is_active = true
       AND (pcc.program_id IS NOT NULL OR conc.id IS NOT NULL)
       AND c.id NOT IN (
         SELECT course_id FROM student_courses
         WHERE student_id = $1 AND status IN ('completed','enrolled','planned')
       )
     ORDER BY course_type DESC, prereqs_met DESC, c.subject, c.course_number`,
    [studentId, program_id, concentration_id]
  );

  res.json(result.rows);
}));

// PUT /api/students/profile - update student profile
router.put('/profile', requireStudentOrAdmin, asyncHandler(async (req, res) => {
  const { program_id, concentration_id, enrollment_year, enrollment_semester,
          expected_graduation, is_full_time } = req.body;

  const result = await query(
    `UPDATE students SET
       program_id = COALESCE($1, program_id),
       concentration_id = COALESCE($2, concentration_id),
       enrollment_year = COALESCE($3, enrollment_year),
       enrollment_semester = COALESCE($4, enrollment_semester),
       expected_graduation = COALESCE($5, expected_graduation),
       is_full_time = COALESCE($6, is_full_time),
       updated_at = NOW()
     WHERE user_id = $7 RETURNING *`,
    [program_id, concentration_id, enrollment_year, enrollment_semester,
     expected_graduation, is_full_time, req.user.id]
  );
  if (!result.rows.length) throw AppError('Student profile not found', 404);
  res.json(result.rows[0]);
}));

module.exports = router;

