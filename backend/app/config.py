from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 默认连接 docker-compose 启动的 PostgreSQL（主机端口 15432）
    # 使用自己的 PostgreSQL 时，通过 .env 文件覆盖此值
    database_url: str = "postgresql+asyncpg://latex_editor:latex_editor_pass@localhost:15432/latex_editor"
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    compile_dir: str = "/tmp/latex_compile"
    upload_dir: str = "./uploads"
    template_dir: str = "./templates"
    compile_timeout: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
