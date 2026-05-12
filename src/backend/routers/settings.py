from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..database import get_db
from ..limiter import limiter
from ..models import AppSetting

router = APIRouter(prefix="/api/settings", tags=["settings"])

_TELLO_KEY = "tello_host"


async def load_persisted_settings(db: AsyncSession) -> None:
    row = await db.scalar(select(AppSetting).where(AppSetting.key == _TELLO_KEY))
    if row:
        settings.tello_host = row.value


class SettingsOut(BaseModel):
    tello_host: str
    photo_dir: str
    kindwise_configured: bool


class SettingsPatch(BaseModel):
    tello_host: str | None = None


@router.get("", response_model=SettingsOut)
async def get_settings():
    return SettingsOut(
        tello_host=settings.tello_host,
        photo_dir=settings.photo_dir,
        kindwise_configured=bool(settings.kindwise_api_key),
    )


@router.patch("", response_model=SettingsOut)
@limiter.limit("10/minute")
async def patch_settings(request: Request, body: SettingsPatch, db: AsyncSession = Depends(get_db)):
    if body.tello_host is not None:
        value = body.tello_host.strip()
        settings.tello_host = value
        row = await db.scalar(select(AppSetting).where(AppSetting.key == _TELLO_KEY))
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=_TELLO_KEY, value=value))
        await db.commit()
    return await get_settings()
