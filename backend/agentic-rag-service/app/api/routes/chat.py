from typing import Any, Dict
from fastapi import APIRouter, Depends, Request
from app.api.auth import require_auth
from app.schemas.chat import (
    ChatContextUpdateRequest,
    ChatContextUpdateResponse,
    ChatRequest,
    ChatResponse,
)

router = APIRouter(prefix="/api", tags=["chat"])


def _inject_selected_components_from_session(
    container: Any,
    session_id: str,
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Fetch selectedComponents from build session and inject into context.
    
    This ensures UI component selections are visible to the chat agent.
    """
    if not container or not session_id:
        return context
    try:
        session_service = getattr(container, "pc_build_session_service", None)
        if session_service is None:
            return context
        session = session_service.get_or_create(session_id=session_id)
        components = session.get("selected_components", [])
        if not components:
            return context
        # Don't overwrite if context already has selectedComponents
        if context.get("selectedComponents"):
            return context
        mapped = []
        for c in components:
            mapped.append({
                "slot": c.get("slot"),
                "productId": c.get("product_id"),
                "name": c.get("name", ""),
                "price": c.get("price", 0),
            })
        context["selectedComponents"] = mapped
        context["estimatedBuildTotal"] = session.get("total_price", 0)
    except Exception:
        pass
    return context


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request, _=Depends(require_auth)) -> ChatResponse:
    orchestrator = request.app.state.container.orchestrator
    chat_history_service = request.app.state.container.chat_history_service

    # Sync UI selections to chat context
    context = dict(payload.context)
    context = _inject_selected_components_from_session(
        container=request.app.state.container,
        session_id=payload.session_id,
        context=context,
    )

    chat_history_service.append_user_message(
        session_id=payload.session_id,
        account_id=payload.account_id,
        query=payload.query,
        context=context,
    )

    response = orchestrator.handle(
        query=payload.query,
        context=context,
        max_iterations=payload.options.max_iterations,
        enable_web_fallback=payload.options.enable_web_fallback,
    )

    chat_history_service.append_assistant_message(
        session_id=payload.session_id,
        answer=response.answer,
        products=response.products,
    )

    return response


@router.post("/chat/context", response_model=ChatContextUpdateResponse)
def update_chat_context(payload: ChatContextUpdateRequest, request: Request, _=Depends(require_auth)) -> ChatContextUpdateResponse:
    chat_history_service = request.app.state.container.chat_history_service
    chat_history_service.update_context(
        session_id=payload.session_id,
        account_id=payload.account_id,
        context=payload.context,
    )
    return ChatContextUpdateResponse(status="ok")


@router.get("/chat/context")
def get_chat_context(request: Request, session_id: str, account_id: str | None = None, _=Depends(require_auth)) -> Dict[str, Any]:
    chat_history_service = request.app.state.container.chat_history_service
    summary = chat_history_service.get_context_summary(session_id, account_id)
    return summary or {}
