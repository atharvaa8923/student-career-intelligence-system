// Signup must never let a client choose its role. Since STEP-04 the handler
// delegates to Supabase Auth; the role is granted afterwards by the
// enroll_application RPC, which accepts only a fixed application name.
// Runs the real handler and the real Supabase adapter with network stubs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const SRC = path.join(__dirname, '../jsom-planner/backend/src');
const REQUESTED_ROLES = [undefined, 'student', 'admin', 'professor', { admin: true }, ['admin']];

function load(file, mocks, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SRC, file), 'utf8'), {
    require: name => { if (!(name in mocks)) throw Error(`unexpected require: ${name}`); return mocks[name]; },
    module, exports: module.exports, process: { env: {} }, ...extra,
  });
  return module.exports;
}

test('JSOM register ignores client-supplied roles', async () => {
  for (const requestedRole of REQUESTED_ROLES) {
    const routes = {}; const calls = [];
    const chain = new Proxy(() => {}, { get: () => () => chain });
    load('routes/auth.js', {
      express: { Router: () => ({ post: (p, ...args) => { routes[p] = args.at(-1); }, get: () => {} }) },
      'express-validator': { body: () => chain, validationResult: () => ({ isEmpty: () => true }) },
      '../db': { query: async () => ({ rows: [] }), runAsUser: (id, fn) => fn() },
      '../middleware/auth': { authenticateToken: () => {} },
      '../middleware/errorHandler': { asyncHandler: fn => fn, AppError: Error },
      '../services/auditService': { logAudit: async () => {} },
      '../services/supabaseAuth': {
        signUp: async (...args) => { calls.push(['signUp', args]); return { access_token: 'tok', refresh_token: 'r', user: { id: 'u1', email: args[0] } }; },
        enroll: async (...args) => { calls.push(['enroll', args]); },
      },
      '../services/identityService': {
        resolveLocalUser: async (user, defaults) => { calls.push(['resolveLocalUser', [defaults]]); return { id: user.id, email: user.email }; },
        applicationRole: async () => 'student',
      },
    });
    let status; let body;
    const res = { status: code => { status = code; return res; }, json: b => { body = b; } };
    await routes['/register']({ body: { email: 'test@utdallas.edu', password: 'test-password-1', firstName: 'Test', lastName: 'Student', role: requestedRole } }, res);
    assert.equal(status, 201);
    assert.equal(body.user.role, 'student');
    assert.deepEqual(calls[0], ['signUp', ['test@utdallas.edu', 'test-password-1', 'Test Student']]);
    assert.deepEqual(calls[1], ['enroll', ['tok']]);
    for (const [, args] of calls) for (const arg of args) if (arg && typeof arg === 'object') assert.ok(!('role' in arg), 'role must not be forwarded');
  }
});

test('Supabase adapter sends no role in signup and a fixed application to enroll', async () => {
  const sent = [];
  const fetch = async (url, init) => { sent.push({ url, body: init.body ? JSON.parse(init.body) : null }); return { ok: true, json: async () => ({}) }; };
  const adapter = load('services/supabaseAuth.js', { '../middleware/errorHandler': { AppError: Error } }, {
    fetch, URLSearchParams, process: { env: { SUPABASE_URL: 'https://example.invalid', SUPABASE_PUBLISHABLE_KEY: 'test' } },
  });
  await adapter.signUp('a@utdallas.edu', 'pw', 'A B');
  await adapter.enroll('tok');
  assert.deepEqual(sent[0].body, { email: 'a@utdallas.edu', password: 'pw', data: { full_name: 'A B' } });
  assert.match(sent[1].url, /\/rest\/v1\/rpc\/enroll_application$/);
  assert.deepEqual(sent[1].body, { target_application: 'jsom_planner' });
});
