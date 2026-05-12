import asyncio
import os
from datetime import datetime
from typing import Callable, Awaitable

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Mission, Waypoint, PlantScan, MissionStatus
from ..mission.gps_converter import gps_to_relative_move
from ..plant.kindwise_client import assess_plant_health
from loguru import logger

from ..config import settings
from .tello_controller import tello

StatusCallback = Callable[[str], Awaitable[None]]
_TELLO_TIMEOUT = 10.0  # seconds per drone command before treating as a WiFi drop


async def _tello(coro, label: str):
    """Run a Tello coroutine with a timeout; raises RuntimeError on hang."""
    try:
        return await asyncio.wait_for(coro, timeout=_TELLO_TIMEOUT)
    except asyncio.TimeoutError:
        raise RuntimeError(f"Tello command timed out: {label}")


async def run_mission(mission: Mission, db: AsyncSession, on_status: StatusCallback):
    waypoints: list[Waypoint] = mission.waypoints
    if not waypoints:
        raise ValueError("Mission has no waypoints")

    mission.status = MissionStatus.flying
    await db.commit()

    try:
        await on_status("Taking off")
        await _tello(tello.takeoff(), "takeoff")

        prev_lat = waypoints[0].latitude
        prev_lon = waypoints[0].longitude

        for wp in waypoints:
            await on_status(f"Flying to waypoint {wp.sequence + 1}/{len(waypoints)}")
            move = gps_to_relative_move(prev_lat, prev_lon, wp.latitude, wp.longitude)
            await _tello(tello.move(move), "move")
            await asyncio.sleep(1)  # settle after move

            await on_status(f"Capturing photo at waypoint {wp.sequence + 1}")
            photo_bytes = await _tello(tello.take_photo(), "take_photo")
            photo_path = _save_photo(mission.id, wp.sequence, photo_bytes)

            await on_status(f"Analysing plant health at waypoint {wp.sequence + 1}")
            result = await assess_plant_health(photo_path)

            scan = PlantScan(
                waypoint_id=wp.id,
                photo_path=photo_path,
                plant_name=result.get("plant_name"),
                health_status=result.get("health_status"),
                diseases=result.get("diseases"),
                probability=result.get("probability"),
                raw_response=result.get("raw"),
            )
            db.add(scan)
            await db.commit()

            prev_lat, prev_lon = wp.latitude, wp.longitude

        await on_status("Returning home and landing")
        await _tello(tello.land(), "land")

        mission.status = MissionStatus.completed
        mission.completed_at = datetime.utcnow()

    except Exception as exc:
        logger.error("Mission %d failed: %s", mission.id, exc)
        mission.status = MissionStatus.failed
        try:
            await _tello(tello.land(), "emergency land")
        except Exception:
            pass
        raise
    finally:
        await db.commit()


def _save_photo(mission_id: int, sequence: int, data: bytes) -> str:
    dir_path = os.path.join(settings.photo_dir, str(mission_id))
    os.makedirs(dir_path, exist_ok=True)
    filename = f"wp{sequence:02d}_{datetime.utcnow().strftime('%H%M%S')}.jpg"
    path = os.path.join(dir_path, filename)
    with open(path, "wb") as f:
        f.write(data)
    return path
