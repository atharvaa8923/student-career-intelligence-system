"""Authenticated access to private Supabase Storage objects."""
from urllib.parse import quote
import httpx
from fastapi import HTTPException
from core.config import settings


def _headers(token: str, content_type: str | None = None) -> dict:
    headers = {"apikey": settings.SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
        headers["x-upsert"] = "true"
    return headers


async def upload(bucket: str, path: str, content: bytes, token: str, content_type: str) -> str:
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{quote(path, safe='/')}"
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(url, headers=_headers(token, content_type), content=content)
    if response.is_error:
        raise HTTPException(response.status_code, "Private file upload failed")
    return path


async def download(bucket: str, path: str, token: str) -> bytes:
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/authenticated/{bucket}/{quote(path, safe='/')}"
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url, headers=_headers(token))
    if response.is_error:
        raise HTTPException(response.status_code, "Private file not found")
    return response.content


async def remove(bucket: str, paths: list[str], token: str) -> None:
    if not paths:
        return
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request("DELETE", url, headers={**_headers(token), "Content-Type": "application/json"}, json={"prefixes": paths})
    if response.is_error and response.status_code != 404:
        raise HTTPException(response.status_code, "Private file deletion failed")
