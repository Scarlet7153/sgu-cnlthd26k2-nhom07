from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import uuid4

from pymongo import ASCENDING, DESCENDING, MongoClient

from app.schemas.chat import ProductSuggestion


class ChatHistoryService:
    def __init__(self, mongodb_uri: str, database: str, collection: str) -> None:
        self.client = MongoClient(mongodb_uri) if mongodb_uri else None
        self.collection = self.client[database][collection] if self.client else None

        if self.collection is not None:
            self.collection.create_index([("session_id", ASCENDING)], unique=True)
            self.collection.create_index([("account_id", ASCENDING), ("updated_at", DESCENDING)])
            self.collection.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)

    def append_user_message(self, session_id: str, account_id: str | None, query: str, context: Dict[str, Any]) -> None:
        if self.collection is None:
            return

        now = datetime.now(timezone.utc)
        update_doc: Dict[str, Any] = {
            "$setOnInsert": {
                "session_id": session_id,
                "status": "active",
                "created_at": now,
            },
            "$set": {
                "updated_at": now,
                "context_summary": self._context_summary(context),
                "expires_at": now + timedelta(days=30),
            },
            "$push": {
                "messages": {
                    "message_id": str(uuid4()),
                    "role": "user",
                    "content": query,
                    "created_at": now,
                }
            },
        }

        if account_id:
            update_doc["$set"]["account_id"] = account_id
        else:
            update_doc["$setOnInsert"]["account_id"] = None

        self.collection.update_one({"session_id": session_id}, update_doc, upsert=True)

    def append_assistant_message(self, session_id: str, answer: str, products: List[ProductSuggestion]) -> None:
        if self.collection is None:
            return

        now = datetime.now(timezone.utc)
        self.collection.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "updated_at": now,
                    "expires_at": now + timedelta(days=30),
                },
                "$push": {
                    "messages": {
                        "message_id": str(uuid4()),
                        "role": "assistant",
                        "content": answer,
                        "products": [self._product_to_dict(p) for p in products],
                        "created_at": now,
                    }
                },
            },
            upsert=True,
        )

    def update_context(self, session_id: str, account_id: str | None, context: Dict[str, Any]) -> None:
        if self.collection is None:
            return

        now = datetime.now(timezone.utc)
        update_doc: Dict[str, Any] = {
            "$setOnInsert": {
                "session_id": session_id,
                "status": "active",
                "created_at": now,
            },
            "$set": {
                "updated_at": now,
                "context_summary": self._context_summary(context),
                "expires_at": now + timedelta(days=30),
            },
        }

        if account_id:
            update_doc["$set"]["account_id"] = account_id
        else:
            update_doc["$setOnInsert"]["account_id"] = None

        self.collection.update_one({"session_id": session_id}, update_doc, upsert=True)

    def get_context_summary(self, session_id: str, account_id: str | None) -> Dict[str, Any] | None:
        if self.collection is None:
            return None
        query = {"session_id": session_id}
        if account_id:
            query["account_id"] = account_id
        doc = self.collection.find_one(query, {"context_summary": 1})
        if doc and doc.get("context_summary"):
            return doc["context_summary"]
        return None

    @staticmethod
    def _context_summary(context: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "budget_text": context.get("budget"),
            "budget_exact": context.get("budgetExact"),
            "purpose": context.get("purpose"),
            "brand": context.get("brand"),
            "budget_min": context.get("budget_min"),
            "budget_max": context.get("budget_max"),
        }

    @staticmethod
    def _product_to_dict(p: ProductSuggestion) -> Dict[str, Any]:
        return {
            "product_id": p.product_id,
            "category_id": p.category_id,
            "slot": p.slot,
            "name": p.name,
            "price": p.price,
            "image": p.image,
            "url": p.url,
            "reason": p.reason,
        }
