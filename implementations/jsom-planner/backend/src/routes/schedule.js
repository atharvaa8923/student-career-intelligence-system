const express = require('express');
const { query } = require('../db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/schedule - student's current semester schedule
router.get('/', asyncHandler(async (req, res) => {
  const { semester, year } = req.query;
  const currentYear = new Date().getFullYear();
  const currentSemester = semester || getCurrentSemester();
  const schedYear = year ? parseInt(year) : currentYear;

  const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);
  const studentId = studentResult.rows[0].id;

  const result = await query(
    `SELECT sc.id, sc.status, sc.semester, sc.year, sc.section_id, sc.notes,
            c.id as course_id, c.full_code, c.title, c.credit_hours,
            cs.professor, cs.days, cs.start_time, cs.end_time,
            cs.location, cs.modality, cs.seats_total, cs.seats_filled
     FROM student_courses sc
     JOIN courses c ON c.id = sc.course_id
     LEFT JOIN course_sections cs ON cs.nebula_id = sc.section_id
     WHERE sc.student_id = $1 AND sc.semester = $2 AND sc.year = $3
     ORDER BY cs.start_time NULLS LAST, c.subject`,
    [studentId, currentSemester, schedYear]
  );

  // Check for time conflicts
  const conflicts = detectConflicts(result.rows);

  res.json({
    semester: currentSemester,
    year: schedYear,
    courses: result.rows,
    total_sch: result.rows.reduce((sum, r) => sum + (r.credit_hours || 0), 0),
    conflicts
  });
}));

// GET /api/schedule/sections/:courseId - available sections for a course
router.get('/sections/:courseId', asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { semester, year } = req.query;
  const currentSemester = semester || getCurrentSemester();
  const schedYear = year ? parseInt(year) : new Date().getFullYear();

  // Try cached sections first
  const cachedResult = await query(
    `SELECT * FROM course_sections
     WHERE course_id = $1 AND semester = $2 AND year = $3
     ORDER BY start_time`,
    [courseId, currentSemester, schedYear]
  );

  if (cachedResult.rows.length > 0) {
    return res.json({ sections: cachedResult.rows, source: 'cache' });
  }

  // Fetch from Nebula API if no cache
  try {
    const nebulaData = await fetchNebulaCourseSections(courseId, currentSemester, schedYear);
    res.json({ sections: nebulaData, source: 'nebula_api' });
  } catch (err) {
    res.json({ sections: [], source: 'none', message: 'Sections not available' });
  }
}));

// POST /api/schedule/enroll - enroll in a specific section (deep-link to Galaxy)
router.post('/enroll', asyncHandler(async (req, res) => {
  const { student_course_id, section_id } = req.body;

  const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.id]);
  if (!studentResult.rows.length) throw AppError('Student profile not found', 404);

  // Update section_id on student course record
  await query(
    `UPDATE student_courses SET section_id=$1, status='enrolled', updated_at=NOW()
     WHERE id=$2 AND student_id=$3`,
    [section_id, student_course_id, studentResult.rows[0].id]
  );

  // Build Galaxy deep link
  const galaxyUrl = buildGalaxyLink(section_id);

  res.json({
    message: 'Course marked as enrolled. Redirecting to UTD Galaxy to confirm.',
    galaxy_url: galaxyUrl,
    section_id
  });
}));

// Time conflict detection
function detectConflicts(courses) {
  const conflicts = [];
  const scheduled = courses.filter(c => c.days && c.start_time && c.end_time);

  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i];
      const b = scheduled[j];
      // Check day overlap
      const aDays = parseDays(a.days);
      const bDays = parseDays(b.days);
      const sharedDays = aDays.filter(d => bDays.includes(d));
      if (sharedDays.length > 0) {
        // Check time overlap
        if (timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
          conflicts.push({
            course_a: a.full_code,
            course_b: b.full_code,
            days: sharedDays,
            message: `${a.full_code} and ${b.full_code} overlap on ${sharedDays.join(',')}`
          });
        }
      }
    }
  }
  return conflicts;
}

function parseDays(daysStr) {
  if (!daysStr) return [];
  const map = { 'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'F': 'Fri', 'S': 'Sat' };
  return daysStr.split('').map(d => map[d]).filter(Boolean);
}

function timesOverlap(start1, end1, start2, end2) {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return start1 < end2 && end1 > start2;
}

function getCurrentSemester() {
  const month = new Date().getMonth() + 1;
  if (month >= 1 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 7) return 'Summer';
  return 'Fall';
}

function buildGalaxyLink(sectionId) {
  return `https://galaxy.utdallas.edu/psp/GALAXY/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A&ACAD_CAREER=GRAD&EMPLID=&strm=&CLASS_NBR=${sectionId || ''}`;
}

async function fetchNebulaCourseSections(courseId, semester, year) {
  // Would call Nebula API - returning empty array as Nebula API key required
  return [];
}

module.exports = router;
