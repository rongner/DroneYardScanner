from datetime import datetime
from unittest.mock import AsyncMock, patch

import backend.routers.scans as scans_mod
from backend.models import Mission, MissionStatus, PlantScan, Waypoint

_WP = {"sequence": 0, "latitude": 51.5, "longitude": -0.12}
_MISSION = {"name": "M", "waypoints": [_WP]}
_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16


async def _mk_mission(client):
    r = await client.post("/api/missions", json=_MISSION)
    data = r.json()
    return data["id"], data["waypoints"][0]["sequence"]


async def test_scans_for_mission_empty(client):
    mid, _ = await _mk_mission(client)
    r = await client.get(f"/api/scans/mission/{mid}")
    assert r.status_code == 200
    assert r.json() == []


async def test_simulate_rejects_wrong_mime(client, tmp_path, monkeypatch):
    monkeypatch.setattr(scans_mod.settings, "photo_dir", str(tmp_path))
    mid, seq = await _mk_mission(client)
    r = await client.post(
        f"/api/scans/simulate/{mid}/{seq}",
        files={"photo": ("bad.txt", b"not-an-image", "text/plain")},
    )
    assert r.status_code == 400


async def test_simulate_rejects_oversized_file(client, tmp_path, monkeypatch):
    monkeypatch.setattr(scans_mod.settings, "photo_dir", str(tmp_path))
    mid, seq = await _mk_mission(client)
    r = await client.post(
        f"/api/scans/simulate/{mid}/{seq}",
        files={"photo": ("big.jpg", b"\xff\xd8" + b"\x00" * (11 * 1024 * 1024), "image/jpeg")},
    )
    assert r.status_code == 413


async def test_simulate_waypoint_not_found(client, tmp_path, monkeypatch):
    monkeypatch.setattr(scans_mod.settings, "photo_dir", str(tmp_path))
    r = await client.post(
        "/api/scans/simulate/999/0",
        files={"photo": ("p.jpg", _JPEG, "image/jpeg")},
    )
    assert r.status_code == 404


async def test_simulate_creates_scan(client, tmp_path, monkeypatch):
    monkeypatch.setattr(scans_mod.settings, "photo_dir", str(tmp_path))
    mid, seq = await _mk_mission(client)

    analysis = {
        "plant_name": "Rosa",
        "health_status": "healthy",
        "diseases": None,
        "probability": 0.92,
        "raw": "{}",
    }
    with patch("backend.routers.scans.assess_plant_health", new=AsyncMock(return_value=analysis)):
        r = await client.post(
            f"/api/scans/simulate/{mid}/{seq}",
            files={"photo": ("p.jpg", _JPEG, "image/jpeg")},
        )

    assert r.status_code == 201
    data = r.json()
    assert data["plant_name"] == "Rosa"
    assert data["health_status"] == "healthy"
    assert data["probability"] == 0.92
    assert "photo_path" not in data


async def test_simulate_second_upload_updates_scan(client, tmp_path, monkeypatch):
    monkeypatch.setattr(scans_mod.settings, "photo_dir", str(tmp_path))
    mid, seq = await _mk_mission(client)

    stub = AsyncMock(return_value={"plant_name": "A", "health_status": "healthy", "diseases": None, "probability": 0.5, "raw": "{}"})
    with patch("backend.routers.scans.assess_plant_health", new=stub):
        await client.post(f"/api/scans/simulate/{mid}/{seq}", files={"photo": ("p.jpg", _JPEG, "image/jpeg")})

    stub2 = AsyncMock(return_value={"plant_name": "B", "health_status": "unhealthy", "diseases": "Rust", "probability": 0.7, "raw": "{}"})
    with patch("backend.routers.scans.assess_plant_health", new=stub2):
        r2 = await client.post(f"/api/scans/simulate/{mid}/{seq}", files={"photo": ("p2.jpg", _JPEG, "image/jpeg")})

    assert r2.status_code == 201
    assert r2.json()["plant_name"] == "B"

    scans = (await client.get(f"/api/scans/mission/{mid}")).json()
    assert len(scans) == 1  # same waypoint → updated, not duplicated


async def test_get_photo_not_found(client):
    r = await client.get("/api/scans/999/photo")
    assert r.status_code == 404


async def test_get_photo_path_traversal_blocked(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(scans_mod.settings, "photo_dir", str(tmp_path))

    mission = Mission(name="M", status=MissionStatus.planned, created_at=datetime.utcnow())
    db_session.add(mission)
    await db_session.flush()
    wp = Waypoint(mission_id=mission.id, sequence=0, latitude=0.0, longitude=0.0)
    db_session.add(wp)
    await db_session.flush()
    scan = PlantScan(waypoint_id=wp.id, photo_path="/etc/passwd", scanned_at=datetime.utcnow())
    db_session.add(scan)
    await db_session.commit()

    r = await client.get(f"/api/scans/{scan.id}/photo")
    assert r.status_code == 403
