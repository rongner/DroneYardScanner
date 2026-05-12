_WP = {"sequence": 0, "latitude": 51.5, "longitude": -0.12}
_MISSION = {"name": "Test Run", "waypoints": [_WP]}


async def test_list_missions_empty(client):
    r = await client.get("/api/missions")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_mission(client):
    r = await client.post("/api/missions", json=_MISSION)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test Run"
    assert data["status"] == "planned"
    assert len(data["waypoints"]) == 1
    wp = data["waypoints"][0]
    assert wp["latitude"] == 51.5
    assert wp["longitude"] == -0.12


async def test_list_missions_after_create(client):
    await client.post("/api/missions", json=_MISSION)
    r = await client.get("/api/missions")
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_get_mission(client):
    create = await client.post("/api/missions", json=_MISSION)
    mid = create.json()["id"]
    r = await client.get(f"/api/missions/{mid}")
    assert r.status_code == 200
    assert r.json()["id"] == mid


async def test_get_mission_not_found(client):
    r = await client.get("/api/missions/999")
    assert r.status_code == 404


async def test_delete_mission(client):
    create = await client.post("/api/missions", json=_MISSION)
    mid = create.json()["id"]
    r = await client.delete(f"/api/missions/{mid}")
    assert r.status_code == 204
    assert (await client.get(f"/api/missions/{mid}")).status_code == 404


async def test_delete_mission_not_found(client):
    r = await client.delete("/api/missions/999")
    assert r.status_code == 404


async def test_create_mission_invalid_latitude(client):
    wp = {"sequence": 0, "latitude": 200.0, "longitude": 0.0}
    r = await client.post("/api/missions", json={"name": "Bad", "waypoints": [wp]})
    assert r.status_code == 422


async def test_create_mission_invalid_longitude(client):
    wp = {"sequence": 0, "latitude": 0.0, "longitude": -999.0}
    r = await client.post("/api/missions", json={"name": "Bad", "waypoints": [wp]})
    assert r.status_code == 422


async def test_create_mission_negative_sequence(client):
    wp = {"sequence": -1, "latitude": 0.0, "longitude": 0.0}
    r = await client.post("/api/missions", json={"name": "Bad", "waypoints": [wp]})
    assert r.status_code == 422


async def test_filter_missions_by_yard(client):
    yard = (await client.post("/api/yards", json={"name": "Y1"})).json()
    await client.post("/api/missions", json={"name": "In yard", "yard_id": yard["id"], "waypoints": [_WP]})
    await client.post("/api/missions", json={"name": "No yard", "waypoints": [_WP]})
    r = await client.get(f"/api/missions?yard_id={yard['id']}")
    assert r.status_code == 200
    missions = r.json()
    assert len(missions) == 1
    assert missions[0]["name"] == "In yard"
