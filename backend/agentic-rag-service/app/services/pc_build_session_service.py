from datetime import datetime, timedelta, timezone
import re
from typing import Any, Dict, List

from pymongo import ASCENDING, DESCENDING, MongoClient

from app.schemas.build_session import BuildComponentPayload


class PCBuildSessionService:
    def __init__(
        self,
        mongodb_uri: str,
        database: str,
        collection: str,
        required_slots: List[str],
        mongo_search_service: Any | None = None,
    ) -> None:
        self.client = MongoClient(mongodb_uri) if mongodb_uri else None
        self.collection = self.client[database][collection] if self.client else None
        self.required_slots = [slot.strip().upper() for slot in required_slots if slot.strip()]
        self.mongo_search_service = mongo_search_service

        if self.collection is not None:
            self.collection.create_index([("session_id", ASCENDING)], unique=True)
            self.collection.create_index([("account_id", ASCENDING), ("updated_at", DESCENDING)])
            self.collection.create_index([("status", ASCENDING), ("updated_at", DESCENDING)])
            self.collection.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)

    def get_or_create(self, session_id: str, account_id: str | None = None) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)

        if self.collection is None:
            return {
                "session_id": session_id,
                "account_id": account_id,
                "status": "active",
                "total_price": 0,
                "selected_components": [],
            }

        self.collection.update_one(
            {"session_id": session_id},
            {
                "$setOnInsert": {
                    "session_id": session_id,
                    "account_id": account_id,
                    "status": "active",
                    "requirements": {},
                    "selected_components": [],
                    "compatibility_notes": [],
                    "total_price": 0,
                    "created_at": now,
                },
                "$set": {
                    "updated_at": now,
                    "expires_at": now + timedelta(days=30),
                },
            },
            upsert=True,
        )
        return self.collection.find_one({"session_id": session_id}) or {}

    def upsert_component(self, session_id: str, payload: BuildComponentPayload, account_id: str | None = None) -> Dict[str, Any]:
        doc = self.get_or_create(session_id=session_id, account_id=account_id)
        now = datetime.now(timezone.utc)

        slot = payload.slot.upper()
        component = {
            "slot": slot,
            "product_id": payload.product_id,
            "category_id": payload.category_id,
            "name": payload.name,
            "price": payload.price,
            "quantity": payload.quantity,
            "image": payload.image,
            "url": payload.url,
            "selected_at": now,
        }

        selected_components = [c for c in doc.get("selected_components", []) if c.get("slot") != slot]
        self._validate_hardware_compatibility(payload=payload, selected_components=selected_components)
        selected_components.append(component)
        total_price = sum((c.get("price", 0) or 0) * (c.get("quantity", 1) or 1) for c in selected_components)

        if self.collection is not None:
            self.collection.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "account_id": account_id or doc.get("account_id"),
                        "selected_components": selected_components,
                        "total_price": total_price,
                        "status": "active",
                        "updated_at": now,
                        "expires_at": now + timedelta(days=30),
                    }
                },
            )
            return self.collection.find_one({"session_id": session_id}) or {}

        doc["selected_components"] = selected_components
        doc["total_price"] = total_price
        return doc

    def remove_component(self, session_id: str, slot: str) -> Dict[str, Any]:
        doc = self.get_or_create(session_id=session_id)
        now = datetime.now(timezone.utc)

        normalized_slot = slot.upper()
        selected_components = [c for c in doc.get("selected_components", []) if c.get("slot") != normalized_slot]
        total_price = sum((c.get("price", 0) or 0) * (c.get("quantity", 1) or 1) for c in selected_components)

        if self.collection is not None:
            self.collection.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "selected_components": selected_components,
                        "total_price": total_price,
                        "updated_at": now,
                        "expires_at": now + timedelta(days=30),
                    }
                },
            )
            return self.collection.find_one({"session_id": session_id}) or {}

        doc["selected_components"] = selected_components
        doc["total_price"] = total_price
        return doc

    def validate_checkout(self, session_id: str) -> Dict[str, Any]:
        doc = self.get_or_create(session_id=session_id)
        selected_slots = {str(c.get("slot", "")).upper() for c in doc.get("selected_components", [])}
        missing_slots = [slot for slot in self.required_slots if slot not in selected_slots]

        return {
            "session_id": session_id,
            "ready": len(missing_slots) == 0,
            "missing_slots": missing_slots,
            "total_price": doc.get("total_price", 0) or 0,
        }

    def _validate_hardware_compatibility(
        self,
        payload: BuildComponentPayload,
        selected_components: List[Dict[str, Any]],
    ) -> None:
        if self.mongo_search_service is None:
            return

        from app.services.compatibility_checker import validate_build

        # Gather all product IDs to fetch from DB
        product_ids = [payload.product_id]
        for c in selected_components:
            if c.get("product_id"):
                product_ids.append(str(c.get("product_id")))

        docs = self.mongo_search_service.get_products_by_ids(product_ids)
        if not docs:
            return

        # Inject _selected_slot into docs so validate_build knows what slot they belong to
        for doc in docs:
            doc_id = str(doc.get("_id", ""))
            if doc_id == payload.product_id:
                doc["_selected_slot"] = payload.slot
            else:
                for c in selected_components:
                    if str(c.get("product_id", "")) == doc_id:
                        doc["_selected_slot"] = c.get("slot")
                        break

        warnings = validate_build(docs)
        for warning in warnings:
            # Only hard-block on critical errors
            if "KHONG TUONG THICH" in warning or "CANH BAO QUAN TRONG" in warning:
                raise ValueError(warning)
