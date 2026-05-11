import base64
import json
import httpx
from ..config import settings

HEALTH_URL = "https://plant.id/api/v3/health_assessment"


async def assess_plant_health(photo_path: str) -> dict:
    if not settings.kindwise_api_key:
        return {"plant_name": None, "health_status": "unknown", "diseases": None, "probability": None, "raw": None}

    with open(photo_path, "rb") as f:
        image_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "images": [image_b64],
        "health": "all",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            HEALTH_URL,
            json=payload,
            headers={"Api-Key": settings.kindwise_api_key},
        )
        response.raise_for_status()
        data = response.json()

    result = data.get("result", {})
    classification = result.get("classification", {})
    suggestions = classification.get("suggestions", [{}])
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
