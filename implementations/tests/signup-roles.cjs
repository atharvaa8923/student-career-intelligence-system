const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('JSOM signup always persists a student and creates their student record', async () => {
  for (const requestedRole of [undefined, 'student', 'admin', 'professor', {admin:true}]) {
    const routes = {}; const writes = [];
    const chain = new Proxy(() => {}, {get: () => () => chain});
    const mocks = {
      express: {Router: () => ({post: (p,...args) => {routes[p] = args.at(-1)}, get: () => {}})},
      bcryptjs: {hash: async () => 'test-hash'},
      'express-validator': {body: () => chain, validationResult: () => ({isEmpty: () => true})},
      '../db': {withTransaction: async fn => fn({query: async (sql,params) => {
        writes.push({sql,params});
        return {rows: [{id:'test-user',role:params[2], email:params[0]}]};
      }})},
      '../middleware/auth': {generateToken: (id,role) => role},
      '../middleware/errorHandler': {asyncHandler: fn => fn},
      '../services/auditService': {logAudit: async () => {}}
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../jsom-planner/backend/src/routes/auth.js'),'utf8'), {
      require: name => {if (!(name in mocks)) throw Error(name); return mocks[name]}, module:{exports:{}}
    });
    let response;
    const res = {status: code => {assert.equal(code,201); return res}, json: body => {response=body}};
    await routes['/register']({body:{email:'test@utdallas.edu',password:'test-password',firstName:'Test',lastName:'Student',role:requestedRole}},res);
    assert.equal(writes[0].params[2],'student');
    assert.match(writes[1].sql,/INSERT INTO students/);
    assert.equal(response.user.role,'student');
    assert.equal(response.token,'student');
  }
});
