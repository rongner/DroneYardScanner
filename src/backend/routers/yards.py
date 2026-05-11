from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Yard

router = APIRouter(prefix="/api/yards", tags=["yards"])


class YardIn(BaseModel):
    name: str


class YardOut(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


@router.get("", response_model=list[YardOut])
async def list_yards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Yard).order_by(Yard.id))
    return result.scalars().all()


@router.post("", response_model=YardOut, status_code=201)
async def create_yard(body: YardIn, db: AsyncSession = Depends(get_db)):
    yard = Yard(name=body.name)
    db.add(yard)
    await db.commit()
    await db.refresh(yard)
    return yard


@router.delete("/{yard_id}", status_code=204)
async def delete_yard(yard_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Yard).where(Yard.id == yard_id))
    yard = result.scalar_one_or_none()
    if not yard:
        raise HTTPException(404, "Yard not found")
    await db.delete(yard)
    await db.commit()
