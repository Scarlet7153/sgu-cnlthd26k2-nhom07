import html
import logging
import re
import time
from typing import Any, Dict, List, Optional

from app.agents.contracts import AgentTask, RetrievedEvidence
from app.agents.db_retrieval_agent import DBRetrievalAgent
from app.agents.web_retrieval_agent import WebRetrievalAgent
from app.schemas.chat import AgentActionTrace, ChatResponse, ChatTrace, Citation, ProductSuggestion
from app.services.llm_gateway import LLMGateway
from app.services.smolagent_adapter import SmolAgentAdapter

logger = logging.getLogger(__name__)


CATEGORY_SLOT_BY_ID = {
    # Source of truth: docs/categoryIdDictionary.txt
    "69ac61dba931fab39af1232e": "CPU",
    "69ac61dba931fab39af1232f": "GPU",
    "69ac61dba931fab39af12331": "MAINBOARD",
    "69ac61dba931fab39af12330": "RAM",
    "69ac61dba931fab39af12332": "PSU",
    "69ac61dba931fab39af12334": "SSD",
    "69ac61dba931fab39af12333": "CASE",
    "69ac61dba931fab39af12335": "COOLER",
}


class OrchestratorAgent:
    """
    ReAct-oriented orchestration (Thought -> Action -> Observation) with:
    - Internal DB-first retrieval
    - Web fallback when evidence is insufficient
    - Final synthesis through LiteLLM gateway
    """

    def __init__(
        self,
        llm_gateway: LLMGateway,
        smolagent_adapter: SmolAgentAdapter,
        db_agent: DBRetrievalAgent,
        web_agent: WebRetrievalAgent,
        min_db_evidence_count: int,
        default_max_iterations: int,
        default_timeout_seconds: int,
    ) -> None:
        self.llm_gateway = llm_gateway
        self.smolagent_adapter = smolagent_adapter
        self.db_agent = db_agent
        self.web_agent = web_agent
        self.min_db_evidence_count = min_db_evidence_count
        self.default_max_iterations = default_max_iterations
        self.default_timeout_seconds = default_timeout_seconds

    def handle(
        self,
        query: str,
        context: Dict[str, object],
        max_iterations: int | None,
        enable_web_fallback: bool,
    ) -> ChatResponse:
        iterations = 0
        traces: List[AgentActionTrace] = []
        evidences: List[RetrievedEvidence] = []

        max_iters = max_iterations or self.default_max_iterations
        started_at = time.monotonic()

        plan_note = self.smolagent_adapter.summarize_plan(query=query, context=context)
        if plan_note:
            traces.append(
                AgentActionTrace(
                    agent="orchestrator",
                    action="smolagents_planning",
                    status="success",
                    observation=plan_note,
                )
            )

        while iterations < max_iters:
            if (time.monotonic() - started_at) >= self.default_timeout_seconds:
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="timeout",
                        status="skipped",
                        observation="Reached ReAct timeout window",
                    )
                )
                break

            iterations += 1

            # Thought: start with DB retrieval first.
            db_obs = self.db_agent.run(AgentTask(query=query, context=context, max_results=5))
            traces.append(
                AgentActionTrace(
                    agent=self.db_agent.name,
                    action=db_obs.action,
                    status="success" if db_obs.success else "error",
                    observation=db_obs.message,
                )
            )
            if db_obs.success:
                evidences.extend(db_obs.evidences)

            # Observation/Decision: stop if enough DB evidence.
            if len(db_obs.evidences) >= self.min_db_evidence_count:
                break

            # Action: fallback web search when internal data is not enough.
            if not enable_web_fallback:
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="web_fallback",
                        status="skipped",
                        observation="Web fallback disabled",
                    )
                )
                break

            web_obs = self.web_agent.run(AgentTask(query=query, context=context, max_results=5))
            traces.append(
                AgentActionTrace(
                    agent=self.web_agent.name,
                    action=web_obs.action,
                    status="success" if web_obs.success else "error",
                    observation=web_obs.message,
                )
            )
            if web_obs.success:
                evidences.extend(web_obs.evidences)

            break

        selected_products = self._load_selected_products(context)
        compatibility = self._infer_socket_constraints(selected_products)
        answer = self._sanitize_text(
            self._synthesize_answer(
                query=query,
                context=context,
                evidences=evidences,
                compatibility_notes=compatibility.get("notes", []),
            )
        )
        products = self._build_product_suggestions(evidences, compatibility)
        citations = [
            Citation(
                source="db" if ev.source == "db" else "web",
                title=self._sanitize_text(ev.title),
                url=ev.url or None,
                score=ev.score,
                snippet=self._sanitize_text(self._strip_html(ev.snippet)),
            )
            for ev in evidences[:8]
        ]

        confidence = self._estimate_confidence(evidences)

        logger.info("Handled query with %s iterations, %s evidences", iterations, len(evidences))

        return ChatResponse(
            answer=answer,
            confidence=confidence,
            products=products,
            citations=citations,
            trace=ChatTrace(iterations=iterations, actions=traces),
        )

    def _synthesize_answer(
        self,
        query: str,
        context: Dict[str, object],
        evidences: List[RetrievedEvidence],
        compatibility_notes: Optional[List[str]] = None,
    ) -> str:
        if not evidences:
            return (
                "Toi chua tim thay du bang chung de dua ra cau tra loi chinh xac. "
                "Vui long bo sung them rang buoc (ngan sach, muc dich, thuong hieu)."
            )

        evidence_text = "\n".join([
            (
                f"- [{ev.source}] {self._sanitize_text(ev.title)} | score={ev.score:.3f} | "
                f"snippet={self._sanitize_text(self._strip_html(ev.snippet))}"
            )
            for ev in evidences[:10]
        ])
        system_prompt = (
            "Ban la tro ly tu van linh kien PC. "
            "Chi dua tren cac bang chung da cung cap. "
            "Khong du doan vo can cu. Tra loi tieng Viet ngan gon, de hieu."
        )
        user_prompt = (
            f"Truy van: {query}\n"
            f"Ngu canh: {context}\n"
            f"Bang chung:\n{evidence_text}\n"
            "Hay tong hop cau tra loi cuoi cung va neu 2-3 de xuat uu tien."
        )
        if compatibility_notes:
            notes_block = "\n".join([f"- {note}" for note in compatibility_notes])
            user_prompt += f"\nRang buoc tuong thich:\n{notes_block}"
        return self.llm_gateway.generate(system_prompt=system_prompt, user_prompt=user_prompt)

    @staticmethod
    def _estimate_confidence(evidences: List[RetrievedEvidence]) -> float:
        if not evidences:
            return 0.0
        top_scores = [max(0.0, min(1.0, ev.score)) for ev in evidences[:5]]
        return round(sum(top_scores) / len(top_scores), 3)

    @staticmethod
    def _build_product_suggestions(
        evidences: List[RetrievedEvidence],
        compatibility: Optional[Dict[str, Optional[str]]] = None,
    ) -> List[ProductSuggestion]:
        suggestions: List[ProductSuggestion] = []
        filtered: List[ProductSuggestion] = []
        cpu_socket = (compatibility or {}).get("cpu_socket")
        mainboard_socket = (compatibility or {}).get("mainboard_socket")
        has_constraints = bool(cpu_socket or mainboard_socket)
        for ev in evidences:
            if ev.source != "db":
                continue

            raw = ev.raw or {}
            product_id = str(raw.get("_id", ""))
            if not product_id:
                continue

            category_id = OrchestratorAgent._normalize_category_id(raw.get("categoryId"))
            name = OrchestratorAgent._sanitize_text(raw.get("name", ev.title))
            suggestion_slot = OrchestratorAgent._infer_slot(
                category_id=category_id,
                category_code=raw.get("categoryCode"),
                name=name,
            )

            suggestion = ProductSuggestion(
                productId=product_id,
                categoryId=category_id,
                slot=suggestion_slot,
                name=name,
                price=raw.get("price"),
                image=raw.get("image"),
                url=raw.get("url") or ev.url,
                reason=OrchestratorAgent._sanitize_text(OrchestratorAgent._strip_html(ev.snippet)),
            )
            suggestions.append(suggestion)

            if OrchestratorAgent._is_socket_compatible(
                slot=suggestion_slot,
                raw=raw,
                cpu_socket=cpu_socket,
                mainboard_socket=mainboard_socket,
            ):
                filtered.append(suggestion)

        if has_constraints and filtered:
            return filtered[:8]

        return suggestions[:8]

    @staticmethod
    def _normalize_category_id(value: object) -> Optional[str]:
        if value is None:
            return None
        return str(value)

    @staticmethod
    def _infer_slot(category_id: Optional[str], category_code: object, name: str) -> Optional[str]:
        if isinstance(category_code, str) and category_code.strip():
            return category_code.strip().upper()

        if category_id and category_id in CATEGORY_SLOT_BY_ID:
            return CATEGORY_SLOT_BY_ID[category_id]

        upper_name = name.upper()
        heuristics = {
            "CPU": "CPU",
            "MAINBOARD": "MAINBOARD",
            "MOTHERBOARD": "MAINBOARD",
            "RAM": "RAM",
            "VGA": "GPU",
            "GPU": "GPU",
            "PSU": "PSU",
            "SSD": "SSD",
            "HDD": "SSD",
            "CASE": "CASE",
            "COOLER": "COOLER",
        }
        for key, slot in heuristics.items():
            if key in upper_name:
                return slot
        return None

    def _load_selected_products(self, context: Dict[str, object]) -> List[Dict[str, Any]]:
        selected = context.get("selectedComponents")
        if not isinstance(selected, list):
            return []

        id_to_slot: Dict[str, str] = {}
        for item in selected:
            if not isinstance(item, dict):
                continue
            product_id = item.get("productId")
            slot = item.get("slot")
            if not product_id or not slot:
                continue
            id_to_slot[str(product_id)] = str(slot)

        if not id_to_slot:
            return []

        docs = self.db_agent.mongo_service.get_products_by_ids(list(id_to_slot.keys()))
        for doc in docs:
            doc_id = str(doc.get("_id", ""))
            if doc_id in id_to_slot:
                doc["_selected_slot"] = id_to_slot[doc_id]
        return docs

    def _infer_socket_constraints(self, selected_products: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
        cpu_socket = None
        mainboard_socket = None
        notes: List[str] = []

        for doc in selected_products:
            slot = str(doc.get("_selected_slot", "")).upper()
            socket_value = self._extract_socket_from_raw(doc)
            if slot == "CPU" and socket_value:
                cpu_socket = socket_value
            if slot == "MAINBOARD" and socket_value:
                mainboard_socket = socket_value

        if cpu_socket:
            notes.append(f"Chi goi y MAINBOARD tuong thich socket CPU {cpu_socket}.")
        if mainboard_socket:
            notes.append(f"Chi goi y CPU tuong thich socket MAINBOARD {mainboard_socket}.")

        return {
            "cpu_socket": cpu_socket,
            "mainboard_socket": mainboard_socket,
            "notes": notes,
        }

    @staticmethod
    def _is_socket_compatible(
        slot: Optional[str],
        raw: Dict[str, Any],
        cpu_socket: Optional[str],
        mainboard_socket: Optional[str],
    ) -> bool:
        if not slot:
            return True

        normalized_slot = slot.upper()
        candidate_socket = OrchestratorAgent._extract_socket_from_raw(raw)

        if normalized_slot == "MAINBOARD" and cpu_socket:
            if candidate_socket and candidate_socket != cpu_socket:
                return False

        if normalized_slot == "CPU" and mainboard_socket:
            if candidate_socket and candidate_socket != mainboard_socket:
                return False

        return True

    @staticmethod
    def _extract_socket_from_raw(raw: Dict[str, Any]) -> Optional[str]:
        candidates: List[str] = []
        socket_value = raw.get("socket")
        if isinstance(socket_value, str) and socket_value.strip():
            candidates.append(socket_value)

        specs = raw.get("specs_raw") or raw.get("specsRaw")
        if isinstance(specs, dict):
            for key in ("Socket", "socket", "SOCKET"):
                value = specs.get(key)
                if isinstance(value, str) and value.strip():
                    candidates.append(value)

        for value in candidates:
            normalized = OrchestratorAgent._normalize_socket_value(value)
            if normalized:
                return normalized
        return None

    @staticmethod
    def _normalize_socket_value(value: object) -> Optional[str]:
        if not isinstance(value, str):
            return None

        text = value.upper()
        am_match = re.search(r"AM\d+", text)
        if am_match:
            return am_match.group(0)

        num_match = re.search(r"\d{3,4}", text)
        if num_match:
            return num_match.group(0)

        return None

    @staticmethod
    def _strip_html(value: object) -> str:
        if not isinstance(value, str):
            return ""
        return re.sub(r"<[^>]+>", " ", value)

    @staticmethod
    def _sanitize_text(value: object) -> str:
        if not isinstance(value, str):
            return ""

        text = html.unescape(value)
        marker_score = sum(text.count(marker) for marker in ("Ã", "Â", "Ä", "Æ", "á»"))
        if marker_score > 0:
            try:
                repaired = text.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
                repaired_score = sum(repaired.count(marker) for marker in ("Ã", "Â", "Ä", "Æ", "á»"))
                if repaired and repaired_score < marker_score:
                    text = repaired
            except Exception:
                pass

        return " ".join(text.split())
