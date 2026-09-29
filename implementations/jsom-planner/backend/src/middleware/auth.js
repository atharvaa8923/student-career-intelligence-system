const supabase = require('../services/supabaseAuth');
const { resolveLocalUser, applicationRole } = require('../services/identityService');
const { runAsUser } = require('../db');

async function authenticateToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const authUser = await supabase.getAuthUser(token);
    return runAsUser(authUser.id, async () => {
      const local = await resolveLocalUser(authUser);
      req.accessToken = token;
      req.authUser = authUser;
      req.user = { ...local, role: await applicationRole(token) };
      next();
    });
  } catch (error) {
    const expired = error.code === 'bad_jwt' || error.statusCode === 401;
    return res.status(401).json({ error: 'Invalid or expired token', ...(expired && { code: 'TOKEN_EXPIRED' }) });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
function requireStudentOrAdmin(req, res, next) {
  if (!['student', 'admin'].includes(req.user?.role)) return res.status(403).json({ error: 'Access denied' });
  next();
}

module.exports = { authenticateToken, requireAdmin, requireStudentOrAdmin };
