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
            vector = self.embedding_service.embed(retrieval_query)
            evidences = self.mongo_service.hybrid_search(
                retrieval_query,
                vector,
                limit=task.max_results,
                max_price=budget_max,
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
                "gia tot",
            ])
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
        build_intent = bool(re.search(r"\b(build|cau hinh|tu van|goi y)\b", normalized_query))
        if not build_intent:
            return False

        explicit_component = bool(
            re.search(r"\b(cpu|gpu|vga|mainboard|motherboard|ram|ssd|hdd|psu|case|thung may|cooler)\b", normalized_query)
        )
        return not explicit_component

    @staticmethod
    def _extract_budget_max(context: dict) -> float | None:
        if not isinstance(context, dict):
            return None

        for key in ("budgetMax", "budget_max"):
            numeric = DBRetrievalAgent._to_number(context.get(key))
            if numeric is not None and numeric > 0:
                return numeric

        budget_text = context.get("budget")
        if not isinstance(budget_text, str) or not budget_text.strip():
            return None

        normalized = DBRetrievalAgent._normalize_for_matching(budget_text)
        if re.search(r"(duoi|<|under)\s*10", normalized) or re.search(r"10\s*trieu\s*do\s*lai", normalized):
            return 10_000_000
        if re.search(r"10\s*(-|den|toi|~)\s*15", normalized):
            return 15_000_000
        if re.search(r"15\s*(-|den|toi|~)\s*20", normalized):
            return 20_000_000
        if re.search(r"20\s*(-|den|toi|~)\s*30", normalized):
            return 30_000_000

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
