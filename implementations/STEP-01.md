# Step 01 — Server-controlled signup roles

Status: implemented in workspace copies; awaiting user review before step 02.

JSOM public registration now always persists student, regardless of a submitted role field. Student profile creation and issued token use that role. Its registration page no longer offers administrator signup or sends a role.

SyllabusCheck public registration now assigns the existing professor role on the server; role is removed from the request schema. Extra role fields cannot change the saved role. This preserves the application's current professor-facing signup behavior; it does not verify faculty affiliation.

Existing accounts are unchanged. This patch does not revoke previously created administrator accounts; a live deployment should review those accounts separately. No live database was connected or altered.

Source locations:
- syllabus-check/backend/api/routes/auth.py
- jsom-planner/backend/src/routes/auth.js
- jsom-planner/frontend/src/pages/auth/RegisterPage.jsx

Validation: Node registration-handler regression test and Python registration-handler regression test passed, exercising five role inputs each, including admin and a malformed role object. Database, hashing, token generation and middleware dependencies were stubbed. JavaScript syntax and updated JSX parsing passed. These are focused role-assignment tests, not live HTTP/database or full application build tests.

Run from the Agents workspace:
```
node --test implementations/tests/signup-roles.cjs
python3 -m unittest discover -s implementations/tests -p 'test_*.py'
```

Original Downloads folders remain unchanged. Continue development in these workspace copies.

Next proposed implementation: reconcile missing database columns and migration order, verify a fresh schema, then pause for approval again. Supabase Auth and provisioning come after that review.
