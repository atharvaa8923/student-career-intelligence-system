"""Authentication routes backed by hosted Supabase Auth."""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core import supabase_auth
from core.database import get_db
from models.models import User

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: int | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    requires_email_confirmation: bool = False


async def establish_user_context(auth_user: dict, token: str, db: AsyncSession) -> User:
    await db.execute(text("SET LOCAL ROLE authenticated"))
    await db.execute(text("SELECT set_config('request.jwt.claim.sub', :uid, true)"), {"uid": auth_user["id"]})
    await db.execute(text("SELECT set_config('search_path', 'api_syllabus,syllabus,catalog,public', true)"))
    display = auth_user.get("user_metadata", {}).get("full_name") or auth_user["email"].split("@", 1)[0]
    return User(id=auth_user["id"], email=auth_user["email"].lower(), full_name=display, role=await effective_role(token), access_token=token)


async def effective_role(token: str) -> str:
    roles = await supabase_auth.app_roles(token)
    own = {item["role"] for item in roles if item["application"] == "syllabus_check"}
    return "admin" if "admin" in own else "catalog_editor" if "catalog_editor" in own else "professor"


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    auth_user = await supabase_auth.auth_user(token)
    return await establish_user_context(auth_user, token, db)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    auth = await supabase_auth.sign_up(body.email, body.password, body.full_name)
    if not auth.get("access_token"):
        return UserResponse(id=auth["user"]["id"], email=body.email, full_name=body.full_name, role="professor", requires_email_confirmation=True)
    await supabase_auth.enroll(auth["access_token"])
    return UserResponse(id=auth["user"]["id"], email=body.email, full_name=body.full_name, role=await effective_role(auth["access_token"]))


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    auth = await supabase_auth.sign_in(form.username, form.password)
    await supabase_auth.enroll(auth["access_token"])
    return TokenResponse(access_token=auth["access_token"], refresh_token=auth["refresh_token"], expires_at=auth.get("expires_at"))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    auth = await supabase_auth.refresh_session(body.refresh_token)
    return TokenResponse(access_token=auth["access_token"], refresh_token=auth["refresh_token"], expires_at=auth.get("expires_at"))


@router.post("/logout", status_code=204)
async def logout(token: str = Depends(oauth2_scheme)):
    await supabase_auth.sign_out(token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role)
