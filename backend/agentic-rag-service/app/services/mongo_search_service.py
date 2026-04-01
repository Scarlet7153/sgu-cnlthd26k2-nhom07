import html
import re
from typing import Any, Dict, List

from bson import ObjectId
from pymongo import MongoClient
from app.agents.contracts import RetrievedEvidence


class MongoSearchService:
    def __init__(
        self,
        mongodb_uri: str,
        database: str,
        collection: str,
        text_index: str,
        vector_index: str,
        embedding_field: str,
        text_weight: float,
        vector_weight: float,
    ) -> None:
        self.mongodb_uri = mongodb_uri
        self.database = database
        self.collection = collection
        self.text_index = text_index
        self.vector_index = vector_index
        self.embedding_field = embedding_field
        self.text_weight = text_weight
        self.vector_weight = vector_weight

    def hybrid_search(self, query: str, query_vector: List[float], limit: int = 5) -> List[RetrievedEvidence]:
        if not self.mongodb_uri:
            return []

        client = MongoClient(self.mongodb_uri)
        coll = client[self.database][self.collection]

        text_pipeline: List[Dict[str, Any]] = [
            {
                "$search": {
                    "index": self.text_index,
                    "text": {"query": query, "path": ["name", "model", "description_html", "embedding_text"]},
                }
            },
            {"$limit": limit * 2},
            {
                "$project": {
                    "_id": 1,
                    "name": 1,
                    "model": 1,
                    "url": 1,
                    "image": 1,
                    "price": 1,
                    "categoryId": 1,
                    "description_html": 1,
                    "textScore": {"$meta": "searchScore"},
                }
            },
        ]

        vector_pipeline: List[Dict[str, Any]] = [
            {
                "$vectorSearch": {
                    "index": self.vector_index,
                    "path": self.embedding_field,
                    "queryVector": query_vector,
                    "numCandidates": max(50, limit * 10),
                    "limit": limit * 2,
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "name": 1,
                    "model": 1,
                    "url": 1,
                    "image": 1,
                    "price": 1,
                    "categoryId": 1,
                    "description_html": 1,
                    "vectorScore": {"$meta": "vectorSearchScore"},
                }
            },
        ]

        try:
            text_results = list(coll.aggregate(text_pipeline))
        except Exception:
            text_results = []

        try:
            vector_results = list(coll.aggregate(vector_pipeline))
        except Exception:
            vector_results = []

        merged: Dict[str, Dict[str, Any]] = {}
        for doc in text_results:
            key = str(doc.get("_id"))
            merged[key] = {**doc, "textScore": float(doc.get("textScore", 0.0)), "vectorScore": 0.0}

        for doc in vector_results:
            key = str(doc.get("_id"))
            if key not in merged:
                merged[key] = {**doc, "textScore": 0.0, "vectorScore": float(doc.get("vectorScore", 0.0))}
            else:
                merged[key]["vectorScore"] = float(doc.get("vectorScore", 0.0))

        ranked = sorted(
            merged.values(),
            key=lambda d: (self.text_weight * d.get("textScore", 0.0)) + (self.vector_weight * d.get("vectorScore", 0.0)),
            reverse=True,
        )[:limit]

        evidences: List[RetrievedEvidence] = []
        for doc in ranked:
            combined_score = (self.text_weight * doc.get("textScore", 0.0)) + (
                self.vector_weight * doc.get("vectorScore", 0.0)
            )
            evidences.append(
                RetrievedEvidence(
                    source="db",
                    title=doc.get("name", "Unknown product"),
                    snippet=self._clean_snippet(doc.get("description_html", "")),
                    score=float(combined_score),
                    url=doc.get("url", ""),
                    raw=doc,
                )
            )

        if evidences:
            return evidences

        # Fallback for environments without Atlas Search indexes.
        return self._fallback_text_search(coll=coll, query=query, limit=limit)

    def get_products_by_ids(self, ids: List[str]) -> List[Dict[str, Any]]:
        if not self.mongodb_uri or not ids:
            return []

        object_ids: List[Any] = []
        for value in ids:
            if not value:
                continue
            if ObjectId.is_valid(value):
                object_ids.append(ObjectId(value))
            else:
                object_ids.append(value)

        if not object_ids:
            return []

        client = MongoClient(self.mongodb_uri)
        coll = client[self.database][self.collection]
        return list(
            coll.find(
                {"_id": {"$in": object_ids}},
                {
                    "_id": 1,
                    "name": 1,
                    "categoryId": 1,
                    "socket": 1,
                    "specs_raw": 1,
                },
            )
        )

    @staticmethod
    def _extract_terms(query: str) -> List[str]:
        tokens = re.findall(r"[A-Za-z0-9_]+", query.lower())
        stopwords = {
            "tu",
            "van",
            "cau",
            "hinh",
            "cho",
            "toi",
            "nha",
            "la",
            "va",
            "the",
            "with",
            "build",
            "pc",
            "trieu",
        }
        terms = [t for t in tokens if len(t) >= 3 and t not in stopwords]
        # Keep order but remove duplicates.
        deduped: List[str] = []
        seen = set()
        for term in terms:
            if term not in seen:
                seen.add(term)
                deduped.append(term)
        return deduped[:8]

    def _fallback_text_search(self, coll: Any, query: str, limit: int) -> List[RetrievedEvidence]:
        terms = self._extract_terms(query)
        pattern = "|".join(re.escape(t) for t in terms) if terms else ""

        filter_query: Dict[str, Any] = {}
        if pattern:
            regex = {"$regex": pattern, "$options": "i"}
            filter_query = {
                "$or": [
                    {"name": regex},
                    {"model": regex},
                    {"embedding_text": regex},
                    {"specs_raw.Thương hiệu": regex},
                ]
            }

        docs = list(
            coll.find(
                filter_query,
                {
                    "_id": 1,
                    "name": 1,
                    "model": 1,
                    "url": 1,
                    "image": 1,
                    "price": 1,
                    "categoryId": 1,
                    "description_html": 1,
                },
            ).limit(max(limit * 2, limit))
        )

        evidences: List[RetrievedEvidence] = []
        for idx, doc in enumerate(docs[:limit], start=1):
            score = round(max(0.1, 0.6 - (idx - 1) * 0.05), 3)
            evidences.append(
                RetrievedEvidence(
                    source="db",
                    title=doc.get("name", "Unknown product"),
                    snippet=self._clean_snippet(doc.get("description_html", "")),
                    score=score,
                    url=doc.get("url", ""),
                    raw=doc,
                )
            )

        return evidences

    @staticmethod
    def _clean_snippet(value: object, max_len: int = 280) -> str:
        if not isinstance(value, str):
            return ""

        text = html.unescape(value)
        # Decode common JSON-escaped HTML markers before removing tags.
        text = re.sub(r"\\u003[cC]", "<", text)
        text = re.sub(r"\\u003[eE]", ">", text)
        text = re.sub(r"\\u0026", "&", text)
        text = re.sub(r"\\u00[a-fA-F0-9]{2}", " ", text)

        text = re.sub(r"<[^>]*>", " ", text)
        # Remove dangling tag fragments created by truncated HTML.
        text = re.sub(r"<[A-Za-z/][^<]{0,60}$", " ", text)
        text = " ".join(text.split())

        if len(text) <= max_len:
            return text
        return text[: max_len - 3].rstrip() + "..."
