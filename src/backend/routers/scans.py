from __future__ import annotations

import pathlib
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import settings
from ..database import get_db
from ..models import Mission, PlantScan, Waypoint
from ..plant.kindwise_client import assess_plant_health

router = APIRouter(prefix="/api/scans", tags=["scans"])


class WaypointBrief(BaseModel):
    id: int
    sequence: int
    latitude: float
    longitude: float
    label: str | None
    model_config = {"from_attributes": True}


class ScanOut(BaseModel):
    id: int
    waypoint_id: int
    waypoint: WaypointBrief
    photo_path: str
    plant_name: str | None
    health_status: str | None
    diseases: str | None
    probability: float | None
    scanned_at: datetime
    model_config = {"from_attributes": True}


class PlantSummary(BaseModel):
    label: str
    scan_count: int
    latest_health: str | None
    first_seen: datetime
    last_seen: datetime
    latitude: float
    longitude: float


@router.get("/mission/{mission_id}", response_model=list[ScanOut])
async def scans_for_mission(mission_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PlantScan)
        .join(Waypoint)
        .where(Waypoint.mission_id == mission_id)
        .options(selectinload(PlantScan.waypoint))
        .order_by(Waypoint.sequence)
    )
    return result.scalars().all()


@router.get("/plants", response_model=list[PlantSummary])
async def list_plants(yard_id: int, db: AsyncSession = Depends(get_db)):
    """Return unique labeled plants (waypoints with a label) in a yard that have been scanned."""
    rows = await db.execute(
        select(
            Waypoint.label,
            func.count(PlantScan.id).label("scan_count"),
            func.min(PlantScan.scanned_at).label("first_seen"),
            func.max(PlantScan.scanned_at).label("last_seen"),
            func.avg(Waypoint.latitude).label("latitude"),
            func.avg(Waypoint.longitude).label("longitude"),
        )
        .join(PlantScan, PlantScan.waypoint_id == Waypoint.id)
        .join(Mission, Mission.id == Waypoint.mission_id)
        .where(Mission.yard_id == yard_id)
        .where(Waypoint.label.isnot(None))
        .group_by(Waypoint.label)
        .order_by(Waypoint.label)
    )
    plants = []
    for row in rows:
        # Fetch latest scan for this label to get health status
        latest = await db.execute(
            select(PlantScan)
            .join(Waypoint, Waypoint.id == PlantScan.waypoint_id)
            .join(Mission, Mission.id == Waypoint.mission_id)
            .where(Mission.yard_id == yard_id)
            .where(Waypoint.label == row.label)
            .order_by(PlantScan.scanned_at.desc())
            .limit(1)
        )
        latest_scan = latest.scalar_one_or_none()
        plants.append(PlantSummary(
            label=row.label,
            scan_count=row.scan_count,
            latest_health=latest_scan.health_status if latest_scan else None,
            first_seen=row.first_seen,
            last_seen=row.last_seen,
            latitude=row.latitude,
            longitude=row.longitude,
        ))
    return plants


@router.get("/plant-history", response_model=list[ScanOut])
async def plant_history(yard_id: int, label: str, db: AsyncSession = Depends(get_db)):
    """All scans for a specific plant label within a yard, newest first."""
    result = await db.execute(
        select(PlantScan)
        .join(Waypoint, Waypoint.id == PlantScan.waypoint_id)
        .join(Mission, Mission.id == Waypoint.mission_id)
        .where(Mission.yard_id == yard_id)
        .where(Waypoint.label == label)
        .options(selectinload(PlantScan.waypoint))
        .order_by(PlantScan.scanned_at.desc())
    )
    return result.scalars().all()


@router.get("/{scan_id}/photo")
async def get_photo(scan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlantScan).where(PlantScan.id == scan_id))
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(404, "Scan not found")
    return FileResponse(scan.photo_path, media_type="image/jpeg")


@router.post("/simulate/{mission_id}/{sequence}", response_model=ScanOut, status_code=201)
async def simulate_scan(
    mission_id: int,
    sequence: int,
    photo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a photo for a waypoint, run plant health analysis, and store the result."""
    wp_row = await db.execute(
        select(Waypoint).where(
            Waypoint.mission_id == mission_id,
            Waypoint.sequence == sequence,
        )
    )
    wp = wp_row.scalar_one_or_none()
    if not wp:
        raise HTTPException(404, "Waypoint not found")

    photo_bytes = await photo.read()
    try:
        photo_path = _save_photo(mission_id, sequence, photo_bytes)
    except OSError as exc:
        raise HTTPException(500, f"Failed to save photo: {exc}") from exc
    analysis = await assess_plant_health(photo_path)  # always returns a dict — never raises

    existing_row = await db.execute(
        select(PlantScan).where(PlantScan.waypoint_id == wp.id)
    )
    existing = existing_row.scalar_one_or_none()

    if existing:
        existing.photo_path = photo_path
        existing.plant_name = analysis.get("plant_name")
        existing.health_status = analysis.get("health_status")
        existing.diseases = analysis.get("diseases")
        existing.probability = analysis.get("probability")
        existing.raw_response = analysis.get("raw")
        existing.scanned_at = datetime.utcnow()
        scan_id = existing.id
    else:
        new_scan = PlantScan(
            waypoint_id=wp.id,
            photo_path=photo_path,
            plant_name=analysis.get("plant_name"),
            health_status=analysis.get("health_status"),
            diseases=analysis.get("diseases"),
            probability=analysis.get("probability"),
            raw_response=analysis.get("raw"),
        )
        db.add(new_scan)
        await db.flush()
        scan_id = new_scan.id

    await db.commit()

    final_row = await db.execute(
        select(PlantScan).options(selectinload(PlantScan.waypoint)).where(PlantScan.id == scan_id)
    )
    return final_row.scalar_one()


def _save_photo(mission_id: int, sequence: int, data: bytes) -> str:
    base = pathlib.Path(settings.photo_dir).resolve()
    dir_path = base / str(int(mission_id))
    dir_path.mkdir(parents=True, exist_ok=True)
    filename = f"wp{int(sequence):02d}_{datetime.utcnow().strftime('%H%M%S')}.jpg"
    path = dir_path / filename
    path.resolve().relative_to(base)  # raises ValueError if outside photo_dir
    path.write_bytes(data)
    return str(path)
