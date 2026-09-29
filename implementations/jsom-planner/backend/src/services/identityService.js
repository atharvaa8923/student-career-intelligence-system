const { query } = require('../db');

function names(authUser) {
  const parts = String(authUser.user_metadata?.full_name || '').trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || 'Member', last_name: parts.slice(1).join(' ') || 'User' };
}

async function resolveLocalUser(authUser, defaults = {}) {
  let result = await query('SELECT id, user_id, program_id, concentration_id FROM students WHERE user_id=$1', [authUser.id]);
  if (!result.rows.length) {
    result = await query(
      `INSERT INTO students(user_id,program_id) VALUES($1,$2)
       RETURNING id,user_id,program_id,concentration_id`, [authUser.id, defaults.programId || null]);
  }
  const profile = names(authUser);
  return {
    ...result.rows[0], id: authUser.id, email: authUser.email,
    first_name: defaults.firstName || profile.first_name,
    last_name: defaults.lastName || profile.last_name,
    student_id: result.rows[0].id, is_active: true
  };
}

async function applicationRole(token) {
  const assigned = await require('./supabaseAuth').roles(token);
  const own = assigned.filter(item => item.application === 'jsom_planner').map(item => item.role);
  return own.includes('admin') ? 'admin' : 'student';
}

module.exports = { resolveLocalUser, applicationRole };
