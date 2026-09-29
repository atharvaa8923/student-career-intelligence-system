const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logAudit } = require('../services/auditService');
const supabase = require('../services/supabaseAuth');
const { resolveLocalUser, applicationRole } = require('../services/identityService');
const { runAsUser } = require('../db');

const router = express.Router();
const userView = (user, role = user.role) => ({ id: user.id, email: user.email, role, firstName: user.first_name, lastName: user.last_name, studentId: user.student_id, programId: user.program_id, concentrationId: user.concentration_id });
const sessionView = session => ({ token: session.access_token, accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: session.expires_at });

router.post('/register', [
  body('email').isEmail().normalizeEmail().custom(v => { if (!v.endsWith('@utdallas.edu')) throw new Error('Must use UTD email address'); return true; }),
  body('password').isLength({ min: 8 }), body('firstName').trim().notEmpty(), body('lastName').trim().notEmpty(), body('utdId').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password, firstName, lastName, utdId, programId } = req.body;
  const auth = await supabase.signUp(email, password, `${firstName} ${lastName}`);
  if (!auth.access_token) return res.status(202).json({ message: 'Check your email to confirm the account', requiresEmailConfirmation: true });
  await supabase.enroll(auth.access_token);
  const local = await runAsUser(auth.user.id, () => resolveLocalUser(auth.user, { firstName, lastName, utdId, programId }));
  res.status(201).json({ message: 'Account created successfully', ...sessionView(auth), user: userView(local, await applicationRole(auth.access_token)) });
}));

router.post('/login', [body('email').isEmail().normalizeEmail(), body('password').notEmpty()], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const auth = await supabase.signIn(req.body.email, req.body.password);
  await supabase.enroll(auth.access_token);
  const local = await runAsUser(auth.user.id, () => resolveLocalUser(auth.user));
  const role = await applicationRole(auth.access_token);
  await logAudit(local.id, 'LOGIN', 'user', local.id, null, null, req.ip);
  res.json({ ...sessionView(auth), user: userView(local, role) });
}));

router.post('/refresh', [body('refreshToken').notEmpty()], asyncHandler(async (req, res) => {
  const auth = await supabase.refreshSession(req.body.refreshToken);
  res.json(sessionView(auth));
}));

router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  await supabase.signOut(req.accessToken);
  res.status(204).end();
}));

router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const result = await query(`SELECT s.id student_id,s.program_id,s.concentration_id,s.enrollment_year,s.enrollment_semester,
    s.expected_graduation,s.gpa,s.is_full_time,p.program_name,p.total_sch,p.program_type,p.is_stem,c.name concentration_name
    FROM students s LEFT JOIN programs p ON p.id=s.program_id LEFT JOIN concentrations c ON c.id=s.concentration_id
    WHERE s.user_id=$1`, [req.user.id]);
  if (!result.rows.length) throw AppError('User not found', 404);
  const u = result.rows[0];
  res.json({ ...userView(req.user, req.user.role), enrollmentYear: u.enrollment_year, enrollmentSemester: u.enrollment_semester, expectedGraduation: u.expected_graduation, gpa: u.gpa, isFullTime: u.is_full_time, programName: u.program_name, totalSch: u.total_sch, programType: u.program_type, isStem: u.is_stem, concentrationName: u.concentration_name });
}));

router.post('/change-password', authenticateToken, [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 })], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  await supabase.signIn(req.user.email, req.body.currentPassword);
  await supabase.updatePassword(req.accessToken, req.body.newPassword);
  res.json({ message: 'Password updated successfully' });
}));

module.exports = router;
