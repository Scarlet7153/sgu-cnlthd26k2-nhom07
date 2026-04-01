from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready() -> dict:
    settings = get_settings()
    return {
        "status": "ready",
        "service": settings.app_name,
        "env": settings.app_env,
    }
