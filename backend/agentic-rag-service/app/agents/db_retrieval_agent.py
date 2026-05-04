import re
import unicodedata

from app.agents.contracts import AgentObservation, AgentTask
from app.services.embedding_service import EmbeddingService
from app.services.mongo_search_service import MongoSearchService


class DBRetrievalAgent:
    name = "db_retrieval"

    def __init__(self, mongo_service: MongoSearchService, embedding_service: EmbeddingService) -> None:
        self.mongo_service = mongo_service
        self.embedding_service = embedding_service

    def run(self, task: AgentTask) -> AgentObservation:
        try:
            retrieval_query = self._compose_retrieval_query(task.query, task.context)
            budget_max = self._extract_budget_max(task.context)
            selected_brand = self._extract_selected_brand(task.context)
            preferred_slots = self._extract_preferred_slots(task.query)
            
            # Use the total budget as a hard limit at the DB level to filter out 
            # items that are more expensive than the entire build.
            effective_max_price = budget_max 

            vector = self.embedding_service.embed(retrieval_query)
            evidences = self.mongo_service.hybrid_search(
                retrieval_query,
                vector,
                limit=task.max_results,
                max_price=effective_max_price,
                selected_brand=selected_brand,
                preferred_slots=preferred_slots,
            )
            return AgentObservation(
                success=True,
                action="hybrid_search",
                message=f"Retrieved {len(evidences)} evidences from internal DB",
                evidences=evidences,
            )
        except Exception as exc:
            return AgentObservation(
                success=False,
                action="hybrid_search",
                message=f"DB retrieval failed: {exc}",
                evidences=[],
            )

    @staticmethod
    def _compose_retrieval_query(query: str, context: dict) -> str:
        normalized_query = DBRetrievalAgent._normalize_for_matching(query)
        generic_build_intent = DBRetrievalAgent._is_generic_build_intent(normalized_query)

        brand_value = context.get("brand") if isinstance(context, dict) else None
        budget_value = context.get("budget") if isinstance(context, dict) else None
        purpose_value = context.get("purpose") if isinstance(context, dict) else None

        extras = []

        if generic_build_intent:
            # Keep generic build search focused on core components.
            if isinstance(brand_value, str) and brand_value.strip():
                extras.append(brand_value.strip())
            if isinstance(budget_value, str) and budget_value.strip():
                extras.append(budget_value.strip())
            for key in ("socket", "ramDdr", "ramBus"):
                value = context.get(key)
                if isinstance(value, str) and value.strip():
                    extras.append(value.strip())
            extras.extend([
                "CPU",
                "MAINBOARD",
                "RAM",
                "SSD",
                "PSU",
                "GPU",
                "gia tot",
            ])
            
            # Inject budget-aware hints - use query as fallback for budget extraction
            budget_val = DBRetrievalAgent._extract_budget_max(context)
            if not budget_val and query:
                budget_val = DBRetrievalAgent._extract_budget_max({"budget": query})

            if budget_val:
                if budget_val < 12_000_000:
                    extras.extend(["gia re", "tiet kiem", "p/p"])
                elif budget_val < 25_000_000:
                    extras.extend(["p/p", "hieu nang cao", "do hoa", "gaming"])
                elif budget_val > 50_000_000:
                    extras.extend(["cao cap", "high end", "gaming performance"])

        else:
            # Improve lexical hit-rate by appending user constraints when available.
            for key in ("brand", "purpose", "budget", "socket", "ramDdr", "ramBus"):
                value = context.get(key)
                if isinstance(value, str) and value.strip():
                    extras.append(value.strip())

        retrieval_query = query if not extras else f"{query} | {' | '.join(extras)}"
        return retrieval_query

    @staticmethod
    def _normalize_for_matching(value: str) -> str:
        normalized = unicodedata.normalize("NFD", value.lower())
        without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
        return re.sub(r"\s+", " ", without_accents).strip()

    @staticmethod
    def _is_generic_build_intent(normalized_query: str) -> bool:
        build_intent = bool(re.search(r"\b(build|biu|bui|cau hinh|tu van|goi y|rap|lap)\b", normalized_query))
        if not build_intent:
            return False

        explicit_component = bool(
            re.search(r"\b(cpu|gpu|vga|card|mainboard|motherboard|ram|ssd|hdd|psu|nguon|case|thung may|cooler|tan nhiet)\b", normalized_query)
        )
        return not explicit_component

    @staticmethod
    def _extract_budget_max(context: dict) -> float | None:
        if not isinstance(context, dict):
            return None

        for key in ("budgetMax", "budget_max", "budgetExact", "budget_exact"):
            numeric = DBRetrievalAgent._to_number(context.get(key))
            if numeric is not None and numeric > 0:
                return numeric

        budget_text = context.get("budget")
        if not isinstance(budget_text, str) or not budget_text.strip():
            return None

        normalized = DBRetrievalAgent._normalize_for_matching(budget_text)

        # 1. Match ranges like "10-15 triệu"
        range_match = re.search(r"(\d+)\s*(-|den|toi|~)\s*(\d+)\s*(trieu|tr|m)\b", normalized)
        if range_match:
            return float(range_match.group(3)) * 1_000_000

        # 2. Match single numbers like "16 triệu", "16tr", "16.5tr"
        single_num_match = re.search(r"(\d+([.,]\d+)?)\s*(trieu|tr|m)\b", normalized)
        if not single_num_match:
            # Try matching without space: "16tr"
            single_num_match = re.search(r"(\d+([.,]\d+)?)(trieu|tr|m)\b", normalized)

        if single_num_match:
            val = float(single_num_match.group(1).replace(",", "."))
            return val * 1_000_000

        return None

    @staticmethod
    def _extract_selected_brand(context: dict) -> str | None:
        if not isinstance(context, dict):
            return None

        value = context.get("brand")
        if not isinstance(value, str) or not value.strip():
            return None

        normalized = DBRetrievalAgent._normalize_for_matching(value)
        if "intel" in normalized:
            return "INTEL"
        if "nvidia" in normalized or "geforce" in normalized or "rtx" in normalized or "gtx" in normalized:
            return "NVIDIA"
        if "amd" in normalized or "ryzen" in normalized or "radeon" in normalized:
            return "AMD"
        return None

    @staticmethod
    def _extract_preferred_slots(query: str) -> list[str] | None:
        if not isinstance(query, str) or not query.strip():
            return None

        normalized = DBRetrievalAgent._normalize_for_matching(query)
        slots: list[str] = []

        if re.search(r"\b(cpu|bo vi xu ly|vi xu ly|processor)\b", normalized):
            slots.append("CPU")
        if re.search(r"\b(mainboard|motherboard|bo mach chu|bo mach chinh)\b", normalized):
            slots.append("MAINBOARD")
        if re.search(r"\b(gpu|vga|card man hinh|graphics card)\b", normalized):
            slots.append("GPU")
        if re.search(r"\b(ram|bo nho)\b", normalized):
            slots.append("RAM")
        if re.search(r"\b(ssd|o cung)\b", normalized):
            slots.append("SSD")
        if re.search(r"\b(psu|nguon)\b", normalized):
            slots.append("PSU")
        if re.search(r"\b(case|vo may|thung may)\b", normalized):
            slots.append("CASE")
        if re.search(r"\b(cooler|tan nhiet|quat)\b", normalized):
            slots.append("COOLER")

        return slots or None

    @staticmethod
    def _to_number(value: object) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if not isinstance(value, str):
            return None

        cleaned = re.sub(r"[^\d.,]", "", value)
        if not cleaned:
            return None

        if "." in cleaned and "," in cleaned:
            normalized = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned and cleaned.count(",") > 1:
            normalized = cleaned.replace(",", "")
        elif "." in cleaned and cleaned.count(".") > 1:
            normalized = cleaned.replace(".", "")
        elif "," in cleaned and len(cleaned.split(",")[1]) == 3:
             normalized = cleaned.replace(",", "")
        else:
            normalized = cleaned.replace(",", ".")

        try:
            num = float(normalized)
            return num if num >= 0 else None
        except ValueError:
            return None
