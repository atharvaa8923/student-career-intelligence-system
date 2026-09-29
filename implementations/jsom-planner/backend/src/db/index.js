const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');

const requestIdentity = new AsyncLocalStorage();

if (process.env.NODE_ENV === 'production' && !process.env.DB_SSL_CA) {
  throw new Error('DB_SSL_CA must point to the Supabase root certificate in production');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true, ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✓ Database connected'))
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
    console.error('  Check DATABASE_URL in .env');
  });

/**
 * Execute a query with automatic error wrapping
 */
async function query(text, params) {
  const start = Date.now();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const identity = requestIdentity.getStore();
    if (identity?.userId) {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [identity.userId]);
    } else {
      await client.query('SET LOCAL ROLE anon');
    }
    await client.query("SELECT set_config('search_path', 'api_jsom,catalog,planner,public', true)");
    const result = await client.query(text, params);
    await client.query('COMMIT');
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text.slice(0, 100));
    }
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Database query error:', { query: text.slice(0, 100), error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Execute multiple queries in a transaction
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const identity = requestIdentity.getStore();
    if (identity?.userId) {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [identity.userId]);
    } else {
      await client.query('SET LOCAL ROLE anon');
    }
    await client.query("SELECT set_config('search_path', 'api_jsom,catalog,planner,public', true)");
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function runAsUser(userId, callback) {
  return requestIdentity.run({ userId }, callback);
}

module.exports = { pool, query, withTransaction, runAsUser };
