"""Static authorization guard for SyllabusCheck routes (standard library only).

Every route must depend on get_current_user or require_admin unless it is in
PUBLIC. Routes that enqueue background work or touch other users' data must
depend on require_admin. This guards the Phase 1 fix for unauthenticated
mutation routes (inventory risk R-1/R-5); it does not replace HTTP tests.
"""
import ast
from pathlib import Path
import unittest

ROUTES = Path(__file__).resolve().parents[1] / 'syllabus-check/backend/api/routes'

PUBLIC = {
    ('health.py', 'GET', '/health'),
    ('auth.py', 'POST', '/register'),
    ('auth.py', 'POST', '/login'),
    ('auth.py', 'POST', '/refresh'),
}

ADMIN_ONLY = {
    ('jobs.py', 'POST', '/scrape'),
    ('jobs.py', 'POST', '/admin/trigger-keyword-extraction'),
    ('jobs.py', 'POST', '/admin/trigger-keyword-extraction-today'),
    ('jobs.py', 'POST', '/reparse-all'),
    ('jobs.py', 'POST', '/recompute-coverage-all'),
    ('jobs.py', 'POST', '/reparse-empty'),
    ('keywords.py', 'POST', '/classify-subdomains'),
    ('keywords.py', 'POST', '/backfill-embeddings'),
}


def routes():
    for path in sorted(ROUTES.glob('*.py')):
        tree = ast.parse(path.read_text())
        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for deco in node.decorator_list:
                if (isinstance(deco, ast.Call) and isinstance(deco.func, ast.Attribute)
                        and isinstance(deco.func.value, ast.Name) and deco.func.value.id == 'router'
                        and deco.args and isinstance(deco.args[0], ast.Constant)):
                    yield path.name, deco.func.attr.upper(), deco.args[0].value, node


def dependencies(func):
    names = set()
    defaults = func.args.defaults + [d for d in func.args.kw_defaults if d is not None]
    for default in defaults:
        if (isinstance(default, ast.Call) and isinstance(default.func, ast.Name)
                and default.func.id == 'Depends' and default.args
                and isinstance(default.args[0], ast.Name)):
            names.add(default.args[0].id)
    return names


class RouteAuthorization(unittest.TestCase):
    def test_routes_were_found(self):
        self.assertGreater(len(list(routes())), 30)

    def test_every_non_public_route_requires_identity(self):
        for file, method, path, func in routes():
            if (file, method, path) in PUBLIC:
                continue
            with self.subTest(route=f'{method} {file}:{path}'):
                self.assertTrue(dependencies(func) & {'get_current_user', 'require_admin', 'oauth2_scheme'},
                                f'{method} {path} in {file} has no authentication dependency')

    def test_admin_routes_require_admin(self):
        found = {(f, m, p): fn for f, m, p, fn in routes()}
        for key in ADMIN_ONLY:
            with self.subTest(route=key):
                self.assertIn(key, found, 'admin route missing; update ADMIN_ONLY if it was renamed')
                self.assertIn('require_admin', dependencies(found[key]))


if __name__ == '__main__':
    unittest.main()
