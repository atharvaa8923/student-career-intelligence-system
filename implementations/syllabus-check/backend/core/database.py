"""
Database setup — async SQLAlchemy engine + session factory.
pgvector extension enabled via init.sql at DB startup.
"""
import ssl
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import settings

# Async engine
connect_args = {}
if settings.APP_ENV == "production":
    if not settings.DB_SSL_CA:
        raise RuntimeError("DB_SSL_CA must point to the Supabase root certificate in production")
    connect_args["ssl"] = ssl.create_default_context(cafile=settings.DB_SSL_CA)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    connect_args=connect_args,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
