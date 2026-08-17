from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=False, extra="ignore"
    )

    database_url: str
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672//"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "knowledgeos"
    s3_region: str = "us-east-1"
    ai_service_token: str


settings = Settings()  # type: ignore[call-arg]
