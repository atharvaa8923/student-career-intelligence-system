"""Small server-side adapter for Supabase Auth and protected role RPCs."""
import httpx
from fastapi import HTTPException
from core.config import settings


async def request(path: str, *, method: str = "GET", token: str | None = None, body: dict | None = None):
    if not settings.SUPABASE_URL or not settings.SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured")
    headers = {"apikey": settings.SUPABASE_PUBLISHABLE_KEY}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.request(method, f"{settings.SUPABASE_URL.rstrip('/')}{path}", headers=headers, json=body)
    data = response.json() if response.content else {}
    if response.is_error:
        detail = data.get("msg") or data.get("message") or data.get("error_description") or "Authentication failed"
        raise HTTPException(status_code=response.status_code, detail=detail)
    return data


async def sign_up(email: str, password: str, full_name: str):
    return await request("/auth/v1/signup", method="POST", body={"email": email, "password": password, "data": {"full_name": full_name}})


async def sign_in(email: str, password: str):
    return await request("/auth/v1/token?grant_type=password", method="POST", body={"email": email, "password": password})


async def refresh_session(refresh_token: str):
    return await request("/auth/v1/token?grant_type=refresh_token", method="POST", body={"refresh_token": refresh_token})


async def auth_user(token: str):
    return await request("/auth/v1/user", token=token)


async def enroll(token: str):
    return await request("/rest/v1/rpc/enroll_application", method="POST", token=token, body={"target_application": "syllabus_check"})


async def app_roles(token: str):
    return await request("/rest/v1/rpc/get_my_app_roles", method="POST", token=token, body={})


async def sign_out(token: str):
    return await request("/auth/v1/logout?scope=local", method="POST", token=token)
