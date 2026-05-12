from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Walk up from src/backend/config.py → src/backend/ → src/ → DroneYardScanner/
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8")

    database_url: str
    kindwise_api_key: str = ""
    photo_dir: str = "photos"
    tello_host: str = "192.168.10.1"
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
