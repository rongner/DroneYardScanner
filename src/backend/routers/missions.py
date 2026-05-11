from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Mission, Waypoint, MissionStatus

router = APIRouter(prefix="/api/missions", tags=["missions"])


class WaypointIn(BaseModel):
    sequence: int
    latitude: float
    longitude: float
    label: str | None = None


class MissionIn(BaseModel):
    name: str
    yard_id: int | None = None
    waypoints: list[WaypointIn]


class WaypointOut(BaseModel):
    id: int
    sequence: int
    latitude: float
    longitude: float
    label: str | None
    model_config = {"from_attributes": True}


class MissionOut(BaseModel):
    id: int
    name: str
    status: MissionStatus
    yard_id: int | None
    created_at: datetime
    waypoints: list[WaypointOut]
    model_config = {"from_attributes": True}


@router.get("", response_model=list[MissionOut])
async def list_missions(yard_id: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Mission).options(selectinload(Mission.waypoints)).order_by(Mission.id.desc())
    if yard_id is not None:
        q = q.where(Mission.yard_id == yard_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=MissionOut, status_code=201)
async def create_mission(body: MissionIn, db: AsyncSession = Depends(get_db)):
    mission = Mission(name=body.name, yard_id=body.yard_id)
    db.add(mission)
    await db.flush()
    for wp in body.waypoints:
        db.add(Waypoint(mission_id=mission.id, **wp.model_dump()))
    await db.commit()
    result = await db.execute(
        select(Mission).options(selectinload(Mission.waypoints)).where(Mission.id == mission.id)
    )
    return result.scalar_one()


@router.get("/{mission_id}", response_model=MissionOut)
async def get_mission(mission_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mission).options(selectinload(Mission.waypoints)).where(Mission.id == mission_id)
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(404, "Mission not found")
    return mission


@router.delete("/{mission_id}", status_code=204)
async def delete_mission(mission_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mission).where(Mission.id == mission_id))
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(404, "Mission not found")
    await db.delete(mission)
    await db.commit()
