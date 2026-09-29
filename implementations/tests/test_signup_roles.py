"""Execute the actual signup handler with database/hash dependencies stubbed.
This does not test HTTP middleware, password hashing or a live database.
"""
import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest

class SignupRoles(unittest.TestCase):
    def test_syllabus_role_is_server_assigned(self):
        source = Path(__file__).parents[1] / 'syllabus-check/backend/api/routes/auth.py'
        tree = ast.parse(source.read_text())
        handler = next(n for n in tree.body if isinstance(n, ast.AsyncFunctionDef) and n.name == 'register')
        handler.decorator_list = []
        handler.returns = None
        handler.args.defaults = []
        for arg in handler.args.args:
            arg.annotation = None
        class User:
            email = ''
            def __init__(self, **kwargs): self.__dict__.update(kwargs); self.id = 'test-user'
        class DB:
            async def execute(self, query): return SimpleNamespace(scalar_one_or_none=lambda: None)
            def add(self, user): self.saved = user
            async def commit(self): pass
            async def refresh(self, user): pass
        env = dict(User=User, select=lambda *args: SimpleNamespace(where=lambda *args: None),
                   hash_password=lambda password:'test-hash', UserResponse=lambda **kwargs:kwargs)
        exec(compile(ast.Module(body=[handler], type_ignores=[]), str(source), 'exec'),env)
        for role in [None, 'professor', 'admin', 'student', {'admin':True}]:
            with self.subTest(role=role):
                db=DB()
                body=SimpleNamespace(email='test@example.com',password='test-password',full_name='Test',role=role)
                result=asyncio.run(env['register'](body,db))
                self.assertEqual(db.saved.role,'professor')
                self.assertEqual(result['role'],'professor')

if __name__ == '__main__': unittest.main()
