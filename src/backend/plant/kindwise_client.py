import base64
import json
import logging
import pathlib
import httpx
from ..config import settings

logger = logging.getLogger(__name__)

HEALTH_URL = "https://plant.id/api/v3/health_assessment"

_UNKNOWN = {"plant_name": None, "health_status": "unknown", "diseases": None, "probability": None, "raw": None}


async def assess_plant_health(photo_path: str) -> dict:
    if not settings.kindwise_api_key:
        return _UNKNOWN

    base = pathlib.Path(settings.photo_dir).resolve()
    resolved = pathlib.Path(photo_path).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        logger.warning("Photo path outside photo_dir, skipping Kindwise: %s", photo_path)
        return _UNKNOWN

    with open(resolved, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    payload = {"images": [image_b64], "health": "all"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                HEALTH_URL,
                json=payload,
                headers={"Api-Key": settings.kindwise_api_key},
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("Kindwise API %s: %s", exc.response.status_code, exc.response.text[:200])
        return _UNKNOWN
    except httpx.RequestError as exc:
        logger.warning("Kindwise request failed: %s", exc)
        return _UNKNOWN
    except Exception as exc:
        logger.warning("Kindwise unexpected error: %s", exc)
        return _UNKNOWN

    try:
        result = data.get("result", {})
        classification = result.get("classification", {})
        suggestions = classification.get("suggestions", [])
        top = suggestions[0] if suggestions else {}

        is_healthy = result.get("is_plant", {}).get("binary", True)
        disease_list = result.get("disease", {}).get("suggestions", [])
        diseases = ", ".join(d["name"] for d in disease_list[:3]) if disease_list else None

        return {
            "plant_name": top.get("name"),
            "health_status": "healthy" if is_healthy else "unhealthy",
            "diseases": diseases,
            "probability": top.get("probability"),
            "raw": json.dumps(data),
        }
    except Exception as exc:
        logger.warning("Kindwise response parsing failed: %s", exc)
        return _UNKNOWN
