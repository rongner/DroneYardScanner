from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/droneyardscanner"
    kindwise_api_key: str = ""
    photo_dir: str = "photos"
    tello_host: str = "192.168.10.1"
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
