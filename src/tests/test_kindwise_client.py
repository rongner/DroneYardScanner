import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch

import backend.plant.kindwise_client as kw


def _mock_settings(api_key: str, photo_dir: str = "photos"):
    return MagicMock(kindwise_api_key=api_key, photo_dir=photo_dir)


def _make_http_client(return_value=None, side_effect=None):
    mock_response = return_value
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    if side_effect:
        mock_client.post = AsyncMock(side_effect=side_effect)
    else:
        mock_client.post = AsyncMock(return_value=mock_response)
    return mock_client


async def test_no_api_key_returns_unknown(monkeypatch):
    monkeypatch.setattr(kw, 'settings', _mock_settings(''))
    result = await kw.assess_plant_health('any.jpg')
    assert result['health_status'] == 'unknown'
    assert result['plant_name'] is None
    assert result['diseases'] is None


async def test_http_status_error_returns_unknown(tmp_path, monkeypatch):
    photo = tmp_path / 'p.jpg'
    photo.write_bytes(b'\xff\xd8' + b'\x00' * 10)
    monkeypatch.setattr(kw, 'settings', _mock_settings('key', str(tmp_path)))

    mock_resp = MagicMock(status_code=401, text='Unauthorized')
    exc = httpx.HTTPStatusError('401', request=MagicMock(), response=mock_resp)

    with patch('httpx.AsyncClient', return_value=_make_http_client(side_effect=exc)):
        result = await kw.assess_plant_health(str(photo))

    assert result['health_status'] == 'unknown'


async def test_request_error_returns_unknown(tmp_path, monkeypatch):
    photo = tmp_path / 'p.jpg'
    photo.write_bytes(b'\xff\xd8' + b'\x00' * 10)
    monkeypatch.setattr(kw, 'settings', _mock_settings('key', str(tmp_path)))

    exc = httpx.ConnectError('Network unreachable')

    with patch('httpx.AsyncClient', return_value=_make_http_client(side_effect=exc)):
        result = await kw.assess_plant_health(str(photo))

    assert result['health_status'] == 'unknown'


async def test_successful_response_parsed(tmp_path, monkeypatch):
    photo = tmp_path / 'p.jpg'
    photo.write_bytes(b'\xff\xd8' + b'\x00' * 10)
    monkeypatch.setattr(kw, 'settings', _mock_settings('key', str(tmp_path)))

    data = {
        'result': {
            'is_plant': {'binary': True},
            'classification': {'suggestions': [{'name': 'Rosa', 'probability': 0.95}]},
            'disease': {'suggestions': [{'name': 'Black Spot'}, {'name': 'Rust'}]},
        }
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value=data)

    with patch('httpx.AsyncClient', return_value=_make_http_client(return_value=mock_resp)):
        result = await kw.assess_plant_health(str(photo))

    assert result['plant_name'] == 'Rosa'
    assert result['health_status'] == 'healthy'
    assert result['probability'] == pytest.approx(0.95)
    assert 'Black Spot' in result['diseases']
    assert 'Rust' in result['diseases']


async def test_unhealthy_plant(tmp_path, monkeypatch):
    photo = tmp_path / 'p.jpg'
    photo.write_bytes(b'\xff\xd8' + b'\x00' * 10)
    monkeypatch.setattr(kw, 'settings', _mock_settings('key', str(tmp_path)))

    data = {
        'result': {
            'is_plant': {'binary': False},
            'classification': {'suggestions': [{'name': 'Quercus', 'probability': 0.8}]},
            'disease': {'suggestions': []},
        }
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value=data)

    with patch('httpx.AsyncClient', return_value=_make_http_client(return_value=mock_resp)):
        result = await kw.assess_plant_health(str(photo))

    assert result['health_status'] == 'unhealthy'
    assert result['diseases'] is None


async def test_empty_suggestions_handled(tmp_path, monkeypatch):
    photo = tmp_path / 'p.jpg'
    photo.write_bytes(b'\xff\xd8' + b'\x00' * 10)
    monkeypatch.setattr(kw, 'settings', _mock_settings('key', str(tmp_path)))

    data = {
        'result': {
            'is_plant': {'binary': True},
            'classification': {'suggestions': []},
            'disease': {'suggestions': []},
        }
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value=data)

    with patch('httpx.AsyncClient', return_value=_make_http_client(return_value=mock_resp)):
        result = await kw.assess_plant_health(str(photo))

    assert result['plant_name'] is None
    assert result['health_status'] == 'healthy'
    assert result['diseases'] is None


async def test_diseases_capped_at_three(tmp_path, monkeypatch):
    photo = tmp_path / 'p.jpg'
    photo.write_bytes(b'\xff\xd8' + b'\x00' * 10)
    monkeypatch.setattr(kw, 'settings', _mock_settings('key', str(tmp_path)))

    data = {
        'result': {
            'is_plant': {'binary': False},
            'classification': {'suggestions': []},
            'disease': {'suggestions': [
                {'name': 'A'}, {'name': 'B'}, {'name': 'C'}, {'name': 'D'},
            ]},
        }
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value=data)

    with patch('httpx.AsyncClient', return_value=_make_http_client(return_value=mock_resp)):
        result = await kw.assess_plant_health(str(photo))

    assert result['diseases'] == 'A, B, C'
