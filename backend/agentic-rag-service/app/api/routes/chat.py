from fastapi import APIRouter, Request
from app.schemas.chat import (
    ChatContextUpdateRequest,
    ChatContextUpdateResponse,
    ChatRequest,
    ChatResponse,
)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    orchestrator = request.app.state.container.orchestrator
    chat_history_service = request.app.state.container.chat_history_service

    chat_history_service.append_user_message(
        session_id=payload.session_id,
        account_id=payload.account_id,
        query=payload.query,
        context=payload.context,
    )

    response = orchestrator.handle(
        query=payload.query,
        context=payload.context,
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
def update_chat_context(payload: ChatContextUpdateRequest, request: Request) -> ChatContextUpdateResponse:
    chat_history_service = request.app.state.container.chat_history_service
    chat_history_service.update_context(
        session_id=payload.session_id,
        account_id=payload.account_id,
        context=payload.context,
    )
    return ChatContextUpdateResponse(status="ok")
