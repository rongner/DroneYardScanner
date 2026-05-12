import pytest
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.database import get_db
from backend.limiter import limiter
from backend.models import Base
from backend.routers import yards, missions, scans
from backend.routers import settings as settings_router

_TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_engine():
    engine = create_async_engine(
        _TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False)
    async with Session() as session:
        yield session


@pytest.fixture
async def client(db_engine):
    Session = async_sessionmaker(db_engine, expire_on_commit=False)

    async def _override_db():
        async with Session() as session:
            yield session

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
    app.dependency_overrides[get_db] = _override_db
    app.include_router(yards.router)
    app.include_router(missions.router)
    app.include_router(scans.router)
    app.include_router(settings_router.router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
