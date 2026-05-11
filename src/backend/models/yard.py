from __future__ import annotations

from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


class Yard(Base):
    __tablename__ = "yards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))

    missions: Mapped[list[Mission]] = relationship(back_populates="yard")  # type: ignore[name-defined]
