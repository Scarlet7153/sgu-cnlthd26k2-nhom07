import html
import logging
import re
import time
import unicodedata
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

CORE_BUILD_SLOTS = {"CPU", "MAINBOARD", "RAM", "SSD", "PSU"}
ACCESSORY_SLOTS = {"CASE", "COOLER"}
DEFAULT_SLOT_PRIORITY = {
    "CPU": 0,
    "MAINBOARD": 1,
    "RAM": 2,
    "SSD": 3,
    "GPU": 4,
    "PSU": 5,
    "CASE": 6,
    "COOLER": 7,
}
LOW_BUDGET_SLOT_PRIORITY = {
    "CPU": 0,
    "MAINBOARD": 1,
    "RAM": 2,
    "SSD": 3,
    "PSU": 4,
    "GPU": 5,
    "CASE": 6,
    "COOLER": 7,
}
LOW_BUDGET_SLOT_CAP_RATIO = {
    "CPU": 0.38,
    "MAINBOARD": 0.22,
    "RAM": 0.16,
    "SSD": 0.15,
    "PSU": 0.12,
    "CASE": 0.10,
    "COOLER": 0.08,
    "GPU": 0.40,
}
LOW_BUDGET_RELAXED_SLOT_CAP_RATIO = {
    "CPU": 0.50,
    "MAINBOARD": 0.32,
    "RAM": 0.22,
    "SSD": 0.22,
    "PSU": 0.18,
    "CASE": 0.15,
    "COOLER": 0.12,
    "GPU": 0.55,
}
MAX_PRODUCT_SUGGESTIONS = 12
MAX_PRODUCTS_PER_SLOT = 2
MAX_REPLACEMENT_SUGGESTIONS = 4
REPLACEMENT_SLOT_KEYWORDS = {
    "CPU": ["cpu", "vi xu ly", "chip"],
    "MAINBOARD": ["mainboard", "motherboard", "bo mach chu", "bo mach chinh"],
    "RAM": ["ram", "bo nho"],
    "SSD": ["ssd", "o cung", "hard disk", "hdd"],
    "PSU": ["psu", "nguon"],
    "GPU": ["gpu", "vga", "card man hinh"],
    "CASE": ["case", "thung may", "vo may"],
    "COOLER": ["cooler", "tan nhiet"],
}
OFFICE_PURPOSE_KEYWORDS = (
    "van phong",
    "office",
    "hoc tap",
    "word",
    "excel",
)
GPU_REQUEST_KEYWORDS = (
    "gpu",
    "vga",
    "card man hinh",
    "do hoa",
    "render",
    "blender",
    "premiere",
    "after effects",
    "gaming",
    "choi game",
)


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
        db_max_results = 36
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
            db_obs = self.db_agent.run(AgentTask(query=query, context=context, max_results=db_max_results))
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
        budget_constraints = self._extract_budget_constraints(context)
        office_gpu_note = self._build_office_gpu_note(context, budget_constraints)
        if office_gpu_note:
            notes = compatibility.get("notes")
            if isinstance(notes, list):
                notes.append(office_gpu_note)
        response_evidences = list(evidences)
        replacement_slot = self._extract_replacement_slot(query)
        replacement_preference = self._extract_replacement_preference(query)
        products: List[ProductSuggestion] = []

        if replacement_slot:
            replacement_products = self._build_replacement_slot_products(
                slot=replacement_slot,
                context=context,
                compatibility=compatibility,
                preference=replacement_preference,
            )
            if replacement_products:
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="slot_replacement_search",
                        status="success",
                        observation=f"Suggested {len(replacement_products)} alternatives for slot {replacement_slot}",
                    )
                )
                products = replacement_products
                response_evidences = self._evidences_from_products(replacement_products)
            else:
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="slot_replacement_search",
                        status="skipped",
                        observation=f"Could not find compatible alternatives for slot {replacement_slot}",
                    )
                )
                response_evidences = []

        if not replacement_slot and not products:
            products = self._build_product_suggestions(evidences, compatibility, context, query)
        if not replacement_slot and not products:
            fallback_evidences = self._retrieve_budget_fallback_evidences(context)
            if fallback_evidences:
                traces.append(
                    AgentActionTrace(
                        agent=self.db_agent.name,
                        action="budget_fallback_search",
                        status="success",
                        observation=f"Retrieved {len(fallback_evidences)} fallback evidences for budget fit",
                    )
                )
                response_evidences = fallback_evidences
                products = self._build_product_suggestions(fallback_evidences, compatibility, context, query)
        if not replacement_slot and not products:
            shortlist_products = self._build_budget_shortlist_products(context, query)
            if shortlist_products:
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="budget_shortlist",
                        status="success",
                        observation=f"Generated {len(shortlist_products)} products from budget shortlist",
                    )
                )
                products = shortlist_products
                response_evidences = self._evidences_from_products(shortlist_products)

        if not replacement_slot:
            office_gpu_products = self._build_office_gpu_adjustment_products(context, compatibility)
            if office_gpu_products:
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="office_gpu_adjustment",
                        status="success",
                        observation=f"Suggested {len(office_gpu_products)} lower-cost GPU alternatives for office usage",
                    )
                )
                merged: List[ProductSuggestion] = []
                seen_ids = set()
                for item in office_gpu_products + products:
                    pid = item.product_id
                    if pid in seen_ids:
                        continue
                    seen_ids.add(pid)
                    merged.append(item)
                products = merged[:MAX_PRODUCT_SUGGESTIONS]
                response_evidences = self._evidences_from_products(products)

        office_budget_note = self._build_office_gpu_budget_note(query, context, budget_constraints, products)
        if office_budget_note:
            notes = compatibility.get("notes")
            if isinstance(notes, list):
                notes.append(office_budget_note)

        if replacement_slot and not products:
            answer = self._sanitize_text(
                f"Toi chua tim duoc {replacement_slot} thay the phu hop trong ngan sach hien tai. "
                "Ban co the mo rong ngan sach hoac noii rong yeu cau de toi goi y them."
            )
        else:
            answer = self._sanitize_text(
                self._synthesize_answer(
                    query=query,
                    context=context,
                    evidences=response_evidences,
                    compatibility_notes=compatibility.get("notes", []),
                )
            )
        citations = [
            Citation(
                source="db" if ev.source == "db" else "web",
                title=self._sanitize_text(ev.title),
                url=ev.url or None,
                score=ev.score,
                snippet=self._sanitize_text(self._strip_html(ev.snippet)),
            )
            for ev in response_evidences[:MAX_PRODUCT_SUGGESTIONS]
        ]

        confidence = self._estimate_confidence(response_evidences)

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
        context: Optional[Dict[str, object]] = None,
        query: Optional[str] = None,
    ) -> List[ProductSuggestion]:
        suggestions: List[ProductSuggestion] = []
        filtered: List[ProductSuggestion] = []
        cpu_igpu_by_product: Dict[str, bool] = {}
        selected_slots = OrchestratorAgent._extract_selected_slots(context)
        has_core_selected = any(slot in CORE_BUILD_SLOTS for slot in selected_slots)
        low_budget_mode = OrchestratorAgent._is_low_budget_context(context)
        office_mode = OrchestratorAgent._is_office_context(context)
        explicit_gpu_request = OrchestratorAgent._has_explicit_gpu_request(query)
        selected_brand = OrchestratorAgent._extract_selected_brand(context)
        budget_constraints = OrchestratorAgent._extract_budget_constraints(context)
        # Keep slot diversity first, then append additional options for the same remaining slots.
        allow_duplicate_fill = True
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

            if not OrchestratorAgent._matches_brand_constraint(
                selected_brand=selected_brand,
                slot=suggestion_slot,
                raw=raw,
                name=name,
            ):
                continue

            numeric_price = OrchestratorAgent._to_number(raw.get("price"))

            suggestion = ProductSuggestion(
                productId=product_id,
                categoryId=category_id,
                slot=suggestion_slot,
                name=name,
                price=int(numeric_price) if numeric_price is not None else raw.get("price"),
                image=raw.get("image"),
                url=raw.get("url") or ev.url,
                reason=OrchestratorAgent._sanitize_text(OrchestratorAgent._strip_html(ev.snippet)),
            )
            suggestions.append(suggestion)
            if (suggestion_slot or "").upper() == "CPU":
                cpu_igpu_by_product[suggestion.product_id] = OrchestratorAgent._has_integrated_graphics(raw, name)

            if OrchestratorAgent._is_socket_compatible(
                slot=suggestion_slot,
                raw=raw,
                cpu_socket=cpu_socket,
                mainboard_socket=mainboard_socket,
            ):
                filtered.append(suggestion)

        candidates = filtered if has_constraints and filtered else suggestions
        if selected_slots:
            missing_slot_candidates = [
                item for item in candidates if (item.slot or "").upper() not in selected_slots
            ]
            if missing_slot_candidates:
                candidates = missing_slot_candidates

        if office_mode and not explicit_gpu_request:
            candidates = [item for item in candidates if (item.slot or "").upper() != "GPU"]

        strict_budgeted = [
            item
            for item in candidates
            if OrchestratorAgent._is_within_budget_constraints(
                price=OrchestratorAgent._to_number(item.price),
                slot=item.slot,
                constraints=budget_constraints,
                enforce_slot_caps=True,
            )
        ]

        if strict_budgeted:
            ranked = OrchestratorAgent._rank_suggestions(
                strict_budgeted,
                low_budget_mode=low_budget_mode,
                has_core_selected=has_core_selected,
                allow_duplicate_fill=allow_duplicate_fill,
                office_mode=office_mode,
                cpu_igpu_by_product=cpu_igpu_by_product,
            )
            return OrchestratorAgent._limit_products_per_slot(ranked, MAX_PRODUCTS_PER_SLOT)[:MAX_PRODUCT_SUGGESTIONS]

        relaxed_budgeted = [
            item
            for item in candidates
            if OrchestratorAgent._is_within_budget_constraints(
                price=OrchestratorAgent._to_number(item.price),
                slot=item.slot,
                constraints=budget_constraints,
                enforce_slot_caps=False,
            )
        ]

        ranked = OrchestratorAgent._rank_suggestions(
            relaxed_budgeted,
            low_budget_mode=low_budget_mode,
            has_core_selected=has_core_selected,
            allow_duplicate_fill=allow_duplicate_fill,
            office_mode=office_mode,
            cpu_igpu_by_product=cpu_igpu_by_product,
        )
        return OrchestratorAgent._limit_products_per_slot(ranked, MAX_PRODUCTS_PER_SLOT)[:MAX_PRODUCT_SUGGESTIONS]

    def _retrieve_budget_fallback_evidences(self, context: Dict[str, object]) -> List[RetrievedEvidence]:
        budget_max = self._extract_budget_max(context)
        if budget_max is None:
            return []

        budget_text = context.get("budget") if isinstance(context.get("budget"), str) else ""
        brand_text = context.get("brand") if isinstance(context.get("brand"), str) else ""

        fallback_query = "goi y linh kien CPU MAINBOARD RAM SSD PSU gia tot"
        if budget_text:
            fallback_query = f"{fallback_query} | {budget_text}"
        if brand_text:
            fallback_query = f"{fallback_query} | {brand_text}"

        fallback_context = dict(context)
        # Avoid purpose bias (for example Office -> CASE-heavy retrieval) in fallback pass.
        fallback_context.pop("purpose", None)

        observation = self.db_agent.run(
            AgentTask(
                query=fallback_query,
                context=fallback_context,
                max_results=24,
            )
        )
        if not observation.success:
            return []
        return observation.evidences

    def _build_budget_shortlist_products(self, context: Dict[str, object], query: Optional[str] = None) -> List[ProductSuggestion]:
        constraints = self._extract_budget_constraints(context)
        budget_max = constraints.get("budget_max")
        if budget_max is None:
            return []

        remaining_budget = constraints.get("remaining_budget")
        effective_budget = remaining_budget if isinstance(remaining_budget, (int, float)) else budget_max
        if effective_budget is None or effective_budget <= 0:
            return []

        low_budget = bool(constraints.get("low_budget"))
        office_mode = self._is_office_context(context)
        explicit_gpu_request = self._has_explicit_gpu_request(query)
        selected_brand = self._extract_selected_brand(context)
        selected_slots = self._extract_selected_slots(context)
        base_slot_order = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "GPU", "CASE", "COOLER"]
        if office_mode and not explicit_gpu_request:
            base_slot_order = [slot for slot in base_slot_order if slot != "GPU"]
        slot_order = [slot for slot in base_slot_order if slot not in selected_slots]
        if not slot_order:
            slot_order = base_slot_order
        max_per_item_ratio = 0.5 if low_budget else 0.7

        docs = self.db_agent.mongo_service.get_budget_products_by_slots(
            slot_order=slot_order,
            budget_max=float(effective_budget),
            total_limit=max(MAX_PRODUCT_SUGGESTIONS, len(slot_order) * MAX_PRODUCTS_PER_SLOT),
            per_slot_limit=MAX_PRODUCTS_PER_SLOT,
            max_per_item_ratio=max_per_item_ratio,
            selected_brand=selected_brand,
        )

        shortlist: List[ProductSuggestion] = []
        cpu_igpu_by_product: Dict[str, bool] = {}
        for doc in docs:
            category_id = OrchestratorAgent._normalize_category_id(doc.get("categoryId"))
            name = OrchestratorAgent._sanitize_text(doc.get("name", ""))
            slot = OrchestratorAgent._infer_slot(
                category_id=category_id,
                category_code=doc.get("categoryCode"),
                name=name,
            )

            if not OrchestratorAgent._matches_brand_constraint(
                selected_brand=selected_brand,
                slot=slot,
                raw=doc,
                name=name,
            ):
                continue

            numeric_price = OrchestratorAgent._to_number(doc.get("price"))
            if numeric_price is None or numeric_price <= 0:
                continue

            product_id = str(doc.get("_id", ""))
            if not product_id:
                continue

            shortlist.append(
                ProductSuggestion(
                    productId=product_id,
                    categoryId=category_id,
                    slot=slot,
                    name=name,
                    price=int(numeric_price),
                    image=doc.get("image"),
                    url=doc.get("url"),
                    reason="Phu hop ngan sach da chon",
                )
            )
            if (slot or "").upper() == "CPU":
                cpu_igpu_by_product[product_id] = OrchestratorAgent._has_integrated_graphics(doc, name)

        if office_mode and not explicit_gpu_request:
            shortlist = [item for item in shortlist if (item.slot or "").upper() != "GPU"]

        ranked = OrchestratorAgent._rank_suggestions(
            shortlist,
            low_budget_mode=low_budget,
            has_core_selected=any(slot in CORE_BUILD_SLOTS for slot in selected_slots),
            allow_duplicate_fill=True,
            office_mode=office_mode,
            cpu_igpu_by_product=cpu_igpu_by_product,
        )

        return OrchestratorAgent._limit_products_per_slot(ranked, MAX_PRODUCTS_PER_SLOT)[:MAX_PRODUCT_SUGGESTIONS]

    @staticmethod
    def _limit_products_per_slot(products: List[ProductSuggestion], max_per_slot: int) -> List[ProductSuggestion]:
        if max_per_slot <= 0:
            return products

        slot_counts: Dict[str, int] = {}
        limited: List[ProductSuggestion] = []
        for item in products:
            slot_key = (item.slot or "OTHER").upper()
            current_count = slot_counts.get(slot_key, 0)
            if current_count >= max_per_slot:
                continue
            slot_counts[slot_key] = current_count + 1
            limited.append(item)
        return limited

    def _build_replacement_slot_products(
        self,
        slot: str,
        context: Dict[str, object],
        compatibility: Dict[str, Optional[str]],
        preference: Optional[Dict[str, str]] = None,
    ) -> List[ProductSuggestion]:
        constraints = self._extract_budget_constraints(context)
        budget_max = constraints.get("budget_max")
        if budget_max is None:
            return []

        remaining_budget = constraints.get("remaining_budget")
        effective_budget = remaining_budget if isinstance(remaining_budget, (int, float)) else budget_max
        price_pref = (preference or {}).get("price")
        office_gpu_downgrade = slot.upper() == "GPU" and price_pref == "much_lower"
        if office_gpu_downgrade and (effective_budget is None or effective_budget <= 0):
            effective_budget = budget_max
        if effective_budget is None or effective_budget <= 0:
            return []

        selected_components = context.get("selectedComponents")
        selected_slot_price = None
        selected_slot_capacity_gb = None
        exclude_ids: List[str] = []
        if isinstance(selected_components, list):
            for item in selected_components:
                if not isinstance(item, dict):
                    continue
                current_slot = str(item.get("slot", "")).upper()
                if current_slot != slot:
                    continue
                price = OrchestratorAgent._to_number(item.get("price"))
                if price is not None and price > 0:
                    selected_slot_price = price
                if slot.upper() == "SSD":
                    selected_name = str(item.get("name", ""))
                    selected_slot_capacity_gb = OrchestratorAgent._extract_storage_capacity_gb_from_text(selected_name)
                current_product_id = item.get("productId")
                if current_product_id:
                    exclude_ids.append(str(current_product_id))

        target_price_for_query = selected_slot_price
        query_budget_max = float(effective_budget)
        if office_gpu_downgrade:
            target_price_for_query = None
            if selected_slot_price is not None:
                query_budget_max = min(query_budget_max, max(1.0, selected_slot_price * 0.6))
            if isinstance(budget_max, (int, float)) and budget_max > 0:
                query_budget_max = min(query_budget_max, max(1.0, float(budget_max) * 0.45))

        selected_brand = OrchestratorAgent._extract_selected_brand(context)

        docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot=slot,
            budget_max=query_budget_max,
            target_price=target_price_for_query,
            limit=max(MAX_REPLACEMENT_SUGGESTIONS * 8, 24),
            exclude_product_ids=exclude_ids,
            selected_brand=selected_brand,
        )

        cpu_socket = compatibility.get("cpu_socket")
        mainboard_socket = compatibility.get("mainboard_socket")
        constraints_for_filter = dict(constraints)
        if office_gpu_downgrade:
            current_remaining = constraints_for_filter.get("remaining_budget")
            if (not isinstance(current_remaining, (int, float)) or current_remaining <= 0) and isinstance(budget_max, (int, float)):
                constraints_for_filter["remaining_budget"] = float(budget_max)

        def _to_products(candidates: List[Dict[str, Any]], reason_text: str) -> List[ProductSuggestion]:
            converted: List[ProductSuggestion] = []
            ssd_capacity_pref = (preference or {}).get("ssd_capacity")
            for doc in candidates:
                category_id = OrchestratorAgent._normalize_category_id(doc.get("categoryId"))
                name = OrchestratorAgent._sanitize_text(doc.get("name", ""))
                suggestion_slot = OrchestratorAgent._infer_slot(
                    category_id=category_id,
                    category_code=doc.get("categoryCode"),
                    name=name,
                )
                if (suggestion_slot or "").upper() != slot.upper():
                    continue

                if not OrchestratorAgent._matches_brand_constraint(
                    selected_brand=selected_brand,
                    slot=suggestion_slot,
                    raw=doc,
                    name=name,
                ):
                    continue

                if slot.upper() == "SSD" and ssd_capacity_pref and selected_slot_capacity_gb is not None:
                    candidate_capacity_gb = OrchestratorAgent._extract_storage_capacity_gb(doc, name)
                    if ssd_capacity_pref == "higher":
                        if candidate_capacity_gb is None or candidate_capacity_gb <= selected_slot_capacity_gb:
                            continue
                    if ssd_capacity_pref == "lower":
                        if candidate_capacity_gb is None or candidate_capacity_gb >= selected_slot_capacity_gb:
                            continue

                if not OrchestratorAgent._is_socket_compatible(
                    slot=suggestion_slot,
                    raw=doc,
                    cpu_socket=cpu_socket,
                    mainboard_socket=mainboard_socket,
                ):
                    continue

                numeric_price = OrchestratorAgent._to_number(doc.get("price"))
                if office_gpu_downgrade and selected_slot_price is not None:
                    if numeric_price is None or numeric_price >= selected_slot_price * 0.7:
                        continue
                if not OrchestratorAgent._is_within_budget_constraints(
                    price=numeric_price,
                    slot=suggestion_slot,
                    constraints=constraints_for_filter,
                    enforce_slot_caps=False,
                ):
                    continue
                if numeric_price is None or numeric_price <= 0:
                    continue

                converted.append(
                    ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot=suggestion_slot,
                        name=name,
                        price=int(numeric_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        reason=reason_text,
                    )
                )
            return converted

        reason = f"Goi y thay the {slot} cung tam gia"
        if selected_slot_price is None:
            reason = f"Goi y thay the {slot} trong ngan sach hien tai"
        if office_gpu_downgrade:
            reason = "Nhu cau van phong: uu tien giam manh GPU de toi uu tong chi phi"
        if slot.upper() == "SSD" and (preference or {}).get("ssd_capacity") == "higher":
            reason = "Goi y SSD dung luong cao hon trong ngan sach hien tai"
        if slot.upper() == "SSD" and (preference or {}).get("ssd_capacity") == "lower":
            reason = "Goi y SSD dung luong thap hon trong ngan sach hien tai"

        results = _to_products(docs, reason)
        if not results and selected_slot_price is not None:
            broad_docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                slot=slot,
                budget_max=query_budget_max,
                target_price=None,
                limit=max(MAX_REPLACEMENT_SUGGESTIONS * 8, 24),
                exclude_product_ids=exclude_ids,
                selected_brand=selected_brand,
            )
            results = _to_products(broad_docs, f"Goi y thay the {slot} trong ngan sach hien tai")

        return results[:MAX_REPLACEMENT_SUGGESTIONS]

    @staticmethod
    def _extract_replacement_slot(query: str) -> Optional[str]:
        normalized = OrchestratorAgent._normalize_for_matching(query)
        has_replacement_intent = any(
            token in normalized
            for token in ("doi", "thay", "replace", "switch", "khac", "nang cap", "chon lai")
        )
        if not has_replacement_intent:
            return None

        for slot, keywords in REPLACEMENT_SLOT_KEYWORDS.items():
            if any(keyword in normalized for keyword in keywords):
                return slot

        return None

    @staticmethod
    def _extract_replacement_preference(query: str) -> Dict[str, str]:
        normalized = OrchestratorAgent._normalize_for_matching(query)
        preference: Dict[str, str] = {}

        ssd_requested = any(keyword in normalized for keyword in REPLACEMENT_SLOT_KEYWORDS.get("SSD", []))
        if not ssd_requested:
            return preference

        higher_markers = (
            "cao hon",
            "lon hon",
            "nhieu hon",
            "tang dung luong",
            "dung luong cao",
            "capacity higher",
        )
        lower_markers = (
            "thap hon",
            "nho hon",
            "it hon",
            "giam dung luong",
            "dung luong thap",
            "capacity lower",
        )

        if any(marker in normalized for marker in higher_markers):
            preference["ssd_capacity"] = "higher"
        elif any(marker in normalized for marker in lower_markers):
            preference["ssd_capacity"] = "lower"

        return preference

    @staticmethod
    def _extract_storage_capacity_gb(raw: Dict[str, Any], name: str) -> Optional[float]:
        capacities: List[float] = []

        name_capacity = OrchestratorAgent._extract_storage_capacity_gb_from_text(name)
        if name_capacity is not None:
            capacities.append(name_capacity)

        specs = raw.get("specs_raw") or raw.get("specsRaw")
        if isinstance(specs, dict):
            for key in ("Dung luong", "Dung lượng", "Capacity", "capacity"):
                value = specs.get(key)
                if isinstance(value, str):
                    parsed = OrchestratorAgent._extract_storage_capacity_gb_from_text(value)
                    if parsed is not None:
                        capacities.append(parsed)

        if not capacities:
            return None
        return max(capacities)

    @staticmethod
    def _extract_storage_capacity_gb_from_text(value: str) -> Optional[float]:
        if not isinstance(value, str) or not value.strip():
            return None

        matches = re.findall(r"(\d+(?:[\.,]\d+)?)\s*(TB|GB)\b", value.upper())
        if not matches:
            return None

        capacities: List[float] = []
        for number_text, unit in matches:
            normalized_number = number_text.replace(",", ".")
            try:
                numeric_value = float(normalized_number)
            except ValueError:
                continue

            if unit == "TB":
                capacities.append(numeric_value * 1024.0)
            else:
                capacities.append(numeric_value)

        if not capacities:
            return None
        return max(capacities)

    @staticmethod
    def _evidences_from_products(products: List[ProductSuggestion]) -> List[RetrievedEvidence]:
        evidences: List[RetrievedEvidence] = []
        score = 0.6
        for product in products[:MAX_PRODUCT_SUGGESTIONS]:
            evidences.append(
                RetrievedEvidence(
                    source="db",
                    title=product.name,
                    snippet=product.reason or "De xuat tu shortlist ngan sach",
                    score=max(0.1, score),
                    url=product.url or "",
                    raw={
                        "_id": product.product_id,
                        "name": product.name,
                        "price": product.price,
                        "categoryId": product.category_id,
                    },
                )
            )
            score -= 0.05
        return evidences

    @staticmethod
    def _rank_suggestions(
        suggestions: List[ProductSuggestion],
        low_budget_mode: bool,
        has_core_selected: bool,
        allow_duplicate_fill: bool = True,
        office_mode: bool = False,
        cpu_igpu_by_product: Optional[Dict[str, bool]] = None,
    ) -> List[ProductSuggestion]:
        if not suggestions:
            return []

        priority_map = LOW_BUDGET_SLOT_PRIORITY if low_budget_mode else DEFAULT_SLOT_PRIORITY

        indexed = list(enumerate(suggestions))
        sorted_suggestions = [
            item
            for _, item in sorted(
                indexed,
                key=lambda pair: (
                    priority_map.get((pair[1].slot or "").upper(), 99),
                    0
                    if not office_mode
                    else OrchestratorAgent._office_cpu_sort_key(
                        pair[1],
                        cpu_igpu_by_product or {},
                    ),
                    pair[0],
                ),
            )
        ]

        if low_budget_mode and not has_core_selected:
            non_accessory = [
                item for item in sorted_suggestions if (item.slot or "").upper() not in ACCESSORY_SLOTS
            ]
            if non_accessory:
                accessory = [
                    item for item in sorted_suggestions if (item.slot or "").upper() in ACCESSORY_SLOTS
                ]
                sorted_suggestions = non_accessory + accessory

        diversified: List[ProductSuggestion] = []
        used_slots = set()
        for item in sorted_suggestions:
            slot = (item.slot or "").upper()
            if slot and slot in used_slots:
                continue
            diversified.append(item)
            if slot:
                used_slots.add(slot)

        if allow_duplicate_fill:
            for item in sorted_suggestions:
                if item in diversified:
                    continue
                diversified.append(item)

        return diversified

    @staticmethod
    def _extract_selected_slots(context: Optional[Dict[str, object]]) -> set[str]:
        if not isinstance(context, dict):
            return set()

        selected = context.get("selectedComponents")
        if not isinstance(selected, list):
            return set()

        slots = set()
        for item in selected:
            if not isinstance(item, dict):
                continue
            slot = item.get("slot")
            if isinstance(slot, str) and slot.strip():
                slots.add(slot.strip().upper())
        return slots

    @staticmethod
    def _is_office_context(context: Optional[Dict[str, object]]) -> bool:
        if not isinstance(context, dict):
            return False

        purpose = context.get("purpose")
        if not isinstance(purpose, str) or not purpose.strip():
            return False

        normalized = OrchestratorAgent._normalize_for_matching(purpose)
        return any(keyword in normalized for keyword in OFFICE_PURPOSE_KEYWORDS)

    @staticmethod
    def _extract_selected_brand(context: Optional[Dict[str, object]]) -> Optional[str]:
        if not isinstance(context, dict):
            return None
        brand = context.get("brand")
        if not isinstance(brand, str) or not brand.strip():
            return None
        return OrchestratorAgent._normalize_for_matching(brand).upper()

    @staticmethod
    def _matches_brand_constraint(
        selected_brand: Optional[str],
        slot: Optional[str],
        raw: Dict[str, Any],
        name: str,
    ) -> bool:
        if not selected_brand:
            return True

        normalized_slot = (slot or "").upper()
        brand_slot_scope: Dict[str, set[str]] = {
            "INTEL": {"CPU"},
            "AMD": {"CPU", "GPU"},
            "NVIDIA": {"GPU"},
        }
        allowed_slots = brand_slot_scope.get(selected_brand)
        if allowed_slots is not None and normalized_slot not in allowed_slots:
            return True

        candidates: List[str] = []
        raw_brand = raw.get("brand")
        if isinstance(raw_brand, str):
            candidates.append(raw_brand)
        model = raw.get("model")
        if isinstance(model, str):
            candidates.append(model)
        if isinstance(name, str):
            candidates.append(name)

        normalized_candidates = [OrchestratorAgent._normalize_for_matching(item).upper() for item in candidates if item]

        if selected_brand == "NVIDIA":
            return any(
                ("NVIDIA" in text) or ("GEFORCE" in text) or ("RTX" in text) or ("GTX" in text)
                for text in normalized_candidates
            )

        return any(selected_brand in text for text in normalized_candidates)

    @staticmethod
    def _has_explicit_gpu_request(query: Optional[str]) -> bool:
        if not isinstance(query, str) or not query.strip():
            return False
        normalized = OrchestratorAgent._normalize_for_matching(query)
        return any(keyword in normalized for keyword in GPU_REQUEST_KEYWORDS)

    @staticmethod
    def _has_integrated_graphics(raw: Dict[str, Any], name: str) -> bool:
        specs = raw.get("specs_raw") or raw.get("specsRaw")
        if isinstance(specs, dict):
            for key in (
                "integratedGraphics",
                "iGPU",
                "iGpu",
                "Graphics",
                "graphics",
                "Do hoa tich hop",
                "Đồ họa tích hợp",
            ):
                value = specs.get(key)
                if not isinstance(value, str):
                    continue
                normalized = OrchestratorAgent._normalize_for_matching(value)
                if any(token in normalized for token in ("khong", "none", "no", "n/a")):
                    return False
                if any(token in normalized for token in ("uhd", "iris", "radeon", "vega", "igpu", "tich hop")):
                    return True

        normalized_name = name.upper()
        if re.search(r"\b\d{4,5}(KF|F)\b", normalized_name):
            return False
        if re.search(r"\b\d{4,5}G\b", normalized_name) or "APU" in normalized_name:
            return True
        if "INTEL" in normalized_name and re.search(r"\bI[3579]\b", normalized_name):
            return True
        if "RYZEN 7" in normalized_name or "RYZEN 5" in normalized_name or "RYZEN 3" in normalized_name:
            return True

        return False

    @staticmethod
    def _office_cpu_sort_key(item: ProductSuggestion, cpu_igpu_by_product: Dict[str, bool]) -> int:
        slot = (item.slot or "").upper()
        if slot != "CPU":
            return 0
        return 0 if cpu_igpu_by_product.get(item.product_id, False) else 1

    @staticmethod
    def _build_office_gpu_budget_note(
        query: str,
        context: Dict[str, object],
        constraints: Dict[str, Optional[float]],
        products: List[ProductSuggestion],
    ) -> Optional[str]:
        if not OrchestratorAgent._is_office_context(context):
            return None
        if not OrchestratorAgent._has_explicit_gpu_request(query):
            return None

        remaining_budget = constraints.get("remaining_budget")
        if isinstance(remaining_budget, (int, float)) and remaining_budget <= 0:
            return (
                "Ban co yeu cau ve GPU, nhung ngan sach con lai khong du. "
                "Hay giam cac linh kien khac, bo GPU roi, hoac tang ngan sach de them GPU phu hop."
            )

        has_gpu_suggestion = any((item.slot or "").upper() == "GPU" for item in products)
        if isinstance(remaining_budget, (int, float)) and remaining_budget > 0 and not has_gpu_suggestion:
            return (
                "Ban co yeu cau ve GPU, nhung muc ngan sach con lai chua du de de xuat GPU phu hop. "
                "Hay can nhac tang ngan sach hoac giam cau hinh hien tai."
            )

        return None

    @staticmethod
    def _find_selected_slot_price(context: Optional[Dict[str, object]], target_slot: str) -> Optional[float]:
        if not isinstance(context, dict):
            return None

        selected = context.get("selectedComponents")
        if not isinstance(selected, list):
            return None

        for item in selected:
            if not isinstance(item, dict):
                continue
            slot = str(item.get("slot", "")).upper()
            if slot != target_slot.upper():
                continue
            price = OrchestratorAgent._to_number(item.get("price"))
            if price is not None and price > 0:
                return price
        return None

    def _build_office_gpu_adjustment_products(
        self,
        context: Dict[str, object],
        compatibility: Dict[str, Optional[str]],
    ) -> List[ProductSuggestion]:
        if not self._is_office_context(context):
            return []

        selected_gpu_price = self._find_selected_slot_price(context, "GPU")
        if selected_gpu_price is None:
            return []

        constraints = self._extract_budget_constraints(context)
        budget_max = constraints.get("budget_max")
        remaining_budget = constraints.get("remaining_budget")
        over_budget = (
            isinstance(remaining_budget, (int, float))
            and isinstance(budget_max, (int, float))
            and remaining_budget <= 0
        )
        should_adjust = over_budget or (isinstance(budget_max, (int, float)) and budget_max <= 15_000_000)
        if not should_adjust:
            return []

        return self._build_replacement_slot_products(
            slot="GPU",
            context=context,
            compatibility=compatibility,
            preference={"price": "much_lower"},
        )

    @staticmethod
    def _build_office_gpu_note(
        context: Dict[str, object],
        constraints: Dict[str, Optional[float]],
    ) -> Optional[str]:
        if not OrchestratorAgent._is_office_context(context):
            return None

        selected_gpu_price = OrchestratorAgent._find_selected_slot_price(context, "GPU")
        if selected_gpu_price is None:
            return None

        budget_max = constraints.get("budget_max")
        selected_total = OrchestratorAgent._sum_selected_component_price(context)
        if isinstance(budget_max, (int, float)) and selected_total > budget_max:
            over_budget = int(selected_total - budget_max)
            return (
                "Nhu cau van phong: co the bo GPU roi neu CPU co iGPU hoac doi sang GPU gia thap hon. "
                f"Cau hinh hien tai dang vuot ngan sach khoang {over_budget} VND."
            )

        return "Nhu cau van phong: uu tien giam manh GPU hoac bo GPU roi de toi uu chi phi va dien nang."

    @staticmethod
    def _is_low_budget_context(context: Optional[Dict[str, object]]) -> bool:
        if not isinstance(context, dict):
            return False

        budget_max = OrchestratorAgent._extract_budget_max(context)
        return budget_max is not None and budget_max <= 10_000_000

    @staticmethod
    def _extract_budget_constraints(context: Optional[Dict[str, object]]) -> Dict[str, Optional[float]]:
        if not isinstance(context, dict):
            return {
                "budget_max": None,
                "remaining_budget": None,
                "low_budget": False,
            }

        budget_max = OrchestratorAgent._extract_budget_max(context)
        selected_total = OrchestratorAgent._sum_selected_component_price(context)
        remaining_budget = None
        if budget_max is not None:
            remaining_budget = max(0.0, budget_max - selected_total)

        low_budget = budget_max is not None and budget_max <= 10_000_000
        return {
            "budget_max": budget_max,
            "remaining_budget": remaining_budget,
            "low_budget": low_budget,
        }

    @staticmethod
    def _extract_budget_max(context: Dict[str, object]) -> Optional[float]:
        for key in ("budgetMax", "budget_max"):
            numeric = OrchestratorAgent._to_number(context.get(key))
            if numeric is not None and numeric > 0:
                return numeric

        budget_text = context.get("budget")
        if not isinstance(budget_text, str) or not budget_text.strip():
            return None

        normalized = OrchestratorAgent._normalize_for_matching(budget_text)

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
    def _sum_selected_component_price(context: Dict[str, object]) -> float:
        selected = context.get("selectedComponents")
        if not isinstance(selected, list):
            return 0.0

        total = 0.0
        for item in selected:
            if not isinstance(item, dict):
                continue
            price = OrchestratorAgent._to_number(item.get("price"))
            qty = OrchestratorAgent._to_number(item.get("quantity")) or 1.0
            if price is None:
                continue
            total += max(0.0, price) * max(1.0, qty)
        return total

    @staticmethod
    def _is_within_budget_constraints(
        price: Optional[float],
        slot: Optional[str],
        constraints: Dict[str, Optional[float]],
        enforce_slot_caps: bool = True,
    ) -> bool:
        budget_is_active = constraints.get("budget_max") is not None or constraints.get("remaining_budget") is not None
        if price is None:
            return not budget_is_active
        if budget_is_active and price <= 0:
            return False

        remaining_budget = constraints.get("remaining_budget")
        if remaining_budget is not None and price > remaining_budget:
            return False

        budget_max = constraints.get("budget_max")
        if budget_max is not None and price > budget_max:
            return False

        low_budget = bool(constraints.get("low_budget"))
        if low_budget and budget_max is not None and slot:
            ratio_table = LOW_BUDGET_SLOT_CAP_RATIO if enforce_slot_caps else LOW_BUDGET_RELAXED_SLOT_CAP_RATIO
            ratio = ratio_table.get(slot.upper())
            if ratio is not None:
                slot_cap = budget_max * ratio
                if remaining_budget is not None:
                    slot_cap = min(slot_cap, remaining_budget)
                if price > slot_cap:
                    return False

        return True

    @staticmethod
    def _normalize_for_matching(value: str) -> str:
        normalized = unicodedata.normalize("NFD", value.lower())
        without_accents = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        return re.sub(r"\s+", " ", without_accents).strip()

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

        lga_match = re.search(r"LGA\s*(\d{3,4})", text)
        if lga_match:
            return lga_match.group(1)

        num_match = re.search(r"\b\d{4}\b", text)
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
