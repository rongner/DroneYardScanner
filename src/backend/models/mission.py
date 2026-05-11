from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum
from .base import Base


class MissionStatus(str, enum.Enum):
    planned = "planned"
    flying = "flying"
    completed = "completed"
    failed = "failed"


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    status: Mapped[MissionStatus] = mapped_column(SAEnum(MissionStatus), default=MissionStatus.planned)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    waypoints: Mapped[list["Waypoint"]] = relationship(back_populates="mission", order_by="Waypoint.sequence")


class Waypoint(Base):
    __tablename__ = "waypoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id"))
    sequence: Mapped[int] = mapped_column(Integer)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    mission: Mapped[Mission] = relationship(back_populates="waypoints")
    scan: Mapped["PlantScan | None"] = relationship(back_populates="waypoint")


class PlantScan(Base):
    __tablename__ = "plant_scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    waypoint_id: Mapped[int] = mapped_column(ForeignKey("waypoints.id"))
    photo_path: Mapped[str] = mapped_column(String(500))
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    plant_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    health_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    diseases: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_response: Mapped[str | None] = mapped_column(String, nullable=True)

    waypoint: Mapped[Waypoint] = relationship(back_populates="scan")
