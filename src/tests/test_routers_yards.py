async def test_list_yards_empty(client):
    r = await client.get("/api/yards")
    assert r.status_code == 200
    assert r.json() == []


async def test_create_yard(client):
    r = await client.post("/api/yards", json={"name": "Front Garden"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Front Garden"
    assert "id" in data


async def test_list_yards_after_create(client):
    await client.post("/api/yards", json={"name": "Yard A"})
    r = await client.get("/api/yards")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Yard A"


async def test_delete_yard(client):
    create = await client.post("/api/yards", json={"name": "To Delete"})
    yard_id = create.json()["id"]
    r = await client.delete(f"/api/yards/{yard_id}")
    assert r.status_code == 204
    remaining = (await client.get("/api/yards")).json()
    assert remaining == []


async def test_delete_yard_not_found(client):
    r = await client.delete("/api/yards/999")
    assert r.status_code == 404
