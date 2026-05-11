import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine
from .models import Base
from .routers import missions, drone, scans, yards


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    os.makedirs(settings.photo_dir, exist_ok=True)
    yield
    await engine.dispose()


app = FastAPI(title="Drone Yard Scanner API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(yards.router)
app.include_router(missions.router)
app.include_router(drone.router)
app.include_router(scans.router)


@app.get("/healthz")
async def health():
    return {"status": "ok"}
