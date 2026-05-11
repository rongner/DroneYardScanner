from fastapi import APIRouter
from pydantic import BaseModel
from ..config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


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
async def patch_settings(body: SettingsPatch):
    if body.tello_host is not None:
        settings.tello_host = body.tello_host.strip()
    return await get_settings()
