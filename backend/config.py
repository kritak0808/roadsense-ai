"""Central configuration — all values sourced from environment variables."""
import os
from datetime import timedelta


class Config:
    # ── Core ──────────────────────────────────────────────────────────────────
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")
    DEBUG: bool = os.getenv("FLASK_ENV", "production") == "development"
    TESTING: bool = False

    # ── Database ──────────────────────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI: str = os.getenv(
        "DATABASE_URL", "sqlite:///road_damage.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SQLALCHEMY_ENGINE_OPTIONS: dict = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND", "redis://localhost:6379/0"
    )

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "jwt-secret-change-me")
    JWT_ACCESS_TOKEN_EXPIRES: timedelta = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES: timedelta = timedelta(days=30)
    JWT_TOKEN_LOCATION: list = ["headers", "cookies"]
    JWT_COOKIE_SECURE: bool = not DEBUG
    JWT_COOKIE_CSRF_PROTECT: bool = False

    # ── File uploads ──────────────────────────────────────────────────────────
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH: int = 20 * 1024 * 1024  # 20 MB
    ALLOWED_EXTENSIONS: set = {"jpg", "jpeg", "png", "webp", "mp4", "avi", "mov"}

    # ── Model weights ─────────────────────────────────────────────────────────
    WEIGHTS_DIR: str = os.getenv("WEIGHTS_DIR", "weights")
    RESNET_WEIGHTS: str = os.path.join(
        os.getenv("WEIGHTS_DIR", "weights"), "resnet50_road.pth"
    )
    EFFICIENTNET_WEIGHTS: str = os.path.join(
        os.getenv("WEIGHTS_DIR", "weights"), "efficientnet_b4_road.pth"
    )
    VIT_WEIGHTS: str = os.path.join(
        os.getenv("WEIGHTS_DIR", "weights"), "vit_b16_road.pth"
    )
    MIDAS_WEIGHTS: str = os.path.join(
        os.getenv("WEIGHTS_DIR", "weights"), "dpt_large_384.pt"
    )

    # ── Email ─────────────────────────────────────────────────────────────────
    MAIL_SERVER: str = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS: bool = True
    MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER: str = os.getenv("MAIL_DEFAULT_SENDER", "noreply@roaddamage.ai")
    ALERT_RECIPIENTS: list = os.getenv("ALERT_RECIPIENTS", "").split(",")

    # ── Telegram ──────────────────────────────────────────────────────────────
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

    # ── OpenWeatherMap ────────────────────────────────────────────────────────
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")

    # ── OpenAI ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # ── Rate limiting ─────────────────────────────────────────────────────────
    RATELIMIT_DEFAULT: str = "200 per day;50 per hour"
    RATELIMIT_PREDICT: str = "30 per minute"
    RATELIMIT_STORAGE_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # ── Damage classes ────────────────────────────────────────────────────────
    DAMAGE_CLASSES: list = ["Good", "Crack", "Pothole", "Vandalism"]
    NUM_CLASSES: int = 4

    # ── Alert thresholds ──────────────────────────────────────────────────────
    ALERT_CONFIDENCE_THRESHOLD: float = float(
        os.getenv("ALERT_CONFIDENCE_THRESHOLD", "0.85")
    )
    ALERT_DEDUP_WINDOW_SECONDS: int = 3600  # 1 hour
    RHS_ALERT_THRESHOLD: float = 40.0

    # ── Aerial / drone ────────────────────────────────────────────────────────
    AERIAL_MIN_DIMENSION: int = 2000
    TILE_SIZE: int = 512
    TILE_OVERLAP: float = 0.25


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///road_damage_dev.db"


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)


config_map: dict = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": Config,
}


def get_config() -> Config:
    """Return the active config object based on FLASK_ENV."""
    env = os.getenv("FLASK_ENV", "production")
    return config_map.get(env, Config)()
