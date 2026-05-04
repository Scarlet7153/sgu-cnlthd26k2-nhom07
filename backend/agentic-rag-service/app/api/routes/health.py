from fastapi import APIRouter
from app.core.config import get_settings

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/advisor/health")
def health() -> dict:
    return {"status": "ok", "service": "agentic-rag-service"}


@router.get("/health/live")
def live() -> dict:
    return {"status": "ok"}


@router.get("/health/ready")
def ready() -> dict:
    settings = get_settings()
    return {
        "status": "ready",
        "service": settings.app_name,
        "env": settings.app_env,
    }
