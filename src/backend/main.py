import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .config import settings
from .limiter import limiter
from .database import engine, async_session
from .models import Base
from .routers import missions, drone, scans, yards
from .routers import settings as settings_router
from .routers.settings import load_persisted_settings


# Route stdlib logging through loguru
class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def _setup_logging() -> None:
    logger.remove()
    logger.add(
        sys.stdout,
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {name}:{line} - {message}",
        serialize=os.getenv("LOG_JSON", "false").lower() == "true",
    )
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)
    for noisy in ("uvicorn", "uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(noisy).handlers = [_InterceptHandler()]


_setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — creating tables and loading settings")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    os.makedirs(settings.photo_dir, exist_ok=True)
    async with async_session() as db:
        await load_persisted_settings(db)
    logger.info("Startup complete")
    yield
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(title="Drone Yard Scanner API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(yards.router)
app.include_router(missions.router)
app.include_router(drone.router)
app.include_router(scans.router)
app.include_router(settings_router.router)


@app.get("/healthz")
async def health():
    return {"status": "ok"}
