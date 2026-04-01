from fastapi import FastAPI

from app.api.routes.build_sessions import router as build_sessions_router
from app.api.routes.chat import router as chat_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.container import ServiceContainer


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    app = FastAPI(title=settings.app_name)
    app.state.container = ServiceContainer(settings)

    app.include_router(health_router)
    app.include_router(chat_router)
    app.include_router(build_sessions_router)

    return app


app = create_app()
