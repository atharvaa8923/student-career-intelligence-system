"""HTTP-level authorization tests against the real FastAPI app.

Needs the backend requirements (except the ML packages); no database, Redis,
or Supabase is contacted because every request is rejected before a handler
or a query runs. Complements implementations/tests/test_route_authorization.py.
"""
import os
import re

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:1/test")

import pytest

pytest.importorskip("fastapi", reason="backend requirements not installed; CI job backend-http runs this")
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from api.routes import auth as auth_routes
from models.models import User

PUBLIC = {("GET", "/api/health"), ("POST", "/api/auth/register"), ("POST", "/api/auth/login"),
          ("POST", "/api/auth/refresh")}

ADMIN_ONLY = [
    ("POST", "/api/jobs/scrape"),
    ("POST", "/api/jobs/admin/trigger-keyword-extraction"),
    ("POST", "/api/jobs/admin/trigger-keyword-extraction-today"),
    ("POST", "/api/jobs/reparse-all"),
    ("POST", "/api/jobs/recompute-coverage-all"),
    ("POST", "/api/jobs/reparse-empty"),
    ("POST", "/api/keywords/classify-subdomains"),
    ("POST", "/api/keywords/backfill-embeddings"),
]

UUID = "00000000-0000-0000-0000-000000000001"


def operations():
    for path, item in main.app.openapi()["paths"].items():
        for method in item:
            if method.upper() in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                yield method.upper(), path


@pytest.fixture
def client():
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c
    main.app.dependency_overrides.clear()


def test_openapi_lists_expected_surface():
    ops = set(operations())
    assert len(ops) > 30
    for op in ADMIN_ONLY:
        assert op in ops


@pytest.mark.parametrize("method,path", sorted(set(operations()) - PUBLIC))
def test_anonymous_requests_are_rejected(client, method, path):
    url = re.sub(r"\{[^}]+\}", UUID, path)
    response = client.request(method, url)
    assert response.status_code == 401, f"{method} {path} -> {response.status_code}"


@pytest.mark.parametrize("method,path", ADMIN_ONLY)
def test_non_admin_requests_are_forbidden(client, method, path):
    professor = User(id=UUID, email="prof@example.com", full_name="Prof", role="professor", access_token="x")
    main.app.dependency_overrides[auth_routes.get_current_user] = lambda: professor
    response = client.request(method, path)
    assert response.status_code == 403, f"{method} {path} -> {response.status_code}"
