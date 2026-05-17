import html
import re
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import MongoClient
from app.agents.contracts import RetrievedEvidence


class MongoSearchService:
    _CATEGORY_BY_SLOT = {
        "CPU": "69ac61dba931fab39af1232e",
        "GPU": "69ac61dba931fab39af1232f",
        "RAM": "69ac61dba931fab39af12330",
        "MAINBOARD": "69ac61dba931fab39af12331",
        "PSU": "69ac61dba931fab39af12332",
        "CASE": "69ac61dba931fab39af12333",
        "SSD": "69ac61dba931fab39af12334",
        "COOLER": "69ac61dba931fab39af12335",
    }

    _BRAND_SLOT_SCOPE = {
        "INTEL": ["CPU", "MAINBOARD"],
        "AMD": ["CPU", "MAINBOARD"],
        "NVIDIA": ["GPU"],
    }

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

        # Singleton MongoClient — reuse connection pool across all queries
        # instead of paying TCP/TLS handshake cost on every call.
        self._client = MongoClient(mongodb_uri) if mongodb_uri else None
        self._coll = self._client[database][collection] if self._client else None

    def hybrid_search(
        self,
        query: str,
        query_vector: List[float],
        limit: int = 5,
        max_price: Optional[float] = None,
        selected_brand: Optional[str] = None,
        preferred_slots: Optional[List[str]] = None,
    ) -> List[RetrievedEvidence]:
        if self._coll is None:
            return []

        coll = self._coll

        text_pipeline: List[Dict[str, Any]] = [
            {
                "$search": {
                    "index": self.text_index,
                    "text": {"query": query, "path": ["name", "model", "description_html", "embedding_text"]},
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
                    "textScore": {"$meta": "searchScore"},
                }
            },
        ]
        if max_price is not None:
            text_pipeline.append({"$match": {"price": {"$lte": max_price}}})
        brand_filter = self._build_brand_filter_for_hybrid(selected_brand)
        if brand_filter:
            text_pipeline.append({"$match": brand_filter})
        preferred_category_ids = self._category_ids_for_slots(preferred_slots)
        if preferred_category_ids:
            text_pipeline.append({"$match": {"categoryId": {"$in": preferred_category_ids}}})
        text_pipeline.append({"$limit": limit * 2})

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
        if max_price is not None:
            vector_pipeline.append({"$match": {"price": {"$lte": max_price}}})
        if brand_filter:
            vector_pipeline.append({"$match": brand_filter})
        if preferred_category_ids:
            vector_pipeline.append({"$match": {"categoryId": {"$in": preferred_category_ids}}})

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
        )

        if max_price is not None:
            ranked = [
                doc
                for doc in ranked
                if self._to_number(doc.get("price")) is not None
                and self._to_number(doc.get("price")) > 0
                and self._to_number(doc.get("price")) <= max_price
            ]

        ranked = ranked[:limit]

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
        return self._fallback_text_search(
            coll=coll,
            query=query,
            limit=limit,
            max_price=max_price,
            selected_brand=selected_brand,
            preferred_slots=preferred_slots,
        )

    def get_products_by_ids(self, ids: List[str]) -> List[Dict[str, Any]]:
        if self._coll is None or not ids:
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

        coll = self._coll
        return list(
            coll.find(
                {"_id": {"$in": object_ids}},
                {
                    "_id": 1,
                    "name": 1,
                    "categoryId": 1,
                    "socket": 1,
                    "specs_raw": 1,
                    # -- Compatibility checker fields --
                    # PSU validation
                    "tdp_w": 1,
                    "recommended_psu_w": 1,
                    "wattage_w": 1,
                    # RAM type match
                    "ram_type": 1,
                    # iGPU safety
                    "has_igpu": 1,
                    # M.2 slot count
                    "m2_slots": 1,
                    "interface": 1,
                    "form_factor": 1,
                    # Form factor match
                    "case_type": 1,
                    # Cooler socket
                    "supported_sockets": 1,
                },
            )
        )

    def get_budget_products_by_slots(
        self,
        slot_order: List[str],
        budget_max: float,
        total_limit: int = 4,
        per_slot_limit: int = 2,
        max_per_item_ratio: float = 0.5,
        selected_brand: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if self._coll is None or not slot_order or budget_max <= 0:
            return []

        max_item_price = max(1.0, min(budget_max, budget_max * max_per_item_ratio))

        coll = self._coll

        slot_buckets: List[List[Dict[str, Any]]] = []
        seen = set()
        for slot in slot_order:
            slot_upper = slot.upper()
            category_id = self._CATEGORY_BY_SLOT.get(slot_upper)
            if not category_id:
                continue

            base_query: Dict[str, Any] = {
                "categoryId": ObjectId(category_id),
                "price": {"$gt": 0, "$lte": max_item_price},
            }
            brand_clause = self._build_brand_clause_for_slot(slot_upper, selected_brand)
            query = {"$and": [base_query, brand_clause]} if brand_clause else base_query

            docs = list(
                coll.find(
                    query,
                    {
                        "_id": 1,
                        "name": 1,
                        "url": 1,
                        "image": 1,
                        "price": 1,
                        "categoryId": 1,
                        "categoryCode": 1,
                    },
                )
                .sort("price", 1)
                .limit(per_slot_limit)
            )

            # Also sample higher-priced options within the same slot to avoid always falling into cheapest-only bundles.
            high_query: Dict[str, Any] = dict(query)
            high_ratio = 0.85
            if slot_upper == "GPU":
                high_ratio = 0.95
            elif slot_upper == "CPU":
                high_ratio = 0.85
            elif slot_upper == "MAINBOARD":
                high_ratio = 0.75
            elif slot_upper in {"RAM", "SSD", "PSU", "CASE", "COOLER"}:
                high_ratio = 0.50
            high_price_ceiling = max(1.0, max_item_price * high_ratio)
            if isinstance(high_query.get("price"), dict):
                updated_price = dict(high_query.get("price", {}))
                current_lte = updated_price.get("$lte")
                if isinstance(current_lte, (int, float)):
                    updated_price["$lte"] = min(float(current_lte), high_price_ceiling)
                else:
                    updated_price["$lte"] = high_price_ceiling
                high_query["price"] = updated_price
            if isinstance(query, dict) and isinstance(query.get("$and"), list):
                patched_and: List[Dict[str, Any]] = []
                for clause in query.get("$and", []):
                    if not isinstance(clause, dict) or "price" not in clause:
                        patched_and.append(clause)
                        continue

                    price_clause = clause.get("price")
                    if not isinstance(price_clause, dict):
                        patched_and.append(clause)
                        continue

                    updated_price = dict(price_clause)
                    current_lte = updated_price.get("$lte")
                    if isinstance(current_lte, (int, float)):
                        updated_price["$lte"] = min(float(current_lte), high_price_ceiling)
                    else:
                        updated_price["$lte"] = high_price_ceiling

                    patched = dict(clause)
                    patched["price"] = updated_price
                    patched_and.append(patched)

                high_query["$and"] = patched_and

            upper_docs = list(
                coll.find(
                    high_query,
                    {
                        "_id": 1,
                        "name": 1,
                        "url": 1,
                        "image": 1,
                        "price": 1,
                        "categoryId": 1,
                        "categoryCode": 1,
                    },
                )
                .sort("price", -1)
                .limit(per_slot_limit)
            )

            slot_result: List[Dict[str, Any]] = []
            for doc in self._interleave_doc_lists(docs, upper_docs):
                doc_id = str(doc.get("_id", ""))
                if not doc_id or doc_id in seen:
                    continue
                seen.add(doc_id)
                slot_result.append(doc)

            if slot_result:
                slot_buckets.append(slot_result)

        return self._merge_slot_docs_round_robin(slot_buckets, total_limit)

    @staticmethod
    def _merge_slot_docs_round_robin(slot_buckets: List[List[Dict[str, Any]]], total_limit: int) -> List[Dict[str, Any]]:
        if total_limit <= 0 or not slot_buckets:
            return []

        merged: List[Dict[str, Any]] = []
        index = 0
        progressed = True
        while len(merged) < total_limit and progressed:
            progressed = False
            for bucket in slot_buckets:
                if index >= len(bucket):
                    continue
                merged.append(bucket[index])
                progressed = True
                if len(merged) >= total_limit:
                    break
            index += 1

        return merged

    @staticmethod
    def _interleave_doc_lists(low_docs: List[Dict[str, Any]], high_docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        interleaved: List[Dict[str, Any]] = []
        max_len = max(len(low_docs), len(high_docs))
        for idx in range(max_len):
            if idx < len(low_docs):
                interleaved.append(low_docs[idx])
            if idx < len(high_docs):
                interleaved.append(high_docs[idx])
        return interleaved

    def get_alternative_products_for_slot(
        self,
        slot: str,
        budget_max: float,
        target_price: Optional[float] = None,
        limit: int = 4,
        exclude_product_ids: Optional[List[str]] = None,
        selected_brand: Optional[str] = None,
        preferred_socket: Optional[str] = None,
        preferred_platform: Optional[str] = None,
        query_filter: Optional[str] = None,
        sort_by_relevance: bool = False,
    ) -> List[Dict[str, Any]]:
        if self._coll is None or not slot or budget_max <= 0:
            return []

        slot_upper = slot.upper()
        category_id = self._CATEGORY_BY_SLOT.get(slot_upper)
        
        # Keywords to identify the slot in the name as a fallback for miscategorized items
        slot_keywords = {
            "CPU": ["CPU", "Bộ vi xử lý", "Ryzen", "Intel Core"],
            "GPU": ["VGA", "Card màn hình", "RTX", "GTX", "Radeon"],
            "MAINBOARD": ["Mainboard", "Bo mạch chủ", "Motherboard"],
            "RAM": ["RAM", "Bộ nhớ trong"],
            "SSD": ["SSD", "M.2 NVMe"],
            "HDD": ["HDD", "Ổ cứng HDD"],
            "PSU": ["Nguồn máy tính", "PSU"],
            "CASE": ["Thùng máy", "Case"],
            "COOLER": ["Tản nhiệt", "Cooler", "Fan Case"],
        }
        keywords = slot_keywords.get(slot_upper, [])
        name_regex = "|".join(re.escape(k) for k in keywords)

        if query_filter:
            or_clause = []
            if category_id:
                or_clause.append({"categoryId": ObjectId(category_id)})
            if name_regex:
                or_clause.append({"name": {"$regex": name_regex, "$options": "i"}})

            # Build name filter with query_filter
            name_filter = {"name": {"$regex": re.escape(query_filter), "$options": "i"}}

            # If query is simple "RTX 4060" (not "RTX 4060 Ti"), add negative lookahead to exclude Ti
            q_lower = query_filter.lower().strip()
            if "ti" not in q_lower and "Ti" not in query_filter:
                # Add negative lookahead to exclude Ti variants
                name_filter = {"name": {"$regex": f"{re.escape(query_filter)}(?!Ti)", "$options": "i"}}

            query: Dict[str, Any] = {
                "price": {"$gt": 0, "$lte": budget_max},
                "$and": [
                    name_filter,
                    {"$or": or_clause} if or_clause else {"categoryId": {"$exists": True}},
                ]
            }
        else:
            query = {
                "price": {"$gt": 0, "$lte": budget_max},
                "$or": []
            }
            if category_id:
                query["$or"].append({"categoryId": ObjectId(category_id)})
            if name_regex:
                query["$or"].append({"name": {"$regex": name_regex, "$options": "i"}})
            if not query["$or"]:
                del query["$or"]

        # Exclude CPU products from GPU search (CPUs with iGPU have "Radeon Graphics" in name)
        if slot_upper == "GPU":
            cpu_cat = self._CATEGORY_BY_SLOT.get("CPU")
            if cpu_cat:
                if "$and" not in query:
                    query = {"$and": [query, {"categoryId": {"$ne": ObjectId(cpu_cat)}}]}
                else:
                    query["$and"].append({"categoryId": {"$ne": ObjectId(cpu_cat)}})

        excluded: List[Any] = []
        for value in exclude_product_ids or []:
            if not value:
                continue
            if ObjectId.is_valid(value):
                excluded.append(ObjectId(value))
            else:
                excluded.append(value)
        if excluded:
            query["_id"] = {"$nin": excluded}

        if target_price and target_price > 0:
            # When upgrading, we want something better than what we have, up to the budget cap
            # but if no current price is provided, we use a broad range
            query["price"] = {"$gt": 0, "$lte": budget_max}
        else:
            query["price"] = {"$gt": 0, "$lte": budget_max}

        brand_clause = self._build_brand_clause_for_slot(slot_upper, selected_brand)
        and_clauses: List[Dict[str, Any]] = [query]
        if brand_clause:
            and_clauses.append(brand_clause)

        socket_text = str(preferred_socket or "").strip().upper()
        if socket_text:
            # Support both "LGA1700" and "1700" format from DB
            # Normalize to bare number for DB matching
            normalized_socket = socket_text.replace("LGA", "")
            socket_regex = re.compile(re.escape(normalized_socket), re.IGNORECASE)
            and_clauses.append(
                {
                    "$or": [
                        {"socket": socket_regex},
                        {"specs_raw.Socket": socket_regex},
                        {"specs_raw.socket": socket_regex},
                        {"specs_raw.SOCKET": socket_regex},
                        {"name": socket_regex},
                    ]
                }
            )

        platform_text = str(preferred_platform or "").strip().upper()
        # Only apply platform filter if no socket filter is provided
        # (socket already implies platform, so platform filter is redundant and may exclude valid matches)
        if platform_text in {"AMD", "INTEL"} and not socket_text:
            platform_regex = re.compile(platform_text, re.IGNORECASE)
            chipset_regex = None
            if platform_text == "AMD":
                is_am5 = socket_text == "AM5" or "AM5" in str(preferred_platform or "").upper()
                if is_am5:
                    chipset_regex = re.compile(r"\b(A620|B650|X670|X870|AM5)\b", re.IGNORECASE)
                else:
                    chipset_regex = re.compile(r"\b(A320|A520|B350|B450|B550|X370|X470|X570|AM4)\b", re.IGNORECASE)
            if platform_text == "INTEL":
                is_lga1700 = "1700" in socket_text
                if is_lga1700:
                    chipset_regex = re.compile(r"\b(H610|B660|B760|Z690|Z790|LGA ?1700)\b", re.IGNORECASE)
                else:
                    chipset_regex = re.compile(r"\b(H310|H410|H510|B360|B460|B560|Z390|Z490|Z590|LGA ?1200|LGA ?1151)\b", re.IGNORECASE)

            platform_or = [
                {"brand": platform_regex},
                {"model": platform_regex},
                {"name": platform_regex},
                {"specs_raw.Brand": platform_regex},
                {"specs_raw.brand": platform_regex},
                {"specs_raw.Thương hiệu": platform_regex},
                {"specs_raw.Thuong hieu": platform_regex},
            ]
            if chipset_regex is not None:
                platform_or.append({"name": chipset_regex})
                platform_or.append({"specs_raw.Chipset": chipset_regex})
                platform_or.append({"specs_raw.chipset": chipset_regex})
            and_clauses.append({"$or": platform_or})

        scoped_query = and_clauses[0] if len(and_clauses) == 1 else {"$and": and_clauses}

        coll = self._coll

        # If query_filter is provided, use regex search and sort by relevance
        # Preference: exact match (non-Ti) first, then by name length
        if query_filter:
            try:
                docs = list(
                    coll.find(
                        scoped_query,
                        {
                            "_id": 1,
                            "name": 1,
                            "url": 1,
                            "image": 1,
                            "price": 1,
                            "categoryId": 1,
                            "categoryCode": 1,
                            "socket": 1,
                            "specs_raw": 1,
                        },
                    )
                )
                # Sort: non-Ti (exact match) first, then by name length
                def sort_key(x):
                    name = x.get("name", "")
                    has_ti = "Ti" in name
                    # Non-Ti first (False=0 before True=1), then by name length
                    return (1 if has_ti else 0, len(name))
                docs.sort(key=sort_key)
                docs = docs[:max(limit * 8, 20)]
            except Exception:
                docs = []
        else:
            docs = list(
                coll.find(
                    scoped_query,
                    {
                        "_id": 1,
                        "name": 1,
                        "url": 1,
                        "image": 1,
                        "price": 1,
                        "categoryId": 1,
                        "categoryCode": 1,
                        "socket": 1,
                        "specs_raw": 1,
                    },
                ).sort("price", -1).limit(max(limit * 8, 20))
            )

        if not docs and target_price and target_price > 0:
            broad_query = {
                "categoryId": ObjectId(category_id),
                "price": {"$gt": 0, "$lte": budget_max},
            }
            if excluded:
                broad_query["_id"] = {"$nin": excluded}
            broad_clauses: List[Dict[str, Any]] = [broad_query]
            if brand_clause:
                broad_clauses.append(brand_clause)
            if socket_text:
                normalized_socket = socket_text.replace("LGA", "")
                socket_regex = re.compile(re.escape(normalized_socket), re.IGNORECASE)
                broad_clauses.append(
                    {
                        "$or": [
                            {"socket": socket_regex},
                            {"specs_raw.Socket": socket_regex},
                            {"specs_raw.socket": socket_regex},
                            {"specs_raw.SOCKET": socket_regex},
                            {"name": socket_regex},
                        ]
                    }
                )
            if platform_text in {"AMD", "INTEL"} and not socket_text:
                platform_regex = re.compile(platform_text, re.IGNORECASE)
                chipset_regex = None
                if platform_text == "AMD":
                    chipset_regex = re.compile(r"\b(A320|A520|B350|B450|B550|B650|X370|X470|X570|X670|AM4|AM5)\b", re.IGNORECASE)
                if platform_text == "INTEL":
                    chipset_regex = re.compile(r"\b(H610|B660|B760|Z690|Z790|LGA ?1200|LGA ?1700|INTEL)\b", re.IGNORECASE)
                platform_or = [
                    {"brand": platform_regex},
                    {"model": platform_regex},
                    {"name": platform_regex},
                    {"specs_raw.Brand": platform_regex},
                    {"specs_raw.brand": platform_regex},
                    {"specs_raw.Thương hiệu": platform_regex},
                    {"specs_raw.Thuong hieu": platform_regex},
                ]
                if chipset_regex is not None:
                    platform_or.append({"name": chipset_regex})
                broad_clauses.append({"$or": platform_or})
            broad_query = broad_clauses[0] if len(broad_clauses) == 1 else {"$and": broad_clauses}
            docs = list(
                coll.find(
                    broad_query,
                    {
                        "_id": 1,
                        "name": 1,
                        "url": 1,
                        "image": 1,
                        "price": 1,
                        "categoryId": 1,
                        "categoryCode": 1,
                        "socket": 1,
                        "specs_raw": 1,
                    },
                ).limit(max(limit * 8, 20))
            )

        if sort_by_relevance and docs:
            # Sort by relevance: non-Ti first, shorter name first, then price distance
            def relevance_sort_key(d):
                name = d.get("name", "")
                has_ti = "Ti" in name
                price_dist = abs(float(d.get("price", 0)) - (target_price or 0)) if target_price else float(d.get("price", 0))
                return (1 if has_ti else 0, len(name), price_dist)
            docs.sort(key=relevance_sort_key)
        elif target_price and target_price > 0 and docs:
            docs.sort(key=lambda d: (abs(float(d.get("price", 0)) - target_price), float(d.get("price", 0))))
        else:
            docs.sort(key=lambda d: float(d.get("price", 0)))

        return docs[:limit]

    @staticmethod
    def _extract_terms(query: str) -> List[str]:
        tokens = re.findall(r"[A-Za-z0-9_/]+", query.lower())
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
        terms = [t for t in tokens if len(t) >= 2 and t not in stopwords]
        # Keep order but remove duplicates.
        deduped: List[str] = []
        seen = set()
        for term in terms:
            if term not in seen:
                seen.add(term)
                deduped.append(term)
        return deduped[:20]

    def _fallback_text_search(
        self,
        coll: Any,
        query: str,
        limit: int,
        max_price: Optional[float] = None,
        selected_brand: Optional[str] = None,
        preferred_slots: Optional[List[str]] = None,
    ) -> List[RetrievedEvidence]:
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

        if max_price is not None:
            filter_query["price"] = {"$lte": max_price}

        brand_filter = self._build_brand_filter_for_hybrid(selected_brand)
        if brand_filter:
            if filter_query:
                filter_query = {"$and": [filter_query, brand_filter]}
            else:
                filter_query = brand_filter

        preferred_category_ids = self._category_ids_for_slots(preferred_slots)
        if preferred_category_ids:
            preferred_filter: Dict[str, Any] = {"categoryId": {"$in": preferred_category_ids}}
            if filter_query:
                filter_query = {"$and": [filter_query, preferred_filter]}
            else:
                filter_query = preferred_filter

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
    def _normalize_brand_token(value: Optional[str]) -> Optional[str]:
        if not isinstance(value, str):
            return None
        normalized = value.strip().upper()
        if not normalized:
            return None
        if "INTEL" in normalized:
            return "INTEL"
        if "NVIDIA" in normalized:
            return "NVIDIA"
        if "AMD" in normalized:
            return "AMD"
        return None

    @staticmethod
    def _brand_regex_for(brand: str, slot: str) -> Dict[str, str]:
        slot_upper = slot.upper()
        if brand == "NVIDIA":
            pattern = r"(NVIDIA|GEFORCE|\bRTX\b|\bGTX\b|QUADRO)"
        elif brand == "AMD" and slot_upper == "MAINBOARD":
            pattern = r"(\bAMD\b|\bAM4\b|\bAM5\b|B450|B550|B650|X570|X670)"
        elif brand == "AMD":
            pattern = r"(\bAMD\b|RYZEN|ATHLON|RADEON)"
        elif brand == "INTEL" and slot_upper == "MAINBOARD":
            pattern = r"(\bINTEL\b|\bLGA\s?1700\b|\bLGA\s?1200\b|\bLGA\s?1151\b|B660|B760|Z690|Z790|H610)"
        else:
            pattern = r"(\bINTEL\b|CORE\s*I[3579]|PENTIUM|CELERON)"
        return {"$regex": pattern, "$options": "i"}

    @classmethod
    def _build_brand_clause_for_slot(cls, slot: str, selected_brand: Optional[str]) -> Optional[Dict[str, Any]]:
        brand = cls._normalize_brand_token(selected_brand)
        if not brand:
            return None

        allowed_slots = cls._BRAND_SLOT_SCOPE.get(brand)
        if not allowed_slots or slot.upper() not in allowed_slots:
            return None

        regex = cls._brand_regex_for(brand, slot)
        return {
            "$or": [
                {"brand": regex},
                {"name": regex},
                {"model": regex},
                {"embedding_text": regex},
                {"specs_raw.Thương hiệu": regex},
                {"specs_raw.Thuong hieu": regex},
                {"specs_raw.Brand": regex},
                {"specs_raw.brand": regex},
            ]
        }

    @classmethod
    def _build_brand_filter_for_hybrid(cls, selected_brand: Optional[str]) -> Optional[Dict[str, Any]]:
        brand = cls._normalize_brand_token(selected_brand)
        if not brand:
            return None

        slots = cls._BRAND_SLOT_SCOPE.get(brand)
        if not slots:
            return None

        category_ids = [ObjectId(cls._CATEGORY_BY_SLOT[slot]) for slot in slots if slot in cls._CATEGORY_BY_SLOT]
        if not category_ids:
            return None

        slot_scope_filters: List[Dict[str, Any]] = []
        for slot in slots:
            category_hex = cls._CATEGORY_BY_SLOT.get(slot)
            if not category_hex:
                continue
            slot_clause = cls._build_brand_clause_for_slot(slot, brand)
            if not slot_clause:
                continue
            slot_scope_filters.append(
                {
                    "$and": [
                        {"categoryId": ObjectId(category_hex)},
                        slot_clause,
                    ]
                }
            )

        if not slot_scope_filters:
            return None

        return {
            "$or": [
                {"categoryId": {"$nin": category_ids}},
                *slot_scope_filters,
            ]
        }

    @classmethod
    def _category_ids_for_slots(cls, slots: Optional[List[str]]) -> List[ObjectId]:
        if not slots:
            return []

        category_ids: List[ObjectId] = []
        seen = set()
        for slot in slots:
            if not isinstance(slot, str):
                continue
            category_hex = cls._CATEGORY_BY_SLOT.get(slot.upper())
            if not category_hex or category_hex in seen:
                continue
            seen.add(category_hex)
            category_ids.append(ObjectId(category_hex))
        return category_ids

    @staticmethod
    def _to_number(value: object) -> Optional[float]:
        if isinstance(value, (int, float)):
            return float(value)
        if not isinstance(value, str):
            return None

        cleaned = re.sub(r"[^\d.,]", "", value)
        if not cleaned:
            return None

        if re.fullmatch(r"\d+[.,]\d{1,2}", cleaned):
            normalized = cleaned.replace(",", ".")
        else:
            normalized = cleaned.replace(".", "").replace(",", "")

        try:
            return float(normalized)
        except ValueError:
            return None

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
