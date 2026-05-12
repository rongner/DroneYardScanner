import pytest
from backend.config import settings as app_settings


@pytest.fixture(autouse=True)
def restore_tello_host():
    original = app_settings.tello_host
    yield
    app_settings.tello_host = original


async def test_get_settings_returns_expected_shape(client):
    r = await client.get("/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert "tello_host" in data
    assert "photo_dir" in data
    assert isinstance(data["kindwise_configured"], bool)


async def test_patch_tello_host(client):
    r = await client.patch("/api/settings", json={"tello_host": "10.0.0.1"})
    assert r.status_code == 200
    assert r.json()["tello_host"] == "10.0.0.1"


async def test_patch_tello_host_visible_on_get(client):
    await client.patch("/api/settings", json={"tello_host": "192.168.1.50"})
    r = await client.get("/api/settings")
    assert r.json()["tello_host"] == "192.168.1.50"


async def test_patch_empty_body_is_no_op(client):
    original = (await client.get("/api/settings")).json()["tello_host"]
    r = await client.patch("/api/settings", json={})
    assert r.status_code == 200
    assert r.json()["tello_host"] == original


async def test_patch_tello_host_strips_whitespace(client):
    r = await client.patch("/api/settings", json={"tello_host": "  10.0.0.2  "})
    assert r.json()["tello_host"] == "10.0.0.2"
