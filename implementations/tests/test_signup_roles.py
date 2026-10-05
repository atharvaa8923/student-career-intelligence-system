"""SyllabusCheck signup must never let a client choose its role (standard library only).

Since STEP-04 registration delegates to Supabase Auth and the baseline role is
granted by enroll_application with a fixed application name. This executes the
real register handler with the Supabase adapter stubbed, and statically checks
the request schema and the adapter. It does not test HTTP or a live database.
"""
import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest

BACKEND = Path(__file__).parents[1] / 'syllabus-check/backend'
AUTH = BACKEND / 'api/routes/auth.py'
ADAPTER = BACKEND / 'core/supabase_auth.py'


def module_tree(path):
    return ast.parse(path.read_text())


def find(tree, kind, name):
    return next(n for n in tree.body if isinstance(n, kind) and n.name == name)


class SignupRoles(unittest.TestCase):
    def test_register_request_has_no_role_field(self):
        cls = find(module_tree(AUTH), ast.ClassDef, 'RegisterRequest')
        fields = {n.target.id for n in cls.body if isinstance(n, ast.AnnAssign)}
        self.assertEqual(fields, {'email', 'password', 'full_name'})

    def test_register_forwards_no_role(self):
        handler = find(module_tree(AUTH), ast.AsyncFunctionDef, 'register')
        handler.decorator_list, handler.returns, handler.args.defaults = [], None, []
        for arg in handler.args.args:
            arg.annotation = None
        calls = []

        class Supabase:
            async def sign_up(self, *args):
                calls.append(('sign_up', args))
                return {'access_token': 'tok', 'user': {'id': 'u1'}}

            async def enroll(self, *args):
                calls.append(('enroll', args))

        async def effective_role(token):
            return 'professor'

        env = dict(supabase_auth=Supabase(), effective_role=effective_role,
                   HTTPException=Exception, UserResponse=lambda **kw: kw)
        exec(compile(ast.Module(body=[handler], type_ignores=[]), str(AUTH), 'exec'), env)
        for role in [None, 'professor', 'admin', 'catalog_editor', {'admin': True}]:
            with self.subTest(role=role):
                calls.clear()
                body = SimpleNamespace(email='test@example.com', password='test-password-1',
                                       full_name='Test', role=role)
                result = asyncio.run(env['register'](body, None))
                self.assertEqual(result['role'], 'professor')
                self.assertEqual(calls, [('sign_up', ('test@example.com', 'test-password-1', 'Test')),
                                         ('enroll', ('tok',))])

    def test_adapter_enrolls_fixed_application_and_sends_no_role(self):
        source = ADAPTER.read_text()
        self.assertIn('{"target_application": "syllabus_check"}', source)
        sign_up = ast.get_source_segment(source, find(module_tree(ADAPTER), ast.AsyncFunctionDef, 'sign_up'))
        self.assertIn('"data": {"full_name": full_name}', sign_up)
        self.assertNotIn('role', sign_up)


if __name__ == '__main__':
    unittest.main()
