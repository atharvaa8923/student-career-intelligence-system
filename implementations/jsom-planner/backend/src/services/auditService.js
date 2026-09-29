const { query } = require('../db');

async function logAudit(userId, action, entityType, entityId, oldData, newData, ipAddress) {
  try {
    await query(
      `SELECT public.log_app_event($1,$2,$3,$4,$5,$6::inet)`,
      [action, entityType, entityId,
       oldData ? JSON.stringify(oldData) : null,
       newData ? JSON.stringify(newData) : null,
       ipAddress || null]
    );
  } catch (err) {
    // Audit failures must never break main flow
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
