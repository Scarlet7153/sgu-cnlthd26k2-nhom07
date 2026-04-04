from fastapi import APIRouter, HTTPException, Request

from app.schemas.build_session import (
    BuildComponentPayload,
    BuildSessionResponse,
    CheckoutValidateResponse,
)

router = APIRouter(prefix="/api/build-sessions", tags=["build-sessions"])


def _to_build_session_response(doc: dict) -> BuildSessionResponse:
    components = []
    for c in doc.get("selected_components", []):
        components.append(
            {
                "slot": c.get("slot"),
                "productId": c.get("product_id"),
                "categoryId": c.get("category_id"),
                "name": c.get("name"),
                "price": c.get("price", 0),
                "quantity": c.get("quantity", 1),
                "image": c.get("image"),
                "url": c.get("url"),
                "selectedAt": c.get("selected_at").isoformat() if c.get("selected_at") else "",
            }
        )

    return BuildSessionResponse(
        sessionId=doc.get("session_id", ""),
        accountId=doc.get("account_id"),
        status=doc.get("status", "active"),
        totalPrice=doc.get("total_price", 0) or 0,
        selectedComponents=components,
    )


@router.get("/{session_id}", response_model=BuildSessionResponse)
def get_build_session(session_id: str, request: Request) -> BuildSessionResponse:
    service = request.app.state.container.pc_build_session_service
    doc = service.get_or_create(session_id=session_id)
    return _to_build_session_response(doc)


@router.post("/{session_id}/components", response_model=BuildSessionResponse)
def add_or_replace_component(session_id: str, payload: BuildComponentPayload, request: Request) -> BuildSessionResponse:
    service = request.app.state.container.pc_build_session_service
    try:
        doc = service.upsert_component(session_id=session_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_build_session_response(doc)


@router.delete("/{session_id}/components/{slot}", response_model=BuildSessionResponse)
def remove_component(session_id: str, slot: str, request: Request) -> BuildSessionResponse:
    service = request.app.state.container.pc_build_session_service
    doc = service.remove_component(session_id=session_id, slot=slot)
    return _to_build_session_response(doc)


@router.post("/{session_id}/checkout-validate", response_model=CheckoutValidateResponse)
def checkout_validate(session_id: str, request: Request) -> CheckoutValidateResponse:
    service = request.app.state.container.pc_build_session_service
    result = service.validate_checkout(session_id=session_id)
    return CheckoutValidateResponse(
        sessionId=result["session_id"],
        ready=result["ready"],
        missingSlots=result["missing_slots"],
        totalPrice=result["total_price"],
    )
