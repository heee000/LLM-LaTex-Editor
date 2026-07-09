from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI LaTeX Editor"
    secret_key: str = "dev-secret-change-in-production"
    data_dir: str = "./data"
    upload_dir: str = "./uploads"
    compile_dir: str = "./compile_tmp"
    template_dir: str = "./templates"
    compile_timeout: int = 60
    frontend_origins: str = "http://localhost:5173,http://localhost:3000"
    material_template_dir: str = "material"
    seed_material_templates: bool = True

    class Config:
        env_file = ".env"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
