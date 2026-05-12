import asyncio
from loguru import logger
from djitellopy import Tello
from ..mission.gps_converter import RelativeMove

FLIGHT_ALTITUDE_CM = 150  # hover height during mission
MOVE_SPEED = 30            # cm/s


class TelloController:
    def __init__(self):
        self._tello: Tello | None = None

    def connect(self):
        self._tello = Tello()
        self._tello.connect()
        logger.info("Tello connected. Battery: %d%%", self._tello.get_battery())

    def disconnect(self):
        if self._tello:
            self._tello.end()
            self._tello = None

    @property
    def battery(self) -> int:
        return self._tello.get_battery() if self._tello else 0

    @property
    def is_connected(self) -> bool:
        return self._tello is not None

    async def takeoff(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._tello.takeoff)
        await self._move_to_altitude(FLIGHT_ALTITUDE_CM)

    async def land(self):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._tello.land)

    async def move(self, move: RelativeMove):
        loop = asyncio.get_event_loop()
        if move.x != 0 or move.y != 0:
            await loop.run_in_executor(
                None,
                lambda: self._tello.go_xyz_speed(
                    max(20, min(500, move.x)),
                    max(20, min(500, move.y)),
                    move.z,
                    MOVE_SPEED,
                )
            )

    async def take_photo(self) -> bytes:
        """Captures a single frame from the video stream and returns it as JPEG bytes."""
        loop = asyncio.get_event_loop()
        self._tello.streamon()
        await asyncio.sleep(1)  # allow stream to stabilise
        frame = await loop.run_in_executor(None, self._tello.get_frame_read().frame)
        self._tello.streamoff()

        from PIL import Image
        import io
        img = Image.fromarray(frame)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return buf.getvalue()

    async def _move_to_altitude(self, target_cm: int):
        loop = asyncio.get_event_loop()
        current = self._tello.get_height()
        diff = target_cm - current
        if abs(diff) > 20:
            if diff > 0:
                await loop.run_in_executor(None, lambda: self._tello.move_up(min(500, diff)))
            else:
                await loop.run_in_executor(None, lambda: self._tello.move_down(min(500, -diff)))


# Singleton — one drone connection per process
tello = TelloController()
