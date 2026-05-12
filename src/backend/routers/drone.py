from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..drone.tello_controller import tello
from ..drone.mission_executor import run_mission
from ..models import Mission, MissionStatus

router = APIRouter(prefix="/api/drone", tags=["drone"])

# Tracks active WebSocket connections per client IP; prevents connection floods
_active_ws: dict[str, int] = {}
_MAX_WS_PER_IP = 2


@router.post("/connect")
async def connect():
    try:
        tello.connect()
        return {"battery": tello.battery}
    except Exception as e:
        logger.error("Drone connect failed: {}", e)
        raise HTTPException(500, "Failed to connect to drone")


@router.post("/disconnect")
async def disconnect():
    tello.disconnect()
    return {"status": "disconnected"}


@router.get("/status")
async def status():
    return {
        "connected": tello.is_connected,
        "battery": tello.battery if tello.is_connected else None,
    }


@router.websocket("/fly/{mission_id}")
async def fly_mission(websocket: WebSocket, mission_id: int, db: AsyncSession = Depends(get_db)):
    client_ip = websocket.client.host if websocket.client else "unknown"

    if _active_ws.get(client_ip, 0) >= _MAX_WS_PER_IP:
        await websocket.close(code=1008)
        return

    _active_ws[client_ip] = _active_ws.get(client_ip, 0) + 1
    await websocket.accept()

    try:
        result = await db.execute(
            select(Mission).options(selectinload(Mission.waypoints)).where(Mission.id == mission_id)
        )
        mission = result.scalar_one_or_none()

        if not mission:
            await websocket.send_json({"type": "error", "message": "Mission not found"})
            await websocket.close()
            return

        if mission.status == MissionStatus.flying:
            await websocket.send_json({"type": "error", "message": "Mission already running"})
            await websocket.close()
            return

        if not tello.is_connected:
            await websocket.send_json({"type": "error", "message": "Drone not connected"})
            await websocket.close()
            return

        async def send_status(msg: str):
            try:
                await websocket.send_json({"type": "status", "message": msg})
            except WebSocketDisconnect:
                pass

        try:
            await run_mission(mission, db, on_status=send_status)
            await websocket.send_json({"type": "complete", "mission_id": mission_id})
        except Exception as e:
            logger.error("Mission {} failed: {}", mission_id, e)
            await websocket.send_json({"type": "error", "message": "Mission failed — check server logs"})
        finally:
            await websocket.close()
    finally:
        _active_ws[client_ip] = max(0, _active_ws.get(client_ip, 1) - 1)
