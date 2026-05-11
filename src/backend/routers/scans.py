from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import PlantScan, Waypoint

router = APIRouter(prefix="/api/scans", tags=["scans"])


class ScanOut(BaseModel):
    id: int
    waypoint_id: int
    photo_path: str
    plant_name: str | None
    health_status: str | None
    diseases: str | None
    probability: float | None

    model_config = {"from_attributes": True}


@router.get("/mission/{mission_id}", response_model=list[ScanOut])
async def scans_for_mission(mission_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PlantScan)
        .join(Waypoint)
        .where(Waypoint.mission_id == mission_id)
        .options(selectinload(PlantScan.waypoint))
    )
    return result.scalars().all()


@router.get("/{scan_id}/photo")
async def get_photo(scan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlantScan).where(PlantScan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        from fastapi import HTTPException
        raise HTTPException(404, "Scan not found")
    return FileResponse(scan.photo_path, media_type="image/jpeg")
