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
BUDGET_MIN_FLOOR_RATIO = {
    "CPU": 0.14,
    "MAINBOARD": 0.10,
    "RAM": 0.04,
    "SSD": 0.05,
    "PSU": 0.04,
    "CASE": 0.03,
    "COOLER": 0.015,
    "GPU": 0.15,
}
PRIMARY_BUILD_TARGET_RATIO = {
    "CPU": 0.38,
    "MAINBOARD": 0.20,
    "RAM": 0.12,
    "SSD": 0.12,
    "PSU": 0.10,
    "CASE": 0.08,
    "COOLER": 0.04,
    "GPU": 0.30,
}
MIDRANGE_10_15_TARGET_RATIO = {
    "CPU": 0.42,
    "MAINBOARD": 0.20,
    "RAM": 0.08,
    "SSD": 0.12,
    "PSU": 0.07,
    "CASE": 0.06,
    "COOLER": 0.03,
    "GPU": 0.25,
}
SLOT_HARD_CAP_RATIO = {
    "CPU": 0.45,
    "MAINBOARD": 0.28,
    "RAM": 0.18,
    "SSD": 0.18,
    "PSU": 0.16,
    "CASE": 0.14,
    "COOLER": 0.10,
    "GPU": 0.60,
}
OFFICE_SLOT_HARD_CAP_RATIO = {
    "CPU": 0.46,
    "MAINBOARD": 0.24,
    "RAM": 0.16,
    "SSD": 0.16,
    "PSU": 0.12,
    "CASE": 0.08,
    "COOLER": 0.05,
    "GPU": 0.35,
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

MAINBOARD_CPU_PRICE_RATIO_CAP_BY_BUDGET = (
    (20_000_000.0, 0.95),
    (30_000_000.0, 1.05),
)

GPU_CPU_PRICE_RATIO_CAP_BY_BUDGET = (
    (20_000_000.0, 2.20),
    (30_000_000.0, 2.60),
)

OFFICE_OVERKILL_BUDGET_THRESHOLD = 30_000_000.0
OFFICE_OVERKILL_SLOT_CAP_RATIO = {
    "CPU": 0.35,
    "MAINBOARD": 0.20,
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
        direct_component_slot = self._extract_direct_component_slot(query)
        if replacement_slot is None and direct_component_slot is not None:
            replacement_slot = direct_component_slot
            traces.append(
                AgentActionTrace(
                    agent="orchestrator",
                    action="component_lookup_mode",
                    status="success",
                    observation=f"Detected direct component intent for slot {direct_component_slot}",
                )
            )
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
        if not replacement_slot and products:
            current_slots = {(item.slot or "").upper() for item in products if item.slot}
            if len(current_slots) < 5:
                fallback_evidences = self._retrieve_budget_fallback_evidences(context)
                if fallback_evidences:
                    supplemented = self._build_product_suggestions(fallback_evidences, compatibility, context, query)
                    if supplemented:
                        merged: List[ProductSuggestion] = []
                        seen_ids = set()
                        for item in products + supplemented:
                            pid = item.product_id
                            if pid in seen_ids:
                                continue
                            seen_ids.add(pid)
                            merged.append(item)
                        merged_slots = {(item.slot or "").upper() for item in merged if item.slot}
                        if len(merged_slots) > len(current_slots):
                            traces.append(
                                AgentActionTrace(
                                    agent=self.db_agent.name,
                                    action="budget_fallback_supplement",
                                    status="success",
                                    observation=(
                                        f"Expanded slot coverage from {len(current_slots)} to {len(merged_slots)}"
                                    ),
                                )
                            )
                            products = merged[:MAX_PRODUCT_SUGGESTIONS]
                            response_evidences = self._evidences_from_products(products)
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

        if not replacement_slot and products:
            diversified_products = self._ensure_diverse_build_products(products, context, query)
            if len(diversified_products) > len(products):
                traces.append(
                    AgentActionTrace(
                        agent="orchestrator",
                        action="diversify_build_suggestions",
                        status="success",
                        observation=(
                            f"Expanded product slots from {len({(item.slot or '').upper() for item in products})} "
                            f"to {len({(item.slot or '').upper() for item in diversified_products})}"
                        ),
                    )
                )
                products = diversified_products
                response_evidences = self._evidences_from_products(products)

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

        under_budget_data_note = self._build_under_budget_data_note(products, budget_constraints)
        if under_budget_data_note:
            notes = compatibility.get("notes")
            if isinstance(notes, list):
                notes.append(under_budget_data_note)

        if replacement_slot and not products:
            answer = self._sanitize_answer_text(
                f"Toi chua tim duoc {replacement_slot} thay the phu hop trong ngan sach hien tai. "
                "Ban co the mo rong ngan sach hoac noii rong yeu cau de toi goi y them."
            )
        else:
            answer = self._sanitize_answer_text(
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
        if replacement_slot:
            primary_build = list(products)
            response_products = list(products)
            alternatives_by_slot = self._group_alternatives_by_slot(response_products, primary_build)
            estimated_build_total = self._sum_product_prices(primary_build)
            budget_status = self._estimate_budget_status(estimated_build_total, budget_constraints)
        else:
            primary_build = self._select_primary_build(products, budget_constraints)
            primary_build = self._ensure_required_primary_slots(primary_build, budget_constraints, context)
            primary_build = self._rebalance_mainboard_cpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._rebalance_cpu_gpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._lift_primary_to_target(primary_build, budget_constraints, context)
            primary_build = self._rebalance_mainboard_cpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._rebalance_cpu_gpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._ensure_required_primary_slots(primary_build, budget_constraints, context)
            primary_build = self._enforce_office_overkill_caps(primary_build, budget_constraints, context)
            response_products = self._merge_products_with_primary(products, primary_build)
            alternatives_by_slot = self._group_alternatives_by_slot(response_products, primary_build)
            estimated_build_total = self._sum_product_prices(primary_build)
            budget_status = self._estimate_budget_status(estimated_build_total, budget_constraints)

        logger.info("Handled query with %s iterations, %s evidences", iterations, len(evidences))

        return ChatResponse(
            answer=answer,
            confidence=confidence,
            products=response_products,
            primaryBuild=primary_build,
            alternativesBySlot=alternatives_by_slot,
            estimatedBuildTotal=estimated_build_total,
            budgetStatus=budget_status,
            citations=citations,
            trace=ChatTrace(iterations=iterations, actions=traces),
        )

    @staticmethod
    def _merge_products_with_primary(
        products: List[ProductSuggestion],
        primary_build: List[ProductSuggestion],
    ) -> List[ProductSuggestion]:
        merged: List[ProductSuggestion] = []
        seen_ids = set()

        for item in products:
            pid = item.product_id
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            merged.append(item)

        for item in primary_build:
            pid = item.product_id
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            merged.append(item)

        return merged

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
            "Bạn là trợ lý tư vấn linh kiện PC. "
            "Chỉ dựa trên các bằng chứng đã cung cấp, không suy đoán vô căn cứ. "
            "Trả lời ngắn gọn, sạch, dễ đọc bằng TIẾNG VIỆT CÓ DẤU. "
            "Bắt buộc dùng plain text, KHÔNG dùng markdown (**, *, #, - cho tiêu đề). "
            "Chỉ dùng danh sách số 1., 2., 3. nếu cần."
        )
        user_prompt = (
            f"Truy vấn: {query}\n"
            f"Ngữ cảnh: {context}\n"
            f"Bằng chứng:\n{evidence_text}\n"
            "Hãy tổng hợp câu trả lời cuối cùng theo ĐÚNG format sau:\n"
            "Tóm tắt: <1-2 câu ngắn, nêu rõ đã dựa trên dữ liệu nào>\n"
            "Đề xuất ưu tiên:\n"
            "1. <Tên sản phẩm 1>\n"
            "   Lý do: <1 câu>\n"
            "   Thông số chính: <tối đa 2 thông số ngắn>\n"
            "2. <Tên sản phẩm 2>\n"
            "   Lý do: <1 câu>\n"
            "   Thông số chính: <tối đa 2 thông số ngắn>\n"
            "3. <Tên sản phẩm 3 nếu có>\n"
            "   Lý do: <1 câu>\n"
            "   Thông số chính: <tối đa 2 thông số ngắn>\n"
            "Lưu ý: <tối đa 1-2 dòng, chỉ nếu thật sự cần>\n"
            "Bắt buộc dùng tiếng Việt có dấu. Không lặp ý, không chèn ký tự markdown, không xuống dòng thừa."
        )
        if compatibility_notes:
            notes_block = "\n".join([f"- {note}" for note in compatibility_notes])
            user_prompt += f"\nRang buoc tuong thich:\n{notes_block}"
        return self.llm_gateway.generate(system_prompt=system_prompt, user_prompt=user_prompt)

    def _ensure_required_primary_slots(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        if not primary:
            return primary

        required_slots = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU"]
        present_slots = {(item.slot or "").upper() for item in primary if item.slot}
        missing_slots = [slot for slot in required_slots if slot not in present_slots]
        if not missing_slots:
            return primary

        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)
        cpu_item = next((item for item in primary if (item.slot or "").upper() == "CPU"), None)
        cpu_socket = self._extract_socket_from_product(cpu_item) if cpu_item else None
        cpu_platform = self._extract_platform_from_text(cpu_item.name) if cpu_item else None
        current_total = self._sum_product_prices(primary)
        ceiling = budget_max * 1.03
        existing_ids = {item.product_id for item in primary}

        for slot in missing_slots:
            # Choose a budget-aware target per slot when fetching supplements.
            target_price = None
            target_min = constraints.get("target_min")
            if isinstance(target_min, (int, float)) and target_min > 0:
                target_price = target_min * self._target_ratio_for_slot(constraints, slot)

            docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                slot=slot,
                budget_max=float(budget_max),
                target_price=target_price,
                limit=36,
                selected_brand=selected_brand,
                preferred_socket=cpu_socket if slot == "MAINBOARD" else None,
                preferred_platform=cpu_platform if slot == "MAINBOARD" else None,
            )
            if not docs:
                docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot=slot,
                    budget_max=float(budget_max),
                    target_price=None,
                    limit=48,
                    selected_brand=selected_brand,
                    preferred_socket=cpu_socket if slot == "MAINBOARD" else None,
                    preferred_platform=cpu_platform if slot == "MAINBOARD" else None,
                )

            best: Optional[ProductSuggestion] = None
            best_score = float("-inf")
            best_mainboard_relaxed: Optional[ProductSuggestion] = None
            best_mainboard_relaxed_score = float("-inf")
            best_over_budget_core: Optional[ProductSuggestion] = None
            best_over_budget_overflow = float("inf")
            for doc in docs:
                category_id = self._normalize_category_id(doc.get("categoryId"))
                name = self._sanitize_text(doc.get("name", ""))
                normalized_slot = self._infer_slot(
                    category_id=category_id,
                    category_code=doc.get("categoryCode"),
                    name=name,
                )
                if (normalized_slot or "").upper() != slot:
                    continue
                if not self._matches_brand_constraint(selected_brand, normalized_slot, doc, name):
                    continue
                if not self._meets_capacity_requirements(normalized_slot, name, constraints, raw=doc):
                    continue
                is_socket_match = True
                if slot == "MAINBOARD" and cpu_socket:
                    is_socket_match = self._is_socket_compatible(
                        slot="MAINBOARD",
                        raw=doc,
                        cpu_socket=cpu_socket,
                        mainboard_socket=None,
                        cpu_platform=cpu_platform,
                        mainboard_platform=None,
                    )

                candidate_price = self._to_number(doc.get("price"))
                if candidate_price is None or candidate_price <= 0:
                    continue

                if slot == "MAINBOARD":
                    cpu_price = self._to_number(cpu_item.price) if cpu_item is not None else None
                    if not self._is_mainboard_price_balanced(candidate_price, cpu_price, constraints):
                        continue

                candidate_id = str(doc.get("_id", ""))
                if not candidate_id or candidate_id in existing_ids:
                    continue

                candidate = ProductSuggestion(
                    productId=candidate_id,
                    categoryId=category_id,
                    slot=normalized_slot,
                    name=name,
                    price=int(candidate_price),
                    image=doc.get("image"),
                    url=doc.get("url"),
                    reason="Bo sung slot bat buoc cho bo chinh",
                )

                tentative_total = current_total + candidate_price
                if tentative_total > ceiling:
                    if slot in CORE_BUILD_SLOTS:
                        overflow = tentative_total - ceiling
                        if overflow < best_over_budget_overflow:
                            best_over_budget_overflow = overflow
                            best_over_budget_core = candidate
                    continue

                score = self._quality_score_for_slot(candidate, slot)
                if slot == "MAINBOARD" and not is_socket_match:
                    if cpu_socket or cpu_platform:
                        continue
                    if score > best_mainboard_relaxed_score:
                        best_mainboard_relaxed_score = score
                        best_mainboard_relaxed = candidate
                    continue

                if score > best_score:
                    best_score = score
                    best = candidate

            if best is None and slot == "MAINBOARD" and best_mainboard_relaxed is not None:
                best = best_mainboard_relaxed

            if best is None and slot in CORE_BUILD_SLOTS and best_over_budget_core is not None:
                primary = self._make_room_for_required_slot(
                    primary,
                    required_price=float(best_over_budget_core.price or 0),
                    ceiling=float(ceiling),
                )
                current_total = self._sum_product_prices(primary)
                if current_total + float(best_over_budget_core.price or 0) <= ceiling:
                    best = best_over_budget_core

            if best is None and slot == "MAINBOARD" and cpu_item:
                replacement_context = dict(context or {})
                selected_components = replacement_context.get("selectedComponents")
                if not isinstance(selected_components, list):
                    selected_components = []
                selected_components = list(selected_components)
                selected_components.append(
                    {
                        "slot": "CPU",
                        "productId": cpu_item.product_id,
                        "name": cpu_item.name,
                        "price": cpu_item.price,
                    }
                )
                replacement_context["selectedComponents"] = selected_components

                mb_replacements = self._build_replacement_slot_products(
                    slot="MAINBOARD",
                    context=replacement_context,
                    compatibility={
                        "cpu_socket": cpu_socket,
                        "mainboard_socket": None,
                        "cpu_platform": cpu_platform,
                        "mainboard_platform": None,
                    },
                    preference={},
                )
                for candidate in mb_replacements:
                    if candidate.product_id in existing_ids:
                        continue
                    candidate_price = self._to_number(candidate.price)
                    if candidate_price is None or candidate_price <= 0:
                        continue
                    if current_total + candidate_price > ceiling:
                        continue
                    best = candidate
                    break

            if best is None and slot == "MAINBOARD" and cpu_item:
                query_tokens = ["mainboard"]
                if cpu_socket:
                    query_tokens.append(cpu_socket)
                if cpu_platform:
                    query_tokens.append(cpu_platform)
                fallback_query = " ".join(query_tokens)
                obs = self.db_agent.run(
                    AgentTask(
                        query=fallback_query,
                        context=context,
                        max_results=20,
                    )
                )
                if obs.success and obs.evidences:
                    fallback_products = self._build_product_suggestions(
                        obs.evidences,
                        compatibility={
                            "cpu_socket": cpu_socket,
                            "mainboard_socket": None,
                            "cpu_platform": cpu_platform,
                            "mainboard_platform": None,
                        },
                        context=context,
                        query=fallback_query,
                    )
                    for candidate in fallback_products:
                        if (candidate.slot or "").upper() != "MAINBOARD":
                            continue
                        if candidate.product_id in existing_ids:
                            continue
                        candidate_price = self._to_number(candidate.price)
                        if candidate_price is None or candidate_price <= 0:
                            continue
                        if current_total + candidate_price > ceiling:
                            primary = self._make_room_for_required_slot(
                                primary,
                                required_price=float(candidate_price),
                                ceiling=float(ceiling),
                            )
                            current_total = self._sum_product_prices(primary)
                        if current_total + candidate_price > ceiling:
                            continue
                        best = candidate
                        break

            if best is not None:
                primary.append(best)
                existing_ids.add(best.product_id)
                current_total = self._sum_product_prices(primary)
                if (best.slot or "").upper() == "MAINBOARD" and cpu_item:
                    primary = self._enforce_primary_cpu_mainboard_compatibility(
                        primary,
                        {
                            slot_key: [item for item in primary if (item.slot or "").upper() == slot_key]
                            for slot_key in {((item.slot or "").upper()) for item in primary if item.slot}
                        },
                    )

        return primary

    @staticmethod
    def _make_room_for_required_slot(
        primary: List[ProductSuggestion],
        required_price: float,
        ceiling: float,
    ) -> List[ProductSuggestion]:
        if required_price <= 0:
            return primary

        working = list(primary)
        drop_priority = ["COOLER", "CASE", "GPU"]

        def _total(items: List[ProductSuggestion]) -> float:
            return float(OrchestratorAgent._sum_product_prices(items))

        for slot in drop_priority:
            while _total(working) + required_price > ceiling:
                idx = next((i for i, item in enumerate(working) if (item.slot or "").upper() == slot), None)
                if idx is None:
                    break
                working.pop(idx)

        return working

    def _rebalance_mainboard_cpu_with_db(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        mb_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "MAINBOARD"), None)
        if cpu_idx is None or mb_idx is None:
            return primary

        cpu_item = primary[cpu_idx]
        mb_item = primary[mb_idx]
        cpu_price = self._to_number(cpu_item.price)
        mb_price = self._to_number(mb_item.price)
        if self._is_mainboard_price_balanced(mb_price, cpu_price, constraints):
            return primary

        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)
        cpu_socket = self._extract_socket_from_product(cpu_item)
        cpu_platform = self._extract_platform_from_text(cpu_item.name)
        current_total = self._sum_product_prices(primary)
        ceiling = float(budget_max) * 1.03

        cheaper_mainboards = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="MAINBOARD",
            budget_max=float(budget_max),
            target_price=cpu_price if isinstance(cpu_price, (int, float)) else None,
            limit=72,
            exclude_product_ids=[mb_item.product_id],
            selected_brand=selected_brand,
            preferred_socket=None,
            preferred_platform=None,
        )
        for doc in cheaper_mainboards:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "MAINBOARD":
                continue
            if not self._matches_brand_constraint(selected_brand, slot, doc, name):
                continue
            if not self._is_socket_compatible(
                slot="MAINBOARD",
                raw=doc,
                cpu_socket=cpu_socket,
                mainboard_socket=None,
                cpu_platform=cpu_platform,
                mainboard_platform=None,
            ):
                continue
            candidate_price = self._to_number(doc.get("price"))
            if not self._is_mainboard_price_balanced(candidate_price, cpu_price, constraints):
                continue
            if candidate_price is None or candidate_price <= 0:
                continue
            candidate = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="MAINBOARD",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                reason="Can bang gia MAINBOARD so voi CPU",
            )
            primary[mb_idx] = candidate
            return primary

        mainboard_socket = self._extract_socket_from_product(mb_item)
        mainboard_platform = self._extract_platform_from_text(mb_item.name)
        better_cpus = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="CPU",
            budget_max=float(budget_max),
            target_price=mb_price,
            limit=36,
            exclude_product_ids=[cpu_item.product_id],
            selected_brand=selected_brand,
            preferred_socket=mainboard_socket,
            preferred_platform=mainboard_platform,
        )
        for doc in better_cpus:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "CPU":
                continue
            if not self._matches_brand_constraint(selected_brand, slot, doc, name):
                continue
            if not self._is_socket_compatible(
                slot="CPU",
                raw=doc,
                cpu_socket=None,
                mainboard_socket=mainboard_socket,
                cpu_platform=None,
                mainboard_platform=mainboard_platform,
            ):
                continue
            candidate_price = self._to_number(doc.get("price"))
            if not self._is_mainboard_price_balanced(mb_price, candidate_price, constraints):
                continue
            if candidate_price is None or candidate_price <= 0:
                continue
            tentative_total = current_total - (cpu_price or 0.0) + candidate_price
            if tentative_total > ceiling:
                continue
            candidate = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="CPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                reason="Nang CPU de can bang voi MAINBOARD",
            )
            primary[cpu_idx] = candidate
            return primary

        return primary

    @staticmethod
    def _mainboard_cpu_price_cap(
        cpu_price: Optional[float],
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> Optional[float]:
        if not isinstance(cpu_price, (int, float)) or cpu_price <= 0:
            return None

        budget_max = None
        if isinstance(constraints, dict):
            raw = constraints.get("budget_max")
            if isinstance(raw, (int, float)) and raw > 0:
                budget_max = float(raw)

        ratio = 1.20
        if isinstance(budget_max, (int, float)):
            for threshold, capped_ratio in MAINBOARD_CPU_PRICE_RATIO_CAP_BY_BUDGET:
                if budget_max <= threshold:
                    ratio = capped_ratio
                    break
        return float(cpu_price) * ratio

    @staticmethod
    def _is_mainboard_price_balanced(
        mainboard_price: Optional[float],
        cpu_price: Optional[float],
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> bool:
        if not isinstance(mainboard_price, (int, float)) or mainboard_price <= 0:
            return False
        cap = OrchestratorAgent._mainboard_cpu_price_cap(cpu_price, constraints)
        if cap is None:
            return True
        return float(mainboard_price) <= cap

    @staticmethod
    def _gpu_cpu_price_ratio_cap(
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> float:
        budget_max = None
        if isinstance(constraints, dict):
            raw = constraints.get("budget_max")
            if isinstance(raw, (int, float)) and raw > 0:
                budget_max = float(raw)

        if isinstance(budget_max, (int, float)):
            for threshold, capped_ratio in GPU_CPU_PRICE_RATIO_CAP_BY_BUDGET:
                if budget_max <= threshold:
                    return capped_ratio
        return 3.0

    @staticmethod
    def _is_cpu_gpu_price_balanced(
        cpu_price: Optional[float],
        gpu_price: Optional[float],
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> bool:
        if not isinstance(cpu_price, (int, float)) or cpu_price <= 0:
            return True
        if not isinstance(gpu_price, (int, float)) or gpu_price <= 0:
            return True
        cap = OrchestratorAgent._gpu_cpu_price_ratio_cap(constraints)
        return float(gpu_price) <= float(cpu_price) * cap

    def _rebalance_cpu_gpu_with_db(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        gpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "GPU"), None)
        if cpu_idx is None or gpu_idx is None:
            return primary

        cpu_item = primary[cpu_idx]
        gpu_item = primary[gpu_idx]
        cpu_price = self._to_number(cpu_item.price)
        gpu_price = self._to_number(gpu_item.price)
        if self._is_cpu_gpu_price_balanced(cpu_price, gpu_price, constraints):
            return primary

        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)
        current_total = self._sum_product_prices(primary)
        ceiling = float(budget_max) * 1.03
        ratio_cap = self._gpu_cpu_price_ratio_cap(constraints)

        target_gpu = None
        if isinstance(cpu_price, (int, float)):
            target_gpu = max(1.0, float(cpu_price) * ratio_cap * 0.9)

        cheaper_gpus = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="GPU",
            budget_max=float(gpu_price) if isinstance(gpu_price, (int, float)) and gpu_price > 0 else float(budget_max),
            target_price=target_gpu,
            limit=40,
            exclude_product_ids=[gpu_item.product_id],
            selected_brand=selected_brand,
        )
        for doc in cheaper_gpus:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "GPU":
                continue
            if not self._matches_brand_constraint(selected_brand, slot, doc, name):
                continue
            candidate_price = self._to_number(doc.get("price"))
            if not self._is_cpu_gpu_price_balanced(cpu_price, candidate_price, constraints):
                continue
            if candidate_price is None or candidate_price <= 0:
                continue
            primary[gpu_idx] = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="GPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                reason="Can bang gia GPU voi CPU",
            )
            return primary

        # If no suitable cheaper GPU, try a stronger CPU while keeping budget near ceiling.
        mainboard_item = next((item for item in primary if (item.slot or "").upper() == "MAINBOARD"), None)
        preferred_socket = self._extract_socket_from_product(mainboard_item) if mainboard_item is not None else None
        preferred_platform = self._extract_platform_from_text(mainboard_item.name) if mainboard_item is not None else None
        target_cpu = None
        if isinstance(gpu_price, (int, float)) and ratio_cap > 0:
            target_cpu = max(1.0, float(gpu_price) / ratio_cap)

        better_cpus = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="CPU",
            budget_max=float(budget_max),
            target_price=target_cpu,
            limit=40,
            exclude_product_ids=[cpu_item.product_id],
            selected_brand=selected_brand,
            preferred_socket=preferred_socket,
            preferred_platform=preferred_platform,
        )
        for doc in better_cpus:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "CPU":
                continue
            if not self._matches_brand_constraint(selected_brand, slot, doc, name):
                continue
            candidate_price = self._to_number(doc.get("price"))
            if not self._is_cpu_gpu_price_balanced(candidate_price, gpu_price, constraints):
                continue
            if candidate_price is None or candidate_price <= 0:
                continue
            tentative_total = current_total - (cpu_price or 0.0) + candidate_price
            if tentative_total > ceiling:
                continue
            primary[cpu_idx] = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="CPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                reason="Nang CPU de can bang voi GPU",
            )
            return primary

        return primary

    def _enforce_office_overkill_caps(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        if not bool(constraints.get("office_overkill_mode")):
            return primary

        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)

        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        mb_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "MAINBOARD"), None)

        if cpu_idx is not None:
            cpu_item = primary[cpu_idx]
            cpu_price = self._to_number(cpu_item.price)
            cpu_cap = float(budget_max) * OFFICE_OVERKILL_SLOT_CAP_RATIO.get("CPU", 0.35)
            if isinstance(cpu_price, (int, float)) and cpu_price > cpu_cap:
                mb_item = primary[mb_idx] if mb_idx is not None else None
                mb_socket = self._extract_socket_from_product(mb_item) if mb_item is not None else None
                mb_platform = self._extract_platform_from_text(mb_item.name) if mb_item is not None else None
                cpu_docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot="CPU",
                    budget_max=cpu_cap,
                    target_price=cpu_cap * 0.9,
                    limit=48,
                    exclude_product_ids=[cpu_item.product_id],
                    selected_brand=selected_brand,
                    preferred_socket=mb_socket,
                    preferred_platform=mb_platform,
                )
                for doc in cpu_docs:
                    category_id = self._normalize_category_id(doc.get("categoryId"))
                    name = self._sanitize_text(doc.get("name", ""))
                    slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
                    if (slot or "").upper() != "CPU":
                        continue
                    if not self._matches_brand_constraint(selected_brand, slot, doc, name):
                        continue
                    if not self._is_socket_compatible(
                        slot="CPU",
                        raw=doc,
                        cpu_socket=None,
                        mainboard_socket=mb_socket,
                        cpu_platform=None,
                        mainboard_platform=mb_platform,
                    ):
                        continue
                    candidate_price = self._to_number(doc.get("price"))
                    if candidate_price is None or candidate_price <= 0 or candidate_price > cpu_cap:
                        continue
                    primary[cpu_idx] = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot="CPU",
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        reason="Office >30M: gioi han overkill CPU",
                    )
                    break

        cpu_item = primary[cpu_idx] if cpu_idx is not None else None
        if mb_idx is not None:
            mb_item = primary[mb_idx]
            mb_price = self._to_number(mb_item.price)
            mb_cap = float(budget_max) * OFFICE_OVERKILL_SLOT_CAP_RATIO.get("MAINBOARD", 0.20)
            if isinstance(mb_price, (int, float)) and mb_price > mb_cap:
                cpu_socket = self._extract_socket_from_product(cpu_item) if cpu_item is not None else None
                cpu_platform = self._extract_platform_from_text(cpu_item.name) if cpu_item is not None else None
                mb_docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot="MAINBOARD",
                    budget_max=mb_cap,
                    target_price=mb_cap * 0.9,
                    limit=48,
                    exclude_product_ids=[mb_item.product_id],
                    selected_brand=selected_brand,
                    preferred_socket=cpu_socket,
                    preferred_platform=cpu_platform,
                )
                for doc in mb_docs:
                    category_id = self._normalize_category_id(doc.get("categoryId"))
                    name = self._sanitize_text(doc.get("name", ""))
                    slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
                    if (slot or "").upper() != "MAINBOARD":
                        continue
                    if not self._matches_brand_constraint(selected_brand, slot, doc, name):
                        continue
                    if not self._is_socket_compatible(
                        slot="MAINBOARD",
                        raw=doc,
                        cpu_socket=cpu_socket,
                        mainboard_socket=None,
                        cpu_platform=cpu_platform,
                        mainboard_platform=None,
                    ):
                        continue
                    candidate_price = self._to_number(doc.get("price"))
                    if candidate_price is None or candidate_price <= 0 or candidate_price > mb_cap:
                        continue
                    primary[mb_idx] = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot="MAINBOARD",
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        reason="Office >30M: gioi han overkill MAINBOARD",
                    )
                    break

        return self._enforce_primary_cpu_mainboard_compatibility(
            primary,
            {
                slot_key: [item for item in primary if (item.slot or "").upper() == slot_key]
                for slot_key in {((item.slot or "").upper()) for item in primary if item.slot}
            },
        )

    @staticmethod
    def _rebalance_mainboard_price_vs_cpu(
        primary: List[ProductSuggestion],
        by_slot: Dict[str, List[ProductSuggestion]],
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> List[ProductSuggestion]:
        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        mb_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "MAINBOARD"), None)
        if cpu_idx is None or mb_idx is None:
            return primary

        cpu_item = primary[cpu_idx]
        mb_item = primary[mb_idx]
        cpu_price = OrchestratorAgent._to_number(cpu_item.price)
        mb_price = OrchestratorAgent._to_number(mb_item.price)
        if OrchestratorAgent._is_mainboard_price_balanced(mb_price, cpu_price, constraints):
            return primary

        candidates = by_slot.get("MAINBOARD", []) or [mb_item]
        compatible_candidates = [
            item for item in candidates if OrchestratorAgent._are_products_socket_compatible(cpu_item, item)
        ]
        if not compatible_candidates:
            return primary

        balanced_candidates = []
        for candidate in compatible_candidates:
            candidate_price = OrchestratorAgent._to_number(candidate.price)
            if OrchestratorAgent._is_mainboard_price_balanced(candidate_price, cpu_price, constraints):
                balanced_candidates.append(candidate)

        if balanced_candidates:
            balanced_candidates.sort(key=lambda item: OrchestratorAgent._to_number(item.price) or 0.0)
            primary[mb_idx] = balanced_candidates[0]
            return primary

        cpu_candidates = by_slot.get("CPU", []) or [cpu_item]
        balanced_cpu_for_current_mb = []
        for cpu_candidate in cpu_candidates:
            if not OrchestratorAgent._are_products_socket_compatible(cpu_candidate, mb_item):
                continue
            cpu_candidate_price = OrchestratorAgent._to_number(cpu_candidate.price)
            if OrchestratorAgent._is_mainboard_price_balanced(mb_price, cpu_candidate_price, constraints):
                balanced_cpu_for_current_mb.append(cpu_candidate)

        if balanced_cpu_for_current_mb:
            balanced_cpu_for_current_mb.sort(
                key=lambda item: (OrchestratorAgent._to_number(item.price) or 0.0)
            )
            primary[cpu_idx] = balanced_cpu_for_current_mb[0]
            return primary

        best_pair = None
        best_pair_total = float("-inf")
        for cpu_candidate in cpu_candidates:
            cpu_candidate_price = OrchestratorAgent._to_number(cpu_candidate.price)
            if cpu_candidate_price is None or cpu_candidate_price <= 0:
                continue
            for mb_candidate in compatible_candidates:
                if not OrchestratorAgent._are_products_socket_compatible(cpu_candidate, mb_candidate):
                    continue
                mb_candidate_price = OrchestratorAgent._to_number(mb_candidate.price)
                if not OrchestratorAgent._is_mainboard_price_balanced(mb_candidate_price, cpu_candidate_price, constraints):
                    continue
                pair_total = cpu_candidate_price + (mb_candidate_price or 0.0)
                if pair_total > best_pair_total:
                    best_pair_total = pair_total
                    best_pair = (cpu_candidate, mb_candidate)

        if best_pair is not None:
            primary[cpu_idx], primary[mb_idx] = best_pair
            return primary

        compatible_candidates.sort(key=lambda item: OrchestratorAgent._to_number(item.price) or 0.0)
        primary[mb_idx] = compatible_candidates[0]
        return primary

    def _lift_primary_to_target(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        if not primary:
            return primary

        target_min = constraints.get("target_min")
        target_max = constraints.get("target_max")
        budget_max = constraints.get("budget_max")
        if not isinstance(target_min, (int, float)) or target_min <= 0:
            return primary

        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            budget_max = target_max if isinstance(target_max, (int, float)) else None
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)
        current_total = self._sum_product_prices(primary)
        if current_total >= target_min:
            return primary

        ceiling = target_max if isinstance(target_max, (int, float)) and target_max > 0 else budget_max
        if not isinstance(ceiling, (int, float)) or ceiling <= 0:
            ceiling = budget_max

        preferred_upgrade_slots = ["RAM", "SSD", "MAINBOARD", "CPU", "PSU", "CASE", "COOLER"]
        improved = True
        while improved and current_total < target_min:
            improved = False
            best_upgrade = None
            best_delta = 0.0

            for slot in preferred_upgrade_slots:
                idx = next((i for i, item in enumerate(primary) if (item.slot or "").upper() == slot), None)
                if idx is None:
                    continue

                current_item = primary[idx]
                current_price = self._to_number(current_item.price) or 0.0
                target_price = target_min * self._target_ratio_for_slot(constraints, slot)
                peer_item = None
                preferred_socket = None
                preferred_platform = None
                if slot == "MAINBOARD":
                    peer_item = next((item for item in primary if (item.slot or "").upper() == "CPU"), None)
                    if peer_item is not None:
                        preferred_socket = self._extract_socket_from_product(peer_item)
                        preferred_platform = self._extract_platform_from_text(peer_item.name)
                if slot == "CPU":
                    peer_item = next((item for item in primary if (item.slot or "").upper() == "MAINBOARD"), None)
                    if peer_item is not None:
                        preferred_socket = self._extract_socket_from_product(peer_item)
                        preferred_platform = self._extract_platform_from_text(peer_item.name)
                docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot=slot,
                    budget_max=float(budget_max),
                    target_price=target_price,
                    limit=24,
                    exclude_product_ids=[current_item.product_id],
                    selected_brand=selected_brand,
                    preferred_socket=preferred_socket,
                    preferred_platform=preferred_platform,
                )

                for doc in docs:
                    category_id = self._normalize_category_id(doc.get("categoryId"))
                    name = self._sanitize_text(doc.get("name", ""))
                    normalized_slot = self._infer_slot(
                        category_id=category_id,
                        category_code=doc.get("categoryCode"),
                        name=name,
                    )
                    if (normalized_slot or "").upper() != slot:
                        continue
                    if not self._matches_brand_constraint(selected_brand, normalized_slot, doc, name):
                        continue
                    if not self._meets_capacity_requirements(normalized_slot, name, constraints, raw=doc):
                        continue

                    candidate_price = self._to_number(doc.get("price"))
                    if candidate_price is None or candidate_price <= current_price:
                        continue

                    if slot == "MAINBOARD":
                        cpu_price = self._to_number(peer_item.price) if peer_item is not None else None
                        if not self._is_mainboard_price_balanced(candidate_price, cpu_price, constraints):
                            continue

                    tentative_total = current_total - current_price + candidate_price
                    if tentative_total > float(ceiling) * 1.03:
                        continue

                    candidate = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot=normalized_slot,
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        reason="Nang cap de dat muc gia muc tieu",
                    )

                    delta = candidate_price - current_price
                    if delta > best_delta:
                        best_delta = delta
                        best_upgrade = (idx, candidate, tentative_total)

            if best_upgrade is not None:
                idx, candidate, tentative_total = best_upgrade
                primary[idx] = candidate
                primary = self._enforce_primary_cpu_mainboard_compatibility(
                    primary,
                    {
                        slot: [item for item in primary if (item.slot or "").upper() == slot]
                        for slot in {((item.slot or "").upper()) for item in primary if item.slot}
                    },
                )
                current_total = self._sum_product_prices(primary)
                improved = True

        return primary

    @staticmethod
    def _estimate_confidence(evidences: List[RetrievedEvidence]) -> float:
        if not evidences:
            return 0.0
        top_scores = [max(0.0, min(1.0, ev.score)) for ev in evidences[:5]]
        return round(sum(top_scores) / len(top_scores), 3)

    @staticmethod
    def _select_primary_build(
        products: List[ProductSuggestion],
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> List[ProductSuggestion]:
        by_slot: Dict[str, List[ProductSuggestion]] = {}
        for item in products:
            slot = (item.slot or "").upper()
            if not slot:
                continue
            by_slot.setdefault(slot, []).append(item)

        primary: List[ProductSuggestion] = []
        ordered_slots = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER", "GPU"]
        used_slots = set()
        for slot in ordered_slots:
            candidates = by_slot.get(slot, [])
            if not candidates:
                continue
            primary.append(candidates[0])
            used_slots.add(slot)

        for item in products:
            slot = (item.slot or "").upper()
            if not slot or slot in used_slots:
                continue
            primary.append(item)
            used_slots.add(slot)

        # Ensure CPU and MAINBOARD in primary are socket-compatible when both slots exist.
        primary = OrchestratorAgent._enforce_primary_cpu_mainboard_compatibility(primary, by_slot)
        primary = OrchestratorAgent._rebalance_mainboard_price_vs_cpu(primary, by_slot, constraints)

        if not primary or not isinstance(constraints, dict):
            return primary

        budget_min = constraints.get("budget_min")
        budget_max = constraints.get("budget_max")
        target_min = constraints.get("target_min")
        target_max = constraints.get("target_max")
        office_mode = bool(constraints.get("office_mode"))
        if not isinstance(budget_min, (int, float)) or budget_min <= 0:
            return primary

        desired_floor = budget_min
        if isinstance(target_min, (int, float)) and target_min > budget_min:
            desired_floor = target_min

        desired_ceiling = None
        if isinstance(target_max, (int, float)) and target_max > 0:
            desired_ceiling = target_max
        elif isinstance(budget_max, (int, float)) and budget_max > 0:
            desired_ceiling = budget_max

        current_total = OrchestratorAgent._sum_product_prices(primary)
        slot_order = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER", "GPU"]
        if office_mode:
            slot_order = ["RAM", "SSD", "PSU", "MAINBOARD", "CPU", "CASE", "COOLER", "GPU"]

        # If total already exceeds budget_max, try downgrading slot-by-slot first.
        if isinstance(budget_max, (int, float)) and budget_max > 0 and current_total > budget_max:
            downgrade_order = ["CASE", "COOLER", "PSU", "SSD", "RAM", "MAINBOARD", "CPU", "GPU"]
            for slot in downgrade_order:
                if current_total <= budget_max:
                    break
                current_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == slot), None)
                if current_idx is None:
                    continue

                current_item = primary[current_idx]
                current_price = OrchestratorAgent._to_number(current_item.price) or 0.0
                cheaper = [
                    item
                    for item in by_slot.get(slot, [])
                    if (OrchestratorAgent._to_number(item.price) or 0.0) < current_price
                ]
                cheaper.sort(key=lambda item: (OrchestratorAgent._to_number(item.price) or 0.0))
                for candidate in cheaper:
                    if slot in {"CPU", "MAINBOARD"}:
                        candidate_primary = list(primary)
                        candidate_primary[current_idx] = candidate
                        candidate_primary = OrchestratorAgent._enforce_primary_cpu_mainboard_compatibility(
                            candidate_primary,
                            by_slot,
                        )
                        if OrchestratorAgent._sum_product_prices(candidate_primary) >= current_total:
                            continue
                        primary = candidate_primary
                        current_total = OrchestratorAgent._sum_product_prices(primary)
                        break

                    tentative_total = current_total - current_price + (OrchestratorAgent._to_number(candidate.price) or 0.0)
                    if tentative_total >= current_total:
                        continue
                    primary[current_idx] = candidate
                    current_total = OrchestratorAgent._sum_product_prices(primary)
                    break

        # If currently under budget floor, try to replace each slot with higher-priced candidates.
        for slot in slot_order:
            if current_total >= desired_floor:
                break

            current_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == slot), None)
            if current_idx is None:
                continue

            current_item = primary[current_idx]
            current_price = OrchestratorAgent._to_number(current_item.price) or 0.0
            candidates = by_slot.get(slot, [])
            if len(candidates) <= 1:
                continue

            better = [
                item
                for item in candidates
                if (OrchestratorAgent._to_number(item.price) or 0.0) > current_price
            ]
            if not better:
                continue

            better.sort(
                key=lambda item: (
                    -OrchestratorAgent._quality_score_for_slot(item, slot),
                    -((OrchestratorAgent._to_number(item.price) or 0.0)),
                )
            )

            replacement = better[0]
            replacement_price = OrchestratorAgent._to_number(replacement.price) or 0.0
            if (
                office_mode
                and isinstance(budget_max, (int, float))
                and budget_max > 0
                and not OrchestratorAgent._is_within_office_slot_cap(
                    slot,
                    replacement_price,
                    budget_max,
                    current_total=current_total,
                    budget_min=budget_min,
                )
            ):
                continue

            if slot in {"CPU", "MAINBOARD"}:
                primary_candidate = list(primary)
                primary_candidate[current_idx] = replacement
                primary_candidate = OrchestratorAgent._enforce_primary_cpu_mainboard_compatibility(
                    primary_candidate,
                    by_slot,
                )
                primary_candidate = OrchestratorAgent._rebalance_mainboard_price_vs_cpu(
                    primary_candidate,
                    by_slot,
                    constraints,
                )
                replacement_idx = next(
                    (idx for idx, item in enumerate(primary_candidate) if (item.slot or "").upper() == slot),
                    None,
                )
                if replacement_idx is not None:
                    replacement = primary_candidate[replacement_idx]

            if slot == "MAINBOARD":
                cpu_item_for_cap = next((item for item in primary if (item.slot or "").upper() == "CPU"), None)
                cpu_price_for_cap = OrchestratorAgent._to_number(cpu_item_for_cap.price) if cpu_item_for_cap is not None else None
                if not OrchestratorAgent._is_mainboard_price_balanced(replacement_price, cpu_price_for_cap, constraints):
                    continue

            if replacement.product_id == current_item.product_id:
                continue

            tentative_total = current_total - current_price + (OrchestratorAgent._to_number(replacement.price) or 0.0)
            if isinstance(budget_max, (int, float)) and budget_max > 0 and tentative_total > budget_max * 1.03:
                continue
            if isinstance(desired_ceiling, (int, float)) and desired_ceiling > 0 and tentative_total > desired_ceiling * 1.03:
                continue

            primary[current_idx] = replacement
            current_total = OrchestratorAgent._sum_product_prices(primary)

        if office_mode:
            primary = OrchestratorAgent._rebalance_primary_for_office(primary, by_slot, constraints)

        # Optional filler: add a cooler to primary when available and build is still far under budget.
        has_cooler = any((item.slot or "").upper() == "COOLER" for item in primary)
        cooler_candidates = by_slot.get("COOLER", [])
        if not has_cooler and cooler_candidates and current_total < budget_min * 0.95:
            cooler_candidates = sorted(
                cooler_candidates,
                key=lambda item: -(OrchestratorAgent._to_number(item.price) or 0.0),
            )
            for candidate in cooler_candidates:
                candidate_price = OrchestratorAgent._to_number(candidate.price) or 0.0
                tentative_total = current_total + candidate_price
                if isinstance(budget_max, (int, float)) and budget_max > 0 and tentative_total > budget_max * 1.03:
                    continue
                primary.append(candidate)
                current_total = OrchestratorAgent._sum_product_prices(primary)
                break

        # Final nudge: if still below desired floor, greedily upgrade by value while staying in desired ceiling.
        if current_total < desired_floor:
            improved = True
            while improved and current_total < desired_floor:
                improved = False
                best_upgrade = None
                best_delta = 0.0
                for idx, current_item in enumerate(primary):
                    slot = (current_item.slot or "").upper()
                    current_price = OrchestratorAgent._to_number(current_item.price) or 0.0
                    for candidate in by_slot.get(slot, []):
                        candidate_price = OrchestratorAgent._to_number(candidate.price) or 0.0
                        delta = candidate_price - current_price
                        if delta <= 0:
                            continue
                        tentative_total = current_total + delta
                        if isinstance(desired_ceiling, (int, float)) and desired_ceiling > 0 and tentative_total > desired_ceiling * 1.03:
                            continue
                        if slot in {"CPU", "MAINBOARD"}:
                            candidate_primary = list(primary)
                            candidate_primary[idx] = candidate
                            candidate_primary = OrchestratorAgent._enforce_primary_cpu_mainboard_compatibility(
                                candidate_primary,
                                by_slot,
                            )
                            candidate_primary = OrchestratorAgent._rebalance_mainboard_price_vs_cpu(
                                candidate_primary,
                                by_slot,
                                constraints,
                            )
                            tentative_total = OrchestratorAgent._sum_product_prices(candidate_primary)
                            if isinstance(desired_ceiling, (int, float)) and desired_ceiling > 0 and tentative_total > desired_ceiling * 1.03:
                                continue
                            if delta > best_delta:
                                best_delta = delta
                                best_upgrade = (idx, candidate_primary[idx], tentative_total)
                            continue
                        if delta > best_delta:
                            best_delta = delta
                            best_upgrade = (idx, candidate, tentative_total)

                if best_upgrade is not None:
                    idx, candidate, tentative_total = best_upgrade
                    primary[idx] = candidate
                    current_total = int(tentative_total)
                    improved = True

        return primary

    @staticmethod
    def _is_within_office_slot_cap(
        slot: str,
        price: float,
        budget_max: float,
        current_total: Optional[float] = None,
        budget_min: Optional[float] = None,
    ) -> bool:
        slot_key = (slot or "").upper()
        ratio = OFFICE_SLOT_HARD_CAP_RATIO.get(slot_key)
        if ratio is None:
            return True

        adaptive_ratio = ratio
        if (
            slot_key == "CPU"
            and isinstance(current_total, (int, float))
            and isinstance(budget_min, (int, float))
            and budget_min > 0
            and current_total < budget_min * 0.85
        ):
            adaptive_ratio = max(adaptive_ratio, 0.52)

        return price <= budget_max * adaptive_ratio

    @staticmethod
    def _rebalance_primary_for_office(
        primary: List[ProductSuggestion],
        by_slot: Dict[str, List[ProductSuggestion]],
        constraints: Dict[str, Optional[float]],
    ) -> List[ProductSuggestion]:
        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        current_total = OrchestratorAgent._sum_product_prices(primary)

        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        if cpu_idx is not None:
            current_cpu = primary[cpu_idx]
            current_cpu_price = OrchestratorAgent._to_number(current_cpu.price) or 0.0
            cpu_cap = budget_max * OFFICE_SLOT_HARD_CAP_RATIO.get("CPU", 0.40)
            if current_cpu_price > cpu_cap:
                cpu_candidates = sorted(
                    by_slot.get("CPU", []),
                    key=lambda item: OrchestratorAgent._to_number(item.price) or 0.0,
                    reverse=True,
                )
                for candidate in cpu_candidates:
                    candidate_price = OrchestratorAgent._to_number(candidate.price) or 0.0
                    if candidate_price <= 0 or candidate_price > cpu_cap:
                        continue
                    candidate_primary = list(primary)
                    candidate_primary[cpu_idx] = candidate
                    candidate_primary = OrchestratorAgent._enforce_primary_cpu_mainboard_compatibility(
                        candidate_primary,
                        by_slot,
                    )
                    candidate_total = OrchestratorAgent._sum_product_prices(candidate_primary)
                    if candidate_total <= budget_max:
                        primary = candidate_primary
                        current_total = candidate_total
                        break

        # Spend reclaimed budget on practical office value slots first.
        for slot in ["RAM", "SSD", "PSU", "MAINBOARD"]:
            slot_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == slot), None)
            if slot_idx is None:
                continue

            current_item = primary[slot_idx]
            current_price = OrchestratorAgent._to_number(current_item.price) or 0.0
            candidates = [
                item
                for item in by_slot.get(slot, [])
                if (OrchestratorAgent._to_number(item.price) or 0.0) > current_price
            ]
            if not candidates:
                continue

            candidates.sort(
                key=lambda item: (
                    -OrchestratorAgent._quality_score_for_slot(item, slot),
                    -(OrchestratorAgent._to_number(item.price) or 0.0),
                )
            )

            for candidate in candidates:
                candidate_price = OrchestratorAgent._to_number(candidate.price) or 0.0
                if not OrchestratorAgent._is_within_office_slot_cap(
                    slot,
                    candidate_price,
                    float(budget_max),
                    current_total=current_total,
                    budget_min=constraints.get("budget_min"),
                ):
                    continue

                tentative_total = current_total - current_price + candidate_price
                if tentative_total > budget_max:
                    continue

                candidate_primary = list(primary)
                candidate_primary[slot_idx] = candidate
                if slot == "MAINBOARD":
                    candidate_primary = OrchestratorAgent._enforce_primary_cpu_mainboard_compatibility(
                        candidate_primary,
                        by_slot,
                    )
                    tentative_total = OrchestratorAgent._sum_product_prices(candidate_primary)
                    if tentative_total > budget_max:
                        continue

                primary = candidate_primary
                current_total = tentative_total
                break

        return primary

    @staticmethod
    def _enforce_primary_cpu_mainboard_compatibility(
        primary: List[ProductSuggestion],
        by_slot: Dict[str, List[ProductSuggestion]],
    ) -> List[ProductSuggestion]:
        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        mb_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "MAINBOARD"), None)

        if cpu_idx is None or mb_idx is None:
            return primary

        cpu_item = primary[cpu_idx]
        mb_item = primary[mb_idx]
        if OrchestratorAgent._are_products_socket_compatible(cpu_item, mb_item):
            return primary

        cpu_candidates = by_slot.get("CPU", []) or [cpu_item]
        mb_candidates = by_slot.get("MAINBOARD", []) or [mb_item]

        selected_cpu = cpu_item
        selected_mb = mb_item
        best_score = float("-inf")
        found_compatible_pair = False
        for cpu_candidate in cpu_candidates:
            for mb_candidate in mb_candidates:
                if not OrchestratorAgent._are_products_socket_compatible(cpu_candidate, mb_candidate):
                    continue
                found_compatible_pair = True
                cpu_price = OrchestratorAgent._to_number(cpu_candidate.price) or 0.0
                mb_price = OrchestratorAgent._to_number(mb_candidate.price) or 0.0
                score = cpu_price + mb_price
                if score > best_score:
                    best_score = score
                    selected_cpu = cpu_candidate
                    selected_mb = mb_candidate

        if not found_compatible_pair:
            # Keep CPU and drop incompatible mainboard; it will be supplemented later if needed.
            primary.pop(mb_idx)
            return primary

        primary[cpu_idx] = selected_cpu
        primary[mb_idx] = selected_mb
        return primary

    @staticmethod
    def _are_products_socket_compatible(cpu: ProductSuggestion, mainboard: ProductSuggestion) -> bool:
        cpu_socket = OrchestratorAgent._extract_socket_from_product(cpu)
        mainboard_socket = OrchestratorAgent._extract_socket_from_product(mainboard)
        if cpu_socket and mainboard_socket:
            return cpu_socket == mainboard_socket

        cpu_platform = OrchestratorAgent._extract_platform_from_text(cpu.name)
        mainboard_platform = OrchestratorAgent._extract_platform_from_text(mainboard.name)
        if cpu_platform and mainboard_platform and cpu_platform != mainboard_platform:
            return False

        return True

    @staticmethod
    def _extract_socket_from_product(product: ProductSuggestion) -> Optional[str]:
        name = product.name if isinstance(product.name, str) else ""
        return OrchestratorAgent._normalize_socket_value(name)

    @staticmethod
    def _extract_platform_from_text(value: object) -> Optional[str]:
        if not isinstance(value, str):
            return None

        text = OrchestratorAgent._normalize_for_matching(value).upper()
        if not text:
            return None

        amd_markers = [
            "AMD",
            "RYZEN",
            "ATHLON",
            "THREADRIPPER",
            "AM4",
            "AM5",
            "A320",
            "A520",
            "B350",
            "B450",
            "B550",
            "B650",
            "X370",
            "X470",
            "X570",
            "X670",
        ]
        intel_markers = [
            "INTEL",
            "PENTIUM",
            "CELERON",
            "LGA1200",
            "LGA1700",
            "H610",
            "B660",
            "B760",
            "Z690",
            "Z790",
        ]

        if any(marker in text for marker in amd_markers):
            return "AMD"
        if any(marker in text for marker in intel_markers):
            return "INTEL"

        if re.search(r"\bI[3579]-\d{3,5}\b", text):
            return "INTEL"
        return None

    @staticmethod
    def _quality_score_for_slot(product: ProductSuggestion, slot: str) -> float:
        slot_key = (slot or "").upper()
        name = product.name if isinstance(product.name, str) else ""

        if slot_key == "RAM":
            return OrchestratorAgent._extract_ram_capacity_gb_from_text(name) or 0.0
        if slot_key == "SSD":
            return OrchestratorAgent._extract_storage_capacity_gb_from_text(name) or 0.0
        if slot_key == "PSU":
            return OrchestratorAgent._extract_psu_watt_from_text(name) or 0.0

        return OrchestratorAgent._to_number(product.price) or 0.0

    @staticmethod
    def _extract_ram_capacity_gb_from_text(value: str) -> Optional[float]:
        if not isinstance(value, str) or not value.strip():
            return None

        matches = re.findall(r"(\d+(?:[\.,]\d+)?)\s*GB\b", value.upper())
        if not matches:
            return None

        capacities: List[float] = []
        for number_text in matches:
            normalized_number = number_text.replace(",", ".")
            try:
                numeric_value = float(normalized_number)
            except ValueError:
                continue
            capacities.append(numeric_value)

        if not capacities:
            return None
        return max(capacities)

    @staticmethod
    def _extract_psu_watt_from_text(value: str) -> Optional[float]:
        if not isinstance(value, str) or not value.strip():
            return None

        matches = re.findall(r"(\d{3,4})\s*W\b", value.upper())
        if not matches:
            return None

        watts: List[float] = []
        for number_text in matches:
            try:
                watts.append(float(number_text))
            except ValueError:
                continue

        if not watts:
            return None
        return max(watts)

    @staticmethod
    def _group_alternatives_by_slot(
        products: List[ProductSuggestion],
        primary_build: List[ProductSuggestion],
    ) -> Dict[str, List[ProductSuggestion]]:
        primary_ids = {item.product_id for item in primary_build}
        grouped: Dict[str, List[ProductSuggestion]] = {}
        for item in products:
            if item.product_id in primary_ids:
                continue
            slot = (item.slot or "").upper()
            if not slot:
                continue
            grouped.setdefault(slot, []).append(item)
        return grouped

    @staticmethod
    def _sum_product_prices(products: List[ProductSuggestion]) -> int:
        total = 0.0
        for item in products:
            numeric = OrchestratorAgent._to_number(item.price)
            if numeric is None or numeric <= 0:
                continue
            total += numeric
        return int(total)

    @staticmethod
    def _estimate_budget_status(
        total: Optional[int],
        constraints: Dict[str, Optional[float]],
    ) -> Optional[str]:
        if total is None or total <= 0:
            return None

        budget_max = constraints.get("budget_max")
        budget_min = constraints.get("budget_min")

        if isinstance(budget_max, (int, float)) and total > budget_max:
            return "over_budget"

        if isinstance(budget_min, (int, float)) and total < budget_min:
            return "under_budget"

        if isinstance(budget_max, (int, float)) and budget_max > 0 and total >= budget_max * 0.9:
            return "near_budget"

        if isinstance(budget_max, (int, float)):
            return "within_budget"

        return None

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
        enforce_budget_floor = OrchestratorAgent._should_enforce_budget_floor(context, query, budget_constraints)
        # Keep slot diversity first, then append additional options for the same remaining slots.
        allow_duplicate_fill = True
        cpu_socket = (compatibility or {}).get("cpu_socket")
        mainboard_socket = (compatibility or {}).get("mainboard_socket")
        cpu_platform = (compatibility or {}).get("cpu_platform")
        mainboard_platform = (compatibility or {}).get("mainboard_platform")
        has_constraints = bool(cpu_socket or mainboard_socket or cpu_platform or mainboard_platform)
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

            if not OrchestratorAgent._meets_capacity_requirements(
                slot=suggestion_slot,
                name=name,
                constraints=budget_constraints,
                raw=raw,
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
                cpu_platform=cpu_platform,
                mainboard_platform=mainboard_platform,
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
            candidates = OrchestratorAgent._prefer_office_igpu_cpu(candidates, cpu_igpu_by_product)

        strict_budgeted = [
            item
            for item in candidates
            if OrchestratorAgent._is_within_budget_constraints(
                price=OrchestratorAgent._to_number(item.price),
                slot=item.slot,
                constraints=budget_constraints,
                enforce_slot_caps=True,
            )
            and OrchestratorAgent._meets_budget_floor(
                price=OrchestratorAgent._to_number(item.price),
                slot=item.slot,
                constraints=budget_constraints,
                enforce_budget_floor=enforce_budget_floor,
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
            and OrchestratorAgent._meets_budget_floor(
                price=OrchestratorAgent._to_number(item.price),
                slot=item.slot,
                constraints=budget_constraints,
                enforce_budget_floor=enforce_budget_floor,
            )
        ]

        if office_mode and not explicit_gpu_request:
            relaxed_budgeted = OrchestratorAgent._prefer_office_igpu_cpu(relaxed_budgeted, cpu_igpu_by_product)

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

        fallback_query = "goi y linh kien CPU MAINBOARD RAM SSD PSU CASE COOLER can bang ngan sach"
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
        enforce_budget_floor = self._should_enforce_budget_floor(context, query, constraints)
        selected_brand = self._extract_selected_brand(context)
        selected_slots = self._extract_selected_slots(context)
        base_slot_order = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "GPU", "CASE", "COOLER"]
        if office_mode and not explicit_gpu_request:
            base_slot_order = [slot for slot in base_slot_order if slot != "GPU"]
        slot_order = [slot for slot in base_slot_order if slot not in selected_slots]
        if not slot_order:
            slot_order = base_slot_order
        max_per_item_ratio = 0.5 if low_budget else 0.7

        per_slot_fetch = max(MAX_PRODUCTS_PER_SLOT, 6) if enforce_budget_floor else MAX_PRODUCTS_PER_SLOT

        docs = self.db_agent.mongo_service.get_budget_products_by_slots(
            slot_order=slot_order,
            budget_max=float(effective_budget),
            total_limit=max(MAX_PRODUCT_SUGGESTIONS, len(slot_order) * per_slot_fetch),
            per_slot_limit=per_slot_fetch,
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

            if not OrchestratorAgent._meets_capacity_requirements(
                slot=slot,
                name=name,
                constraints=constraints,
                raw=doc,
            ):
                continue

            numeric_price = OrchestratorAgent._to_number(doc.get("price"))
            if numeric_price is None or numeric_price <= 0:
                continue
            if not OrchestratorAgent._meets_budget_floor(
                price=numeric_price,
                slot=slot,
                constraints=constraints,
                enforce_budget_floor=enforce_budget_floor,
            ):
                continue
            if enforce_budget_floor and not OrchestratorAgent._is_within_slot_target_cap(
                price=numeric_price,
                slot=slot,
                constraints=constraints,
            ):
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
            shortlist = OrchestratorAgent._prefer_office_igpu_cpu(shortlist, cpu_igpu_by_product)

        shortlist = self._supplement_capacity_required_slots(
            shortlist=shortlist,
            constraints=constraints,
            effective_budget=float(effective_budget),
            selected_brand=selected_brand,
        )

        if enforce_budget_floor:
            shortlist = self._prioritize_shortlist_for_budget_floor(shortlist, constraints, slot_order)

        ranked = OrchestratorAgent._rank_suggestions(
            shortlist,
            low_budget_mode=low_budget,
            has_core_selected=any(slot in CORE_BUILD_SLOTS for slot in selected_slots),
            allow_duplicate_fill=True,
            office_mode=office_mode,
            cpu_igpu_by_product=cpu_igpu_by_product,
        )

        max_per_slot = MAX_PRODUCTS_PER_SLOT
        if enforce_budget_floor:
            max_per_slot = max(MAX_PRODUCTS_PER_SLOT, 3)

        return OrchestratorAgent._limit_products_per_slot(ranked, max_per_slot)[:MAX_PRODUCT_SUGGESTIONS]

    def _supplement_capacity_required_slots(
        self,
        shortlist: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        effective_budget: float,
        selected_brand: Optional[str],
    ) -> List[ProductSuggestion]:
        if effective_budget <= 0:
            return shortlist

        by_slot = {(item.slot or "").upper() for item in shortlist if item.slot}
        required_slots = ["RAM", "SSD"]
        missing_slots = [slot for slot in required_slots if slot not in by_slot]
        if not missing_slots:
            return shortlist

        existing_ids = {item.product_id for item in shortlist}
        supplemented = list(shortlist)

        for slot in missing_slots:
            target_price = None
            if slot == "RAM":
                target_price = max(500_000.0, effective_budget * 0.08)
            if slot == "SSD":
                target_price = max(1_000_000.0, effective_budget * 0.10)

            docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                slot=slot,
                budget_max=effective_budget,
                target_price=target_price,
                limit=24,
                selected_brand=selected_brand,
            )

            for doc in docs:
                category_id = OrchestratorAgent._normalize_category_id(doc.get("categoryId"))
                name = OrchestratorAgent._sanitize_text(doc.get("name", ""))
                normalized_slot = OrchestratorAgent._infer_slot(
                    category_id=category_id,
                    category_code=doc.get("categoryCode"),
                    name=name,
                )
                if (normalized_slot or "").upper() != slot:
                    continue

                if not OrchestratorAgent._matches_brand_constraint(
                    selected_brand=selected_brand,
                    slot=normalized_slot,
                    raw=doc,
                    name=name,
                ):
                    continue

                if not OrchestratorAgent._meets_capacity_requirements(
                    slot=normalized_slot,
                    name=name,
                    constraints=constraints,
                    raw=doc,
                ):
                    continue

                numeric_price = OrchestratorAgent._to_number(doc.get("price"))
                if numeric_price is None or numeric_price <= 0:
                    continue
                if not OrchestratorAgent._is_within_budget_constraints(
                    price=numeric_price,
                    slot=normalized_slot,
                    constraints=constraints,
                    enforce_slot_caps=False,
                ):
                    continue

                product_id = str(doc.get("_id", ""))
                if not product_id or product_id in existing_ids:
                    continue

                supplemented.append(
                    ProductSuggestion(
                        productId=product_id,
                        categoryId=category_id,
                        slot=normalized_slot,
                        name=name,
                        price=int(numeric_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        reason="Bo sung theo nguong dung luong toi thieu",
                    )
                )
                existing_ids.add(product_id)
                break

        return supplemented

    @staticmethod
    def _prioritize_shortlist_for_budget_floor(
        shortlist: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        slot_order: List[str],
    ) -> List[ProductSuggestion]:
        budget_min = constraints.get("budget_min")
        target_min = constraints.get("target_min")
        target_base = target_min if isinstance(target_min, (int, float)) and target_min > 0 else budget_min
        if not isinstance(target_base, (int, float)) or target_base <= 0:
            return shortlist

        grouped: Dict[str, List[ProductSuggestion]] = {}
        for item in shortlist:
            slot = (item.slot or "").upper()
            if not slot:
                continue
            grouped.setdefault(slot, []).append(item)

        prioritized: List[ProductSuggestion] = []
        for slot in slot_order:
            candidates = grouped.pop(slot.upper(), [])
            if not candidates:
                continue

            target_price = target_base * OrchestratorAgent._target_ratio_for_slot(constraints, slot.upper())
            candidates.sort(
                key=lambda item: (
                    abs((OrchestratorAgent._to_number(item.price) or 0.0) - target_price),
                    -(OrchestratorAgent._to_number(item.price) or 0.0),
                )
            )
            prioritized.extend(candidates)

        for remaining in grouped.values():
            prioritized.extend(remaining)

        return prioritized

    @staticmethod
    def _target_ratio_for_slot(constraints: Dict[str, Optional[float]], slot: str) -> float:
        target_min = constraints.get("target_min")
        target_max = constraints.get("target_max")
        is_10_15_target = (
            isinstance(target_min, (int, float))
            and isinstance(target_max, (int, float))
            and abs(target_min - 12_000_000.0) < 1
            and abs(target_max - 13_000_000.0) < 1
        )
        if is_10_15_target:
            return MIDRANGE_10_15_TARGET_RATIO.get(slot, 0.08)
        return PRIMARY_BUILD_TARGET_RATIO.get(slot, 0.08)

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
        cpu_socket = compatibility.get("cpu_socket")
        mainboard_socket = compatibility.get("mainboard_socket")
        cpu_platform = compatibility.get("cpu_platform")
        mainboard_platform = compatibility.get("mainboard_platform")

        docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot=slot,
            budget_max=query_budget_max,
            target_price=target_price_for_query,
            limit=max(MAX_REPLACEMENT_SUGGESTIONS * 8, 24),
            exclude_product_ids=exclude_ids,
            selected_brand=selected_brand,
            preferred_socket=cpu_socket if slot.upper() == "MAINBOARD" else (mainboard_socket if slot.upper() == "CPU" else None),
            preferred_platform=cpu_platform if slot.upper() == "MAINBOARD" else (mainboard_platform if slot.upper() == "CPU" else None),
        )

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

                if not OrchestratorAgent._meets_capacity_requirements(
                    slot=suggestion_slot,
                    name=name,
                    constraints=constraints,
                    raw=doc,
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
                    cpu_platform=cpu_platform,
                    mainboard_platform=mainboard_platform,
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
                preferred_socket=cpu_socket if slot.upper() == "MAINBOARD" else (mainboard_socket if slot.upper() == "CPU" else None),
                preferred_platform=cpu_platform if slot.upper() == "MAINBOARD" else (mainboard_platform if slot.upper() == "CPU" else None),
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
    def _extract_direct_component_slot(query: str) -> Optional[str]:
        if not isinstance(query, str) or not query.strip():
            return None

        normalized = OrchestratorAgent._normalize_for_matching(query)
        if re.search(r"\b(build|cau hinh|bo pc|dan may|full\s*pc)\b", normalized):
            return None

        asked_component = any(
            token in normalized
            for token in (
                "goi y",
                "tu van",
                "tim",
                "chon",
                "main",
                "linh kien",
                "tuong thich",
            )
        )
        if not asked_component:
            return None

        matched_slots = []
        for slot, keywords in REPLACEMENT_SLOT_KEYWORDS.items():
            if any(keyword in normalized for keyword in keywords):
                matched_slots.append(slot)

        if len(matched_slots) == 1:
            return matched_slots[0]

        # Common phrasing: "goi y mainboard tuong thich voi cpu ..." should map to MAINBOARD.
        if "MAINBOARD" in matched_slots and "CPU" in matched_slots and "tuong thich" in normalized:
            if re.search(r"(goi y|tu van|tim|chon).{0,32}(mainboard|motherboard|bo mach chu|bo mach chinh)", normalized):
                return "MAINBOARD"

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
    def _extract_ram_capacity_gb(raw: Dict[str, Any], name: str) -> Optional[float]:
        capacities: List[float] = []

        name_capacity = OrchestratorAgent._extract_ram_capacity_gb_from_text(name)
        if name_capacity is not None:
            capacities.append(name_capacity)

        specs = raw.get("specs_raw") or raw.get("specsRaw")
        if isinstance(specs, dict):
            for key in ("Dung luong", "Dung lượng", "Capacity", "capacity"):
                value = specs.get(key)
                if isinstance(value, str):
                    parsed = OrchestratorAgent._extract_ram_capacity_gb_from_text(value)
                    if parsed is not None:
                        capacities.append(parsed)

        if not capacities:
            return None
        return max(capacities)

    @staticmethod
    def _required_ram_min_gb(constraints: Dict[str, Optional[float]]) -> float:
        budget_min = constraints.get("budget_min")
        budget_max = constraints.get("budget_max")

        if isinstance(budget_min, (int, float)) and budget_min >= 15_000_000:
            return 16.0
        if isinstance(budget_max, (int, float)) and budget_max > 15_000_000:
            return 16.0
        return 8.0

    @staticmethod
    def _meets_capacity_requirements(
        slot: Optional[str],
        name: str,
        constraints: Dict[str, Optional[float]],
        raw: Optional[Dict[str, Any]] = None,
    ) -> bool:
        slot_key = (slot or "").upper()
        source = raw if isinstance(raw, dict) else {}

        if slot_key == "SSD":
            capacity = OrchestratorAgent._extract_storage_capacity_gb(source, name)
            if capacity is None:
                return False
            return capacity > 500.0

        if slot_key == "RAM":
            capacity = OrchestratorAgent._extract_ram_capacity_gb(source, name)
            if capacity is None:
                return False
            return capacity >= OrchestratorAgent._required_ram_min_gb(constraints)

        return True

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

    def _ensure_diverse_build_products(
        self,
        products: List[ProductSuggestion],
        context: Dict[str, object],
        query: str,
    ) -> List[ProductSuggestion]:
        if not products:
            return products

        if self._is_component_specific_query(query):
            return products

        budget_constraints = self._extract_budget_constraints(context)
        if budget_constraints.get("budget_max") is None:
            return products

        current_slots = {(item.slot or "").upper() for item in products if item.slot}
        if len(current_slots) >= 3:
            return products

        shortlist = self._build_budget_shortlist_products(context, query)
        if not shortlist:
            return products

        merged: List[ProductSuggestion] = []
        seen_ids = set()
        for item in products:
            pid = item.product_id
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            merged.append(item)

        missing_core_slots = [slot for slot in CORE_BUILD_SLOTS if slot not in current_slots]
        for slot in missing_core_slots:
            candidate = next((item for item in shortlist if (item.slot or "").upper() == slot), None)
            if not candidate:
                continue
            if candidate.product_id in seen_ids:
                continue
            seen_ids.add(candidate.product_id)
            merged.append(candidate)

        for item in shortlist:
            if len(merged) >= MAX_PRODUCT_SUGGESTIONS:
                break
            if item.product_id in seen_ids:
                continue
            seen_ids.add(item.product_id)
            merged.append(item)

        ranked = OrchestratorAgent._rank_suggestions(
            merged,
            low_budget_mode=bool(budget_constraints.get("low_budget")),
            has_core_selected=any(slot in CORE_BUILD_SLOTS for slot in self._extract_selected_slots(context)),
            allow_duplicate_fill=True,
            office_mode=self._is_office_context(context),
        )
        return OrchestratorAgent._limit_products_per_slot(ranked, MAX_PRODUCTS_PER_SLOT)[:MAX_PRODUCT_SUGGESTIONS]

    @staticmethod
    def _is_component_specific_query(query: str) -> bool:
        if not isinstance(query, str) or not query.strip():
            return False

        normalized = OrchestratorAgent._normalize_for_matching(query)
        if re.search(r"\b(build|cau hinh|bo pc|dan may)\b", normalized):
            return False

        slot_patterns = {
            "CPU": r"\b(cpu|vi xu ly|bo vi xu ly|processor)\b",
            "MAINBOARD": r"\b(mainboard|motherboard|bo mach chu|bo mach chinh)\b",
            "GPU": r"\b(gpu|vga|card man hinh|graphics card)\b",
            "RAM": r"\b(ram|bo nho)\b",
            "SSD": r"\b(ssd|o cung)\b",
            "PSU": r"\b(psu|nguon)\b",
            "CASE": r"\b(case|vo may|thung may)\b",
            "COOLER": r"\b(cooler|tan nhiet|quat)\b",
        }
        mentioned = sum(1 for pattern in slot_patterns.values() if re.search(pattern, normalized))
        return mentioned == 1

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
            # Office mode defaults to Intel when user has not pinned a brand.
            if OrchestratorAgent._is_office_context(context):
                return "INTEL"
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
            "INTEL": {"CPU", "MAINBOARD"},
            "AMD": {"CPU", "MAINBOARD"},
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

        if selected_brand == "INTEL" and normalized_slot == "MAINBOARD":
            intel_board_tokens = ("INTEL", "LGA", "H610", "H510", "B660", "B760", "Z690", "Z790")
            return any(any(token in text for token in intel_board_tokens) for text in normalized_candidates)

        if selected_brand == "AMD" and normalized_slot == "MAINBOARD":
            amd_board_tokens = ("AMD", "AM4", "AM5", "A620", "B450", "B550", "B650", "X570", "X670")
            return any(any(token in text for token in amd_board_tokens) for text in normalized_candidates)

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
        if "AMD" in normalized_name and any(token in normalized_name for token in ("RADEON", "VEGA", "GRAPHICS")):
            return True

        return False

    @staticmethod
    def _prefer_office_igpu_cpu(
        suggestions: List[ProductSuggestion],
        cpu_igpu_by_product: Dict[str, bool],
    ) -> List[ProductSuggestion]:
        if not suggestions:
            return suggestions

        igpu_cpu_ids = {
            item.product_id
            for item in suggestions
            if (item.slot or "").upper() == "CPU" and cpu_igpu_by_product.get(item.product_id, False)
        }
        if not igpu_cpu_ids:
            return suggestions

        filtered: List[ProductSuggestion] = []
        for item in suggestions:
            slot = (item.slot or "").upper()
            if slot != "CPU":
                filtered.append(item)
                continue
            if item.product_id in igpu_cpu_ids:
                filtered.append(item)
        return filtered

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
    def _build_under_budget_data_note(
        products: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
    ) -> Optional[str]:
        budget_min = constraints.get("budget_min")
        if not isinstance(budget_min, (int, float)) or budget_min <= 0:
            return None

        by_slot: Dict[str, List[ProductSuggestion]] = {}
        for item in products:
            slot = (item.slot or "").upper()
            if not slot:
                continue
            by_slot.setdefault(slot, []).append(item)

        if not by_slot:
            return None

        core_slots = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU"]
        representative: List[ProductSuggestion] = []
        for slot in core_slots:
            candidates = by_slot.get(slot, [])
            if not candidates:
                continue
            best = max(candidates, key=lambda item: OrchestratorAgent._to_number(item.price) or 0.0)
            representative.append(best)

        if not representative:
            return None

        representative_total = OrchestratorAgent._sum_product_prices(representative)
        if representative_total >= budget_min * 0.9:
            return None

        return (
            "Du lieu hien tai trong kho co ve nghieng ve phan khuc gia re cho mot so slot, "
            "nen tong cau hinh de xuat co the thap hon muc ngan sach mong muon."
        )

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
                "budget_min": None,
                "remaining_budget": None,
                "low_budget": False,
            }

        budget_max = OrchestratorAgent._extract_budget_max(context)
        budget_min = OrchestratorAgent._extract_budget_min(context)
        target_min, target_max = OrchestratorAgent._extract_budget_target_window(context, budget_min, budget_max)
        selected_total = OrchestratorAgent._sum_selected_component_price(context)
        remaining_budget = None
        if budget_max is not None:
            remaining_budget = max(0.0, budget_max - selected_total)

        low_budget = budget_max is not None and budget_max <= 10_000_000
        return {
            "budget_max": budget_max,
            "budget_min": budget_min,
            "target_min": target_min,
            "target_max": target_max,
            "remaining_budget": remaining_budget,
            "low_budget": low_budget,
            "office_mode": OrchestratorAgent._is_office_context(context),
            "office_overkill_mode": bool(
                OrchestratorAgent._is_office_context(context)
                and isinstance(budget_max, (int, float))
                and budget_max > OFFICE_OVERKILL_BUDGET_THRESHOLD
            ),
        }

    @staticmethod
    def _extract_budget_target_window(
        context: Dict[str, object],
        budget_min: Optional[float],
        budget_max: Optional[float],
    ) -> tuple[Optional[float], Optional[float]]:
        if not isinstance(budget_min, (int, float)) or not isinstance(budget_max, (int, float)):
            return (None, None)
        if budget_min <= 0 or budget_max <= 0 or budget_max <= budget_min:
            return (None, None)

        budget_text = context.get("budget") if isinstance(context.get("budget"), str) else ""
        normalized = OrchestratorAgent._normalize_for_matching(budget_text) if budget_text else ""

        # Explicit requirement: 10-15M should target around 12-13M.
        if (
            abs(budget_min - 10_000_000) < 1
            and abs(budget_max - 15_000_000) < 1
            or re.search(r"10\s*(-|den|toi|~)\s*15", normalized)
        ):
            return (12_000_000.0, 13_000_000.0)

        span = budget_max - budget_min
        return (budget_min + span * 0.45, budget_min + span * 0.75)

    @staticmethod
    def _extract_budget_min(context: Dict[str, object]) -> Optional[float]:
        for key in ("budgetMin", "budget_min"):
            numeric = OrchestratorAgent._to_number(context.get(key))
            if numeric is not None and numeric > 0:
                return numeric

        budget_text = context.get("budget")
        if not isinstance(budget_text, str) or not budget_text.strip():
            return None

        normalized = OrchestratorAgent._normalize_for_matching(budget_text)

        if re.search(r"10\s*(-|den|toi|~)\s*15", normalized):
            return 10_000_000
        if re.search(r"15\s*(-|den|toi|~)\s*20", normalized):
            return 15_000_000
        if re.search(r"20\s*(-|den|toi|~)\s*30", normalized):
            return 20_000_000
        if re.search(r"30\s*(-|den|toi|~)\s*40", normalized):
            return 30_000_000
        if re.search(r"(tren|tu|hon)\s*30", normalized) or re.search(r">\s*30", normalized):
            return 30_000_000

        return None

    @staticmethod
    def _should_enforce_budget_floor(
        context: Optional[Dict[str, object]],
        query: Optional[str],
        constraints: Dict[str, Optional[float]],
    ) -> bool:
        budget_min = constraints.get("budget_min")
        if not isinstance(budget_min, (int, float)) or budget_min <= 0:
            return False

        if OrchestratorAgent._is_component_specific_query(query or ""):
            return False

        if isinstance(context, dict):
            selected = context.get("selectedComponents")
            if isinstance(selected, list) and selected:
                return False

        return True

    @staticmethod
    def _meets_budget_floor(
        price: Optional[float],
        slot: Optional[str],
        constraints: Dict[str, Optional[float]],
        enforce_budget_floor: bool,
    ) -> bool:
        if not enforce_budget_floor:
            return True
        if price is None or price <= 0:
            return False

        slot_key = (slot or "").upper()
        if slot_key in ACCESSORY_SLOTS:
            return True

        budget_min = constraints.get("budget_min")
        if not isinstance(budget_min, (int, float)) or budget_min <= 0:
            return True

        ratio = BUDGET_MIN_FLOOR_RATIO.get(slot_key)
        if ratio is None:
            return True
        return price >= (budget_min * ratio)

    @staticmethod
    def _is_within_slot_target_cap(
        price: Optional[float],
        slot: Optional[str],
        constraints: Dict[str, Optional[float]],
    ) -> bool:
        if price is None or price <= 0:
            return False

        slot_key = (slot or "").upper()
        ratio = SLOT_HARD_CAP_RATIO.get(slot_key)
        if ratio is None:
            return True

        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return True

        return price <= (budget_max * ratio)

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
        if re.search(r"30\s*(-|den|toi|~)\s*40", normalized):
            return 40_000_000
        if re.search(r"(tren|tu|hon)\s*30", normalized) or re.search(r">\s*30", normalized):
            return 40_000_000

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

        if bool(constraints.get("office_overkill_mode")) and budget_max is not None and slot:
            overkill_ratio = OFFICE_OVERKILL_SLOT_CAP_RATIO.get(slot.upper())
            if overkill_ratio is not None and price > (budget_max * overkill_ratio):
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
            normalized_code = category_code.strip().upper().replace("-", "").replace("_", "").replace(" ", "")
            category_aliases = {
                "MAINBOARD": "MAINBOARD",
                "MAINBBOARD": "MAINBOARD",
                "MOTHERBOARD": "MAINBOARD",
                "CPU": "CPU",
                "GPU": "GPU",
                "VGA": "GPU",
                "RAM": "RAM",
                "SSD": "SSD",
                "HDD": "SSD",
                "HARDDISK": "SSD",
                "HARDDISK": "SSD",
                "PSU": "PSU",
                "CASE": "CASE",
                "COOLER": "COOLER",
            }
            mapped = category_aliases.get(normalized_code)
            if mapped:
                return mapped

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
        cpu_platform = None
        mainboard_platform = None
        notes: List[str] = []

        for doc in selected_products:
            slot = str(doc.get("_selected_slot", "")).upper()
            socket_value = self._extract_socket_from_raw(doc)
            if slot == "CPU" and socket_value:
                cpu_socket = socket_value
            if slot == "MAINBOARD" and socket_value:
                mainboard_socket = socket_value
            platform_value = self._extract_platform_from_raw(doc)
            if slot == "CPU" and platform_value:
                cpu_platform = platform_value
            if slot == "MAINBOARD" and platform_value:
                mainboard_platform = platform_value

        if cpu_socket:
            notes.append(f"Chi goi y MAINBOARD tuong thich socket CPU {cpu_socket}.")
        if mainboard_socket:
            notes.append(f"Chi goi y CPU tuong thich socket MAINBOARD {mainboard_socket}.")
        if cpu_platform and not cpu_socket:
            notes.append(f"Chi goi y MAINBOARD cung nen tang {cpu_platform} voi CPU da chon.")
        if mainboard_platform and not mainboard_socket:
            notes.append(f"Chi goi y CPU cung nen tang {mainboard_platform} voi MAINBOARD da chon.")

        return {
            "cpu_socket": cpu_socket,
            "mainboard_socket": mainboard_socket,
            "cpu_platform": cpu_platform,
            "mainboard_platform": mainboard_platform,
            "notes": notes,
        }

    @staticmethod
    def _is_socket_compatible(
        slot: Optional[str],
        raw: Dict[str, Any],
        cpu_socket: Optional[str],
        mainboard_socket: Optional[str],
        cpu_platform: Optional[str] = None,
        mainboard_platform: Optional[str] = None,
    ) -> bool:
        if not slot:
            return True

        normalized_slot = slot.upper()
        candidate_socket = OrchestratorAgent._extract_socket_from_raw(raw)

        if normalized_slot == "MAINBOARD" and cpu_socket:
            if candidate_socket and candidate_socket != cpu_socket:
                return False
        if normalized_slot == "MAINBOARD" and cpu_platform:
            candidate_platform = OrchestratorAgent._extract_platform_from_raw(raw)
            if candidate_platform and candidate_platform != cpu_platform:
                return False

        if normalized_slot == "CPU" and mainboard_socket:
            if candidate_socket and candidate_socket != mainboard_socket:
                return False
        if normalized_slot == "CPU" and mainboard_platform:
            candidate_platform = OrchestratorAgent._extract_platform_from_raw(raw)
            if candidate_platform and candidate_platform != mainboard_platform:
                return False

        return True

    @staticmethod
    def _extract_platform_from_raw(raw: Dict[str, Any]) -> Optional[str]:
        candidates: List[str] = []
        for key in ("brand", "model", "name", "categoryCode"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value)

        specs = raw.get("specs_raw") or raw.get("specsRaw")
        if isinstance(specs, dict):
            for value in specs.values():
                if isinstance(value, str) and value.strip():
                    candidates.append(value)

        for value in candidates:
            platform = OrchestratorAgent._extract_platform_from_text(value)
            if platform:
                return platform
        return None

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

    @staticmethod
    def _sanitize_answer_text(value: object) -> str:
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

        normalized_lines: List[str] = []
        for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
            normalized_lines.append(" ".join(line.split()))

        compacted: List[str] = []
        previous_blank = False
        for line in normalized_lines:
            is_blank = not line
            if is_blank and previous_blank:
                continue
            compacted.append(line)
            previous_blank = is_blank

        return "\n".join(compacted).strip()
