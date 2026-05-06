import html
import logging
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional

from app.agents.contracts import AgentTask, RetrievedEvidence
from app.agents.db_retrieval_agent import DBRetrievalAgent
from app.agents.web_retrieval_agent import WebRetrievalAgent
from app.schemas.chat import AgentActionTrace, ChatContext, ChatResponse, ChatTrace, Citation, ProductSuggestion
from app.services.llm_gateway import LLMGateway
from app.services.smolagent_adapter import SmolAgentAdapter
from app.services.compatibility_checker import validate_build

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

CORE_BUILD_SLOTS = {"CPU", "MAINBOARD", "RAM", "SSD", "PSU", "GPU"}
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
GAMING_SLOT_PRIORITY = {
    "GPU": 0,
    "CPU": 1,
    "MAINBOARD": 2,
    "RAM": 3,
    "SSD": 4,
    "PSU": 5,
    "CASE": 6,
    "COOLER": 7,
}
LOW_BUDGET_SLOT_CAP_RATIO = {
    "CPU": 0.32,
    "MAINBOARD": 0.16,
    "RAM": 0.12,
    "SSD": 0.12,
    "PSU": 0.08,
    "CASE": 0.06,
    "COOLER": 0.04,
    "GPU": 0.45,
}
LOW_BUDGET_RELAXED_SLOT_CAP_RATIO = {
    "CPU": 0.40,
    "MAINBOARD": 0.22,
    "RAM": 0.15,
    "SSD": 0.15,
    "PSU": 0.12,
    "CASE": 0.08,
    "COOLER": 0.06,
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
GAMING_SLOT_CAP_RATIO = {
    "CPU": 0.28,
    "MAINBOARD": 0.15,
    "RAM": 0.08,
    "SSD": 0.08,
    "PSU": 0.08,
    "CASE": 0.05,
    "COOLER": 0.04,
    "GPU": 0.55,
}
GAMING_RELAXED_SLOT_CAP_RATIO = {
    "CPU": 0.35,
    "MAINBOARD": 0.22,
    "RAM": 0.12,
    "SSD": 0.12,
    "PSU": 0.10,
    "CASE": 0.08,
    "COOLER": 0.06,
    "GPU": 0.58,
}
PRIMARY_BUILD_TARGET_RATIO = {
    "CPU": 0.25,
    "MAINBOARD": 0.14,
    "RAM": 0.08,
    "SSD": 0.08,
    "PSU": 0.08,
    "CASE": 0.05,
    "COOLER": 0.04,
    "GPU": 0.55,
}
HIGH_BUDGET_GAMING_TARGET_RATIO = {
    "CPU": 0.30,
    "MAINBOARD": 0.16,
    "RAM": 0.08,
    "SSD": 0.08,
    "PSU": 0.07,
    "CASE": 0.05,
    "COOLER": 0.03,
    "GPU": 0.50,
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
    "CPU": 0.40,
    "MAINBOARD": 0.22,
    "RAM": 0.15,
    "SSD": 0.15,
    "PSU": 0.12,
    "CASE": 0.10,
    "COOLER": 0.08,
    "GPU": 0.55,
}
DEFAULT_SLOT_CAP_RATIO = SLOT_HARD_CAP_RATIO
DEFAULT_RELAXED_SLOT_CAP_RATIO = {
    "CPU": 0.50,
    "MAINBOARD": 0.28,
    "RAM": 0.20,
    "SSD": 0.20,
    "PSU": 0.15,
    "CASE": 0.12,
    "COOLER": 0.10,
    "GPU": 0.65,
}
OFFICE_SLOT_HARD_CAP_RATIO = {
    "CPU": 0.35,
    "MAINBOARD": 0.18,
    "RAM": 0.12,
    "SSD": 0.12,
    "PSU": 0.10,
    "CASE": 0.06,
    "COOLER": 0.04,
    "GPU": 0.20,
}
DESIGN_SLOT_CAP_RATIO = {
    "CPU": 0.28,
    "MAINBOARD": 0.12,
    "RAM": 0.15,
    "SSD": 0.10,
    "PSU": 0.08,
    "CASE": 0.05,
    "COOLER": 0.05,
    "GPU": 0.35,
}
DESIGN_RELAXED_SLOT_CAP_RATIO = {
    "CPU": 0.35,
    "MAINBOARD": 0.18,
    "RAM": 0.18,
    "SSD": 0.15,
    "PSU": 0.10,
    "CASE": 0.08,
    "COOLER": 0.06,
    "GPU": 0.45,
}
STREAMING_SLOT_CAP_RATIO = {
    "CPU": 0.32,
    "MAINBOARD": 0.12,
    "RAM": 0.15,
    "SSD": 0.08,
    "PSU": 0.08,
    "CASE": 0.05,
    "COOLER": 0.05,
    "GPU": 0.28,
}
STREAMING_RELAXED_SLOT_CAP_RATIO = {
    "CPU": 0.38,
    "MAINBOARD": 0.18,
    "RAM": 0.18,
    "SSD": 0.12,
    "PSU": 0.10,
    "CASE": 0.08,
    "COOLER": 0.06,
    "GPU": 0.35,
}
MAX_PRODUCT_SUGGESTIONS = 36
MAX_PRODUCTS_PER_SLOT = 6
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
DESIGN_PURPOSE_KEYWORDS = (
    "design",
    "do hoa",
    "thiet ke",
    "photoshop",
    "illustrator",
    "lightroom",
    "coreldraw",
    "ai",
    "ps",
    "pr",
    "premiere",
    "after effects",
    "blender",
    "3d",
    "render",
    "video",
    "edit video",
    "dung phim",
)
STREAMING_PURPOSE_KEYWORDS = (
    "stream",
    "streaming",
    "live stream",
    "phat song",
    "obs",
    "content creator",
    "youtuber",
    "record",
    "quay phim",
    "game streaming",
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
    (16_000_000.0, 1.50),  # 16M budget: allow MB up to 1.5x CPU
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

    def _create_react_tools(self, result_state):
        """Create tool functions for smolagents CodeAgent."""
        from smolagents import tool

        @tool
        def search_products(query: str, max_budget: float = 100_000_000, purpose: str = "gaming") -> str:
            """
            Search for PC components.
            
            Args:
                query: Search query describing the component type or need.
                max_budget: Maximum price in VND.
                purpose: Usage purpose (gaming, office, design, streaming).
            """
            import json
            results = []
            for slot in ("CPU", "GPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER"):
                try:
                    docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                        slot=slot, budget_max=float(max_budget), target_price=max_budget * 0.3, limit=5,
                    )
                    for d in docs[:3]:
                        results.append({"slot": slot, "name": OrchestratorAgent._sanitize_text(d.get("name", "")),
                                        "price": OrchestratorAgent._to_number(d.get("price")) or 0})
                except Exception:
                    pass
            return json.dumps(results[:30], ensure_ascii=False)

        @tool
        def build_pc(budget: float, purpose: str = "gaming", budget_min: float = 0.0) -> str:
            """
            Build a complete PC configuration.
            
            Args:
                budget: Maximum budget in VND (e.g. 16000000 for 16M).
                purpose: ONLY use one of: gaming, office, design, streaming.
                    - gaming: chơi game, FPS, esports, stream game
                    - design: đồ họa, render, video, 3D, blender, premiere, photoshop, thiết kế
                    - office: văn phòng, excel, word, học tập, duyệt web
                    - streaming: stream, content creator, youtuber, phát sóng, record
                budget_min: Minimum budget for range (optional, set to 0 for single budget).
            """
            import json, traceback
            try:
                logger.info(f"[BUILD_PC] raw budget={budget!r} purpose={purpose!r} budget_min={budget_min!r}")
                # ToolCallingAgent may pass args as JSON string or dict
                if isinstance(budget, str) and budget.startswith('{'):
                    try:
                        args = json.loads(budget)
                        budget = float(args.get('budget', budget))
                        purpose = str(args.get('purpose', purpose))
                        budget_min = float(args.get('budget_min', budget_min))
                    except json.JSONDecodeError:
                        budget = float(budget)
                else:
                    budget = float(budget)
                    budget_min = float(budget_min)
                
                # For range budgets: build toward the MIDDLE of the range
                if budget_min > 0 and budget_min < budget * 0.9:
                    effective_budget = int((budget_min + budget) / 2)  # Midpoint
                    ctx = {"budget": f"{int(effective_budget / 1_000_000)} trieu", "purpose": str(purpose)}
                else:
                    effective_budget = int(budget)
                    ctx = {"budget": f"{int(effective_budget / 1_000_000)} trieu", "purpose": purpose}
                
                consts = OrchestratorAgent._extract_budget_constraints(ctx, f"Xay dung PC {purpose} {int(effective_budget)}")
                # Use proper context detection for mode flags (handles arbitrary purpose strings)
                temp_ctx = {"purpose": str(purpose)}
                for m in ("gaming_mode", "office_mode", "design_mode", "streaming_mode"):
                    mode_name = m.replace("_mode", "")
                    consts[m] = mode_name in str(purpose).lower()
                # Override with robust detection for cases like "3D rendering and video editing"
                if not any((consts.get("gaming_mode"), consts.get("design_mode"), consts.get("streaming_mode"), consts.get("office_mode"))):
                    consts["design_mode"] = OrchestratorAgent._is_design_context(temp_ctx, str(purpose))
                    consts["streaming_mode"] = OrchestratorAgent._is_streaming_context(temp_ctx, str(purpose))
                    consts["gaming_mode"] = OrchestratorAgent._is_gaming_context(temp_ctx, str(purpose))
                    consts["office_mode"] = OrchestratorAgent._is_office_context(temp_ctx, str(purpose))
                search_query = f"Xay dung PC {purpose} {int(effective_budget)}"
                db_obs = self.db_agent.run(AgentTask(query=search_query, context=ctx, max_results=24))
                evidences = db_obs.evidences if db_obs and hasattr(db_obs, 'evidences') else []
                products = self._build_product_suggestions(evidences, {}, ctx, search_query)
                primary = self._select_primary_build(products, consts)
                for fn in (self._ensure_required_primary_slots,
                           self._rebalance_mainboard_cpu_with_db,
                           self._rebalance_cpu_gpu_with_db, self._lift_primary_to_target):
                    primary = fn(primary, consts, ctx)
                primary = self._enforce_budget_cap(primary, consts, ctx, products)
                total = self._sum_product_prices(primary)
                prod_list = [{"slot": p.slot, "name": p.name, "price": p.price, "productId": p.product_id,
                              "image": p.image, "url": p.url}
                             for p in primary]
                result_state.append({"products": prod_list, "primary_build": prod_list, "total": total,
                                     "budgetExact": effective_budget,
                                     "context_update": {"budget": str(effective_budget), "purpose": purpose, "budgetExact": effective_budget}})
                return json.dumps({"message": f"BUILT PC {purpose} {effective_budget:,} VND. TOTAL: {total:,}. {len(prod_list)} parts."}, ensure_ascii=False)
            except Exception as e:
                import traceback
                traceback.print_exc()
                return json.dumps({"message": f"BUILD ERROR: {e}"})

        @tool
        def find_replacements(slot: str, budget: float, purpose: str = "gaming", current_build_json: str = "[]") -> str:
            """
            Find replacement components for a given slot.
            
            Args:
                slot: Component slot to replace (CPU, GPU, RAM, SSD, etc.).
                budget: Total budget in VND.
                purpose: Usage purpose (gaming, office, design, streaming).
                current_build_json: JSON string of current build components.
            """
            import json
            try:
                current_build = json.loads(current_build_json) if current_build_json else []
                ctx = {"budget": str(int(budget)), "purpose": purpose}
                if current_build:
                    ctx["selectedComponents"] = current_build
                replacements = self._build_replacement_slot_products(slot=slot, context=ctx, compatibility={})
                repl_list = [{"slot": p.slot, "name": p.name, "price": p.price, "productId": p.product_id}
                             for p in replacements]
                result_state.append({"products": repl_list,
                                     "context_update": {"budget": str(int(budget)), "purpose": purpose}})
                return json.dumps({"message": f"FOUND {len(repl_list)} replacements for {slot}."}, ensure_ascii=False)
            except Exception as e:
                return json.dumps({"message": f"REPLACE ERROR: {e}"})

        return [search_products, build_pc, find_replacements]

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
        timing_metrics_ms: Dict[str, int] = {
            "db_retrieval": 0,
            "web_retrieval": 0,
            "synthesis": 0,
            "postprocess": 0,
        }

        max_iters = max_iterations or self.default_max_iterations
        db_max_results = 36
        started_at = time.monotonic()

        # Early Exit for Greetings or compatibility questions
        is_greeting = self._is_greeting_intent(query)
        has_specific_component = bool(
            re.search(r'\b(core\s*i\d|ryzen\s*\d|i[3579]-\d{3,5}|r[579]\s*\d)\b', query, re.IGNORECASE)
        )
        is_compatibility_question = bool(
            re.search(r'(lắp\s*(được|với)|tương\s*thích|hợp\s*(với|không)|ghép\s*(được|cặp))', query, re.IGNORECASE)
        )

        if is_greeting:
            traces.append(
                AgentActionTrace(
                    agent="orchestrator",
                    action="intent_detection",
                    status="success",
                    observation="Greeting or missing info detected. Responding directly.",
                )
            )
            
            synthesis_started_at = time.monotonic()
            answer = self._sanitize_answer_text(
                self._synthesize_answer(
                    query=query,
                    context=context,
                    evidences=[],
                    compatibility_notes=[],
                )
            )
            timing_metrics_ms["synthesis"] = int((time.monotonic() - synthesis_started_at) * 1000)
            total_duration_ms = int((time.monotonic() - started_at) * 1000)
            
            return ChatResponse(
                answer=answer,
                confidence=0.5,
                products=[],
                primaryBuild=[],
                alternativesBySlot={},
                estimatedBuildTotal=0,
                budgetStatus=None,
                citations=[],
                trace=ChatTrace(iterations=0, actions=traces),
            )
        elif is_compatibility_question and has_specific_component:
            traces.append(
                AgentActionTrace(
                    agent="orchestrator",
                    action="intent_detection",
                    status="success",
                    observation="Compatibility question detected. Skipping build.",
                )
            )
            return ChatResponse(
                answer="Xin lỗi, tôi chưa thể kiểm tra tương thích chi tiết giữa các linh kiện cụ thể. Vui lòng tham khảo thông số kỹ thuật từ nhà sản xuất.",
                confidence=0.5,
                products=[],
                primaryBuild=[],
                alternativesBySlot={},
                estimatedBuildTotal=0,
                budgetStatus=None,
                citations=[],
                trace=ChatTrace(iterations=0, actions=traces),
            )

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

        # --- ReAct loop via smolagents (if enabled) ---
        budget_constants = OrchestratorAgent._extract_budget_constraints(context, query)
        if self.smolagent_adapter.enabled:
            try:
                result_state = []
                react_result = self.smolagent_adapter.run_react(
                    query=query, context=context,
                    tools=self._create_react_tools(result_state),
                    llm_gateway=self.llm_gateway,
                    result_state=result_state,
                )
                if react_result and (result_state or react_result.get("answer")):
                    tool_result = result_state[0] if result_state else {}
                    products_data = tool_result.get("products", tool_result.get("primary_build", []))
                    cu_data = tool_result.get("context_update") or {}
                    context_update = None
                    if cu_data:
                        context_update = ChatContext(
                            budget=cu_data.get("budget"), purpose=cu_data.get("purpose"),
                            budgetExact=int(cu_data.get("budgetExact")) if cu_data.get("budgetExact") else None,
                        )
                    primary = [ProductSuggestion(**p) if isinstance(p, dict) else p for p in products_data]
                    total = tool_result.get("total") or react_result.get("total") or self._sum_product_prices(primary)
                    budget_status_val = self._estimate_budget_status(total, budget_constants) if total else None
                    traces.append(AgentActionTrace(agent="orchestrator", action="smolagents_react",
                        status="success", observation=f"ReAct: {len(primary)} products, total={total}"))
                    return ChatResponse(answer=self._sanitize_answer_text(str(react_result.get("answer", ""))),
                        confidence=0.8, products=primary, primaryBuild=primary, alternativesBySlot={},
                        estimatedBuildTotal=total, budgetStatus=budget_status_val,
                        citations=[], contextUpdate=context_update,
                        trace=ChatTrace(iterations=1, actions=traces))
                else:
                    raise RuntimeError(f"CodeAgent failed. result_state empty, answer: {str(react_result.get('answer',''))[:100]}")
            except Exception as e:
                logger.exception(f"CodeAgent exception: {e}")
                raise RuntimeError(f"CodeAgent crashed: {e}")

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
            db_started_at = time.monotonic()
            db_obs = self.db_agent.run(AgentTask(query=query, context=context, max_results=db_max_results))
            timing_metrics_ms["db_retrieval"] += int((time.monotonic() - db_started_at) * 1000)
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

            web_started_at = time.monotonic()
            web_obs = self.web_agent.run(AgentTask(query=query, context=context, max_results=5))
            timing_metrics_ms["web_retrieval"] += int((time.monotonic() - web_started_at) * 1000)
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
        budget_constraints = OrchestratorAgent._extract_budget_constraints(context, query)
        is_gaming = self._is_gaming_context(context, query)
        budget_constraints["gaming_mode"] = is_gaming

        # --- Hardware compatibility checks (PSU, RAM, iGPU, M.2, form factor, cooler) ---
        hw_warnings = validate_build(selected_products)
        if hw_warnings:
            notes = compatibility.setdefault("notes", [])
            if isinstance(notes, list):
                notes.extend(hw_warnings)

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

            # For high budgets, supplement with cross-platform CPUs and mainboards
            bc_supp = OrchestratorAgent._extract_budget_constraints(context, query)
            supp_budget = bc_supp.get("budget_max")
            if isinstance(supp_budget, (int, float)) and supp_budget >= 15_000_000:
                existing_ids = {p.product_id for p in products}
                selected_brand = OrchestratorAgent._extract_selected_brand(context)
                supp_config = [
                    ("CPU", 0.30),
                    ("MAINBOARD", None),  # No target: get broadest range to include budget LGA1700 boards
                    ("GPU", 0.50),
                ]
                for supp_slot, supp_target_ratio in supp_config:
                    target_price = float(supp_budget) * supp_target_ratio if supp_target_ratio else None
                    supp_docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                        slot=supp_slot,
                        budget_max=float(supp_budget),
                        target_price=target_price,
                        limit=50,
                        exclude_product_ids=[],
                        selected_brand=selected_brand,
                    )
                    for doc in supp_docs:
                        doc_id = str(doc.get("_id", ""))
                        if not doc_id or doc_id in existing_ids:
                            continue
                        doc_name = OrchestratorAgent._sanitize_text(doc.get("name", ""))
                        doc_slot = OrchestratorAgent._infer_slot(
                            category_id=OrchestratorAgent._normalize_category_id(doc.get("categoryId")),
                            category_code=doc.get("categoryCode"),
                            name=doc_name,
                        )
                        if (doc_slot or "").upper() != supp_slot:
                            continue
                        doc_price = OrchestratorAgent._to_number(doc.get("price"))
                        if doc_price is None or doc_price <= 0:
                            continue
                        doc_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                        products.append(ProductSuggestion(
                            productId=doc_id,
                            categoryId=OrchestratorAgent._normalize_category_id(doc.get("categoryId")),
                            slot=doc_slot,
                            name=doc_name,
                            price=int(doc_price),
                            image=doc.get("image"),
                            url=doc.get("url"),
                            socket=doc_socket,
                            reason="Goi y tu danh sach mo rong",
                        ))
                        existing_ids.add(doc_id)

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

        # --- FINAL CLEANING: Strictly enforce budget constraints on EVERY product ---
        budget_constraints = OrchestratorAgent._extract_budget_constraints(context, query)
        budget_max = budget_constraints.get("budget_max")
        logger.info(f"[Orchestrator] Final cleaning. budget_max={budget_max}, initial products={len(products)}")

        # For replacement flows, use full budget instead of remaining
        if replacement_slot and isinstance(budget_max, (int, float)):
            budget_constraints["remaining_budget"] = float(budget_max)
            budget_constraints["budget_max"] = float(budget_max) * 2  # Double to avoid slot cap

        products = [
            p for p in products
            if self._is_within_budget_constraints(self._to_number(p.price), p.slot, budget_constraints, enforce_slot_caps=False)
        ]
        logger.info(f"[Orchestrator] After cleaning: {len(products)} products")
        
        # Ensure response_evidences only contains what's in the filtered products
        if products:
            response_evidences = self._evidences_from_products(products)
        else:
            # If nothing fits the budget, we MUST NOT talk about expensive parts
            response_evidences = []

        # --- PRIMARY BUILD SELECTION (Moved before synthesis) ---
        postprocess_started_at = time.monotonic()
        if replacement_slot:
            primary_build = list(products)
            response_products = list(products)
            estimated_build_total = self._sum_product_prices(primary_build)
            budget_status = self._estimate_budget_status(estimated_build_total, budget_constraints)
        else:
            # 1. Selection and Filling
            primary_build = self._select_primary_build(products, budget_constraints)
            primary_build = self._ensure_required_primary_slots(primary_build, budget_constraints, context)
            
            # 2. Rebalancing
            primary_build = self._rebalance_mainboard_cpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._rebalance_cpu_gpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._lift_primary_to_target(primary_build, budget_constraints, context)
            primary_build = self._rebalance_mainboard_cpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._rebalance_cpu_gpu_with_db(primary_build, budget_constraints, context)
            primary_build = self._ensure_required_primary_slots(primary_build, budget_constraints, context)
            primary_build = self._enforce_office_overkill_caps(primary_build, budget_constraints, context)
            
            # 2b. For gaming mode: ensure GPU is strong enough, upgrade if possible
            if is_gaming:
                primary_build = self._upgrade_gaming_gpu(primary_build, budget_constraints, context, products)
                # Re-check required slots after GPU upgrade (COOLER might have been skipped due to budget)
                primary_build = self._ensure_required_primary_slots(primary_build, budget_constraints, context)
            
            # 2c. For office mode: ensure CPU has igpu (integrated graphics)
            if bool(budget_constraints.get("office_mode")):
                primary_build = self._ensure_office_igpu(primary_build, budget_constraints, context)
            
            # 2d. Final compatibility check: ensure CPU-Mainboard are socket compatible
            primary_build = self._final_compatibility_check(primary_build, budget_constraints, context)
            
            # 2e. Final budget enforcement: downsize if over budget
            primary_build = self._enforce_budget_cap(primary_build, budget_constraints, context, products)
            
            # 3. Final sync
            response_products = self._merge_products_with_primary(products, primary_build)
            estimated_build_total = self._sum_product_prices(primary_build)
            budget_status = self._estimate_budget_status(estimated_build_total, budget_constraints)
            
            # Update evidence for synthesis to be based on the final selections
            response_evidences = self._evidences_from_products(response_products)
        
        alternatives_by_slot = self._group_alternatives_by_slot(response_products, primary_build)
        timing_metrics_ms["postprocess"] = int((time.monotonic() - postprocess_started_at) * 1000)

        # --- SYNTHESIS (Now uses the finalized build) ---
        synthesis_started_at = time.monotonic()
        if replacement_slot and not products:
            answer = self._sanitize_answer_text(
                f"Toi chua tim duoc {replacement_slot} thay the phu hop trong ngan sach hien tai. "
                "Ban co the mo rong ngan sach hoac noii rong yeu cau de toi goi y them."
            )
        else:
            # Use ONLY primary_build for synthesis - no alternatives allowed
            answer = self._sanitize_answer_text(
                self._synthesize_answer(
                    query=query,
                    context=context,
                    evidences=response_evidences,
                    compatibility_notes=compatibility.get("notes", []),
                    filtered_products=primary_build,  # CRITICAL: Only use primary build, no alternatives
                )
            )
        timing_metrics_ms["synthesis"] = int((time.monotonic() - synthesis_started_at) * 1000)

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

        total_duration_ms = int((time.monotonic() - started_at) * 1000)
        traces.append(
            AgentActionTrace(
                agent="orchestrator",
                action="timing_profile",
                status="success",
                observation=(
                    f"db_retrieval_ms={timing_metrics_ms['db_retrieval']}; "
                    f"web_retrieval_ms={timing_metrics_ms['web_retrieval']}; "
                    f"synthesis_ms={timing_metrics_ms['synthesis']}; "
                    f"postprocess_ms={timing_metrics_ms['postprocess']}; "
                    f"total_ms={total_duration_ms}"
                ),
            )
        )

        logger.info(
            "Handled query with %s iterations, %s evidences, timings(ms): db=%s web=%s synth=%s post=%s total=%s",
            iterations,
            len(evidences),
            timing_metrics_ms["db_retrieval"],
            timing_metrics_ms["web_retrieval"],
            timing_metrics_ms["synthesis"],
            timing_metrics_ms["postprocess"],
            total_duration_ms,
        )

        bc = budget_constraints
        detected_purpose = "gaming" if bc.get("gaming_mode") else (
            "streaming" if bc.get("streaming_mode") else (
                "design" if bc.get("design_mode") else (
                    "office" if bc.get("office_mode") else None)))
        context_update = ChatContext(
            budget=str(bc.get("budget_max")) if bc.get("budget_max") else None,
            purpose=detected_purpose,
            budget_exact=int(bc.get("budget_max")) if bc.get("budget_max") else None,
        )

        # Convert external store URLs to local product links
        for item in primary_build:
            if item.url and ("phongvu" in item.url.lower() or item.url.startswith("http")):
                item.url = f"/product/{item.product_id}"

        return ChatResponse(
            answer=answer,
            confidence=confidence,
            products=primary_build,  # Only primary build, no alternatives
            primaryBuild=primary_build,
            alternativesBySlot={},  # No alternatives - design change per user request
            estimatedBuildTotal=estimated_build_total,
            budgetStatus=budget_status,
            citations=citations,
            contextUpdate=context_update,
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
        filtered_products: Optional[List[ProductSuggestion]] = None,
    ) -> str:
        # Final safety filter: Ensure no ghost expensive products reach the LLM
        constraints = OrchestratorAgent._extract_budget_constraints(context, query)
        if filtered_products:
            filtered_products = [
                p for p in filtered_products
                if self._is_within_budget_constraints(self._to_number(p.price), p.slot, constraints, enforce_slot_caps=False)
            ]
        
        # If no evidence and no products, only proceed to LLM for greetings or clarification requests
        if not evidences and not filtered_products:
            if not self._is_greeting_intent(query) and not self._is_clarification_needed(query, context):
                return (
                    "Tôi chưa tìm thấy đủ thông tin linh kiện phù hợp để tư vấn chính xác. "
                    "Vui lòng cung cấp thêm ngân sách (ví dụ: 15 triệu) và nhu cầu (ví dụ: chơi game) để tôi hỗ trợ tốt nhất."
                )

        is_greeting = self._is_greeting_intent(query)
        is_clarification = self._is_clarification_needed(query, context)
        
        prompt_mode = self._resolve_prompt_mode(context)
        prompt_context: Dict[str, object] = self._compact_context_for_prompt(context) if prompt_mode == "compact" else (context if isinstance(context, dict) else {})

        if is_greeting or is_clarification:
            system_prompt = (
                "Bạn là trợ lý tư vấn PC thông minh và thân thiện. "
                "Người dùng đang chào hỏi hoặc yêu cầu tư vấn nhưng thiếu thông tin (ngân sách, nhu cầu). "
                "Hãy trả lời một cách tự nhiên, lịch sự bằng tiếng Việt có dấu. "
                "Nếu là chào hỏi, hãy chào lại và hỏi họ cần giúp gì. "
                "Nếu là yêu cầu build máy thiếu thông tin, hãy liệt kê các thông tin bạn cần (ngân sách, mục đích sử dụng, v.v.). "
                "Tuyệt đối KHÔNG dùng định dạng danh sách 1. 2. 3. của việc đề xuất linh kiện."
            )
            user_prompt = f"Truy vấn của người dùng: {query}\nNgữ cảnh: {prompt_context}"
            return self.llm_gateway.generate(system_prompt=system_prompt, user_prompt=user_prompt)

        evidence_limit = 6 if prompt_mode == "compact" else 10
        snippet_limit = 180 if prompt_mode == "compact" else 400
        evidence_text = "\n".join([
            (
                f"- [{ev.source}] {self._sanitize_text(ev.title)} | score={ev.score:.3f} | "
                f"snippet={self._truncate_text(self._sanitize_text(self._strip_html(ev.snippet)), snippet_limit)}"
            )
            for ev in evidences[:evidence_limit]
        ])

        filtered_text = ""
        if filtered_products:
            filtered_text = "\n".join([
                f"- {p.name} | Gia: {p.price} | Slot: {p.slot}"
                for p in filtered_products[:12]
            ])

        system_prompt = (
            "Bạn là trợ lý tư vấn linh kiện PC. "
            "CHỈ ĐƯỢC PHÉP đề xuất linh kiện từ DANH SÁCH LINH KIỆN HỢP LỆ được cung cấp. "
            "KHÔNG được đề xuất linh kiện vượt quá ngân sách hoặc không có trong danh sách. "
            "Trả lời ngắn gọn, sạch, dễ đọc bằng TIẾNG VIỆT CÓ DẤU. "
            "Bắt buộc dùng plain text, KHÔNG dùng markdown (**, *, #, - cho tiêu đề). "
        )
        user_prompt = (
            f"Truy vấn: {query}\n"
            f"Ngữ cảnh: {prompt_context}\n"
            f"Bằng chứng tham khảo:\n{evidence_text}\n"
            f"DANH SÁCH LINH KIỆN HỢP LỆ:\n{filtered_text}\n"
            "Lưu ý: CHỉ hiển thị danh sách linh kiện ĐƯỢC CHỌN (primary build), KHÔNG hiển thị danh sách thay thế.\n"
            "Hãy tổng hợp câu trả lời theo format sau:\n"
            "Tóm tắt: <1-2 câu ngắn>\n"
            "Đề xuất ưu tiên:\n"
            "1. <Tên sản phẩm 1>\n"
            "   Lý do: <1 câu>\n"
            "   Thông số chính: <tối đa 2 thông số>\n"
            "2. <Tên sản phẩm 2>\n"
            "   Lý do: <1 câu>\n"
            "   Thông số chính: <tối đa 2 thông số>\n"
            "Lưu ý: <nếu cần>\n"
            "Bắt buộc dùng tiếng Việt có dấu."
        )
        if compatibility_notes:
            notes_block = "\n".join([f"- {note}" for note in compatibility_notes])
            user_prompt += f"\nRang buoc tuong thich:\n{notes_block}"
        return self.llm_gateway.generate(system_prompt=system_prompt, user_prompt=user_prompt)

    @staticmethod
    def _resolve_prompt_mode(context: Dict[str, object]) -> str:
        if not isinstance(context, dict):
            return "compact"
        value = context.get("__promptMode")
        if not isinstance(value, str):
            return "compact"
        normalized = value.strip().lower()
        if normalized in {"compact", "full"}:
            return normalized
        return "compact"

    @staticmethod
    def _truncate_text(value: str, max_length: int) -> str:
        if not value or max_length <= 0:
            return ""
        if len(value) <= max_length:
            return value
        return value[: max_length - 3].rstrip() + "..."

    @staticmethod
    def _compact_context_for_prompt(context: Dict[str, object]) -> Dict[str, object]:
        if not isinstance(context, dict):
            return {}

        compact: Dict[str, object] = {}
        for key in ("budget", "budgetMin", "budgetMax", "purpose", "brand", "socket", "ramDdr", "ramBus"):
            value = context.get(key)
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            compact[key] = value

        selected_components = context.get("selectedComponents")
        if isinstance(selected_components, list) and selected_components:
            compact_components: List[Dict[str, object]] = []
            for item in selected_components[:5]:
                if not isinstance(item, dict):
                    continue
                compact_components.append(
                    {
                        "slot": item.get("slot"),
                        "name": item.get("name"),
                        "price": item.get("price"),
                    }
                )
            if compact_components:
                compact["selectedComponents"] = compact_components

        return compact

    def _ensure_required_primary_slots(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        if not primary:
            return primary

        gaming_mode = bool(constraints.get("gaming_mode"))
        design_mode = bool(constraints.get("design_mode"))
        streaming_mode = bool(constraints.get("streaming_mode"))
        office_mode = bool(constraints.get("office_mode"))
        required_slots = list(CORE_BUILD_SLOTS)
        
        # Always add CASE and COOLER as they are essential for a complete build
        if "COOLER" not in required_slots:
            required_slots.append("COOLER")
        if "CASE" not in required_slots:
            required_slots.append("CASE")
        
        if not gaming_mode and not design_mode and not streaming_mode:
            # For office builds, GPU is not strictly required
            required_slots = [s for s in required_slots if s != "GPU"]
            
        present_slots = {(item.slot or "").upper() for item in primary if item.slot}
        missing_slots = [slot for slot in required_slots if slot not in present_slots]
        
        # For gaming/design/streaming: process CPU before GPU to ensure CPU gets budget first
        if gaming_mode or design_mode or streaming_mode:
            slot_order = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "GPU", "CASE", "COOLER"]
            missing_slots.sort(key=lambda s: slot_order.index(s) if s in slot_order else 99)
        
        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)
        cpu_item = next((item for item in primary if (item.slot or "").upper() == "CPU"), None)
        cpu_socket = self._extract_socket_from_product(cpu_item) if cpu_item else None
        cpu_platform = self._extract_platform_from_text(cpu_item.name) if cpu_item else None
        current_total = self._sum_product_prices(primary)
        ceiling = budget_max * 1.07
        existing_ids = {item.product_id for item in primary}

        for slot in missing_slots:
            ratio = self._target_ratio_for_slot(constraints, slot)
            
            # For gaming mode, give more budget to GPU (up to 65% of budget)
            if gaming_mode and slot == "GPU":
                slot_budget_max = budget_max * 0.65
            elif gaming_mode and slot == "MAINBOARD":
                slot_budget_max = budget_max * 0.25  # 25% for gaming mainboard (4M for 16M budget)
            elif design_mode and slot == "RAM":
                slot_budget_max = budget_max * 0.18  # 18% for design RAM (32GB+)
            elif design_mode and slot == "SSD":
                slot_budget_max = budget_max * 0.12  # 12% for fast NVMe SSD
            elif design_mode and slot == "MAINBOARD":
                slot_budget_max = budget_max * 0.22  # 22% for design mainboard
            elif streaming_mode and slot == "RAM":
                slot_budget_max = budget_max * 0.18  # 18% for streaming RAM (32GB+)
            elif streaming_mode and slot == "MAINBOARD":
                slot_budget_max = budget_max * 0.22  # 22% for streaming mainboard
            elif office_mode and slot == "MAINBOARD":
                slot_budget_max = budget_max * 0.20  # 20% for office mainboard (ensure socket compatibility)
            elif office_mode and slot == "SSD":
                slot_budget_max = budget_max * 0.12  # 12% for office SSD
            else:
                slot_budget_max = budget_max * ratio
            
            target_price = None
            target_min = constraints.get("target_min")
            if isinstance(target_min, (int, float)) and target_min > 0:
                target_price = target_min * ratio

            docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                slot=slot,
                budget_max=float(slot_budget_max),
                target_price=target_price,
                limit=50,
                selected_brand=selected_brand,
                preferred_socket=cpu_socket if slot == "MAINBOARD" else None,
                preferred_platform=cpu_platform if slot == "MAINBOARD" else None,
            )
            if not docs:
                # Fallback: try without socket filter but with platform-based chip matching
                docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot=slot,
                    budget_max=float(slot_budget_max),
                    target_price=None,
                    limit=50,
                    selected_brand=selected_brand,
                    preferred_socket=None,  # No socket filter in fallback
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

                candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                candidate = ProductSuggestion(
                    productId=candidate_id,
                    categoryId=category_id,
                    slot=normalized_slot,
                    name=name,
                    price=int(candidate_price),
                    image=doc.get("image"),
                    url=doc.get("url"),
                    socket=candidate_socket,
                    reason="Bo sung slot bat buoc cho bo chinh",
                )

                tentative_total = current_total + candidate_price
                if tentative_total > ceiling:
                    if slot in CORE_BUILD_SLOTS or slot in ("CASE", "COOLER"):
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

            if best is None and (slot in CORE_BUILD_SLOTS or slot in ("CASE", "COOLER")) and best_over_budget_core is not None:
                primary = self._make_room_for_required_slot(
                    primary,
                    required_price=float(best_over_budget_core.price or 0),
                    ceiling=float(ceiling),
                    constraints=constraints,
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
                                constraints=constraints,
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
                    primary_before = list(primary)
                    primary = self._enforce_primary_cpu_mainboard_compatibility(
                        primary,
                        {
                            slot_key: [item for item in primary if (item.slot or "").upper() == slot_key]
                            for slot_key in {((item.slot or "").upper()) for item in primary if item.slot}
                        },
                    )
                    mb_after = next((item for item in primary if (item.slot or "").upper() == "MAINBOARD"), None)
                    if mb_after is None:
                        primary = primary_before

        return primary

    @staticmethod
    def _make_room_for_required_slot(
        primary: List[ProductSuggestion],
        required_price: float,
        ceiling: float,
        constraints: Optional[Dict[str, Optional[float]]] = None,
    ) -> List[ProductSuggestion]:
        if required_price <= 0:
            return primary

        working = list(primary)
        gaming_mode = bool((constraints or {}).get("gaming_mode"))
        design_mode = bool((constraints or {}).get("design_mode"))
        streaming_mode = bool((constraints or {}).get("streaming_mode"))
        
        # Protect GPU for gaming/design/streaming builds
        if gaming_mode or design_mode or streaming_mode:
            drop_priority = ["COOLER", "CASE"]
        else:
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
        is_balanced = self._is_mainboard_price_balanced(mb_price, cpu_price, constraints)
        is_compatible = OrchestratorAgent._are_products_socket_compatible(cpu_item, mb_item)
        if is_balanced and is_compatible:
            return primary

        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        selected_brand = self._extract_selected_brand(context)
        cpu_socket = self._extract_socket_from_product(cpu_item)
        cpu_platform = self._extract_platform_from_text(cpu_item.name)
        current_total = self._sum_product_prices(primary)
        ceiling = float(budget_max) * 1.05

        target_mb_price = (cpu_price * 0.8) if cpu_price else (budget_max * 0.15)
        cheaper_mainboards = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="MAINBOARD",
            budget_max=float(budget_max),
            target_price=target_mb_price,
            limit=50,
            exclude_product_ids=[mb_item.product_id],
            selected_brand=selected_brand,
            preferred_socket=cpu_socket,
            preferred_platform=cpu_platform,
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
            candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
            candidate = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="MAINBOARD",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                socket=candidate_socket,
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
            limit=50,
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
            candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
            candidate = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="CPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                socket=candidate_socket,
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
        design_mode = False
        if isinstance(constraints, dict):
            raw = constraints.get("budget_max")
            if isinstance(raw, (int, float)) and raw > 0:
                budget_max = float(raw)
            design_mode = bool(constraints.get("design_mode"))

        ratio = 1.20
        if isinstance(budget_max, (int, float)):
            for threshold, capped_ratio in MAINBOARD_CPU_PRICE_RATIO_CAP_BY_BUDGET:
                if budget_max <= threshold:
                    ratio = capped_ratio
                    break
        
        if design_mode:
            ratio = max(ratio, 1.10)
        
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
        # SKIP rebalancing for gaming mode - we want the strongest GPU possible
        # not a "balanced" CPU-GPU pair
        gaming_mode = bool(constraints.get("gaming_mode"))
        if gaming_mode:
            return primary
        
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
            limit=50,
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
            candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
            primary[gpu_idx] = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="GPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                socket=candidate_socket,
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
            limit=50,
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
            candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
            primary[cpu_idx] = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="CPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                socket=candidate_socket,
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
                    limit=50,
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
                    candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                    primary[cpu_idx] = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot="CPU",
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        socket=candidate_socket,
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
                    limit=50,
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
                    candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                    primary[mb_idx] = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot="MAINBOARD",
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        socket=candidate_socket,
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

        ceiling = target_max if isinstance(target_max, (int, float)) and target_max > 0 else budget_max
        if not isinstance(ceiling, (int, float)) or ceiling <= 0:
            ceiling = budget_max

        gaming_mode = bool(constraints.get("gaming_mode"))
        design_mode = bool(constraints.get("design_mode"))
        streaming_mode = bool(constraints.get("streaming_mode"))
        if gaming_mode:
            # For gaming, prioritize GPU upgrade first, allow going closer to budget_max
            preferred_upgrade_slots = ["GPU", "CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER"]
            # Allow lifting up to 95% of budget_max for gaming
            ceiling = min(ceiling, budget_max * 0.95) if isinstance(budget_max, (int, float)) else ceiling
        elif design_mode or streaming_mode:
            # For design/streaming, prioritize balanced upgrades
            preferred_upgrade_slots = ["GPU", "CPU", "RAM", "MAINBOARD", "SSD", "PSU", "CASE", "COOLER"]
            ceiling = min(ceiling, budget_max * 0.95) if isinstance(budget_max, (int, float)) else ceiling
        else:
            preferred_upgrade_slots = ["CPU", "RAM", "SSD", "MAINBOARD", "PSU", "CASE", "COOLER", "GPU"]

        # Phase 1: Lift to target_min
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
                available_room = ceiling - (current_total - current_price)
                docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot=slot,
                    budget_max=float(available_room),
                    target_price=target_price,
                    limit=50,
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
                    if tentative_total > float(ceiling) * 1.05: # Allow 5% buffer for lifting
                        continue

                    # Special rule for storage: if we are lifting, always prefer SSD over HDD
                    if slot == "SSD" and "HDD" in name.upper() and any(kw in name.upper() for kw in ("SSD", "NVME", "M.2")):
                        pass # Valid SSD name match
                    elif slot == "SSD" and "HDD" in name.upper():
                        continue # Skip HDD for SSD slot during lifting

                    candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                    candidate = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot=normalized_slot,
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        socket=candidate_socket,
                        reason="Nang cap de toi uu hieu nang cho gaming",
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

        # Phase 2: Continue lifting closer to budget_max (95%)
        aggressive_ceiling = budget_max * 0.95 if isinstance(budget_max, (int, float)) else ceiling
        if current_total < aggressive_ceiling:
            improved = True
            while improved and current_total < aggressive_ceiling:
                improved = False
                best_upgrade = None
                best_delta = 0.0

                for slot in preferred_upgrade_slots:
                    idx = next((i for i, item in enumerate(primary) if (item.slot or "").upper() == slot), None)
                    if idx is None:
                        continue

                    current_item = primary[idx]
                    current_price = self._to_number(current_item.price) or 0.0
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
                    available_room = aggressive_ceiling - (current_total - current_price)
                    target_price = available_room * 0.9  # Target high-end products within budget
                    cpu_swap_mb = None  # Track cross-socket mainboard swap
                    docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                        slot=slot,
                        budget_max=float(available_room),
                        target_price=target_price,
                        limit=30,
                        exclude_product_ids=[current_item.product_id],
                        selected_brand=selected_brand,
                        preferred_socket=preferred_socket,
                        preferred_platform=preferred_platform,
                    )

                    # If slot is CPU and budget allows, also try cross-platform for better upgrade
                    if slot == "CPU" and preferred_socket and available_room > 5_000_000:
                        cross_docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                            slot=slot,
                            budget_max=float(available_room),
                            target_price=target_price,
                        limit=50,
                            exclude_product_ids=[current_item.product_id],
                            selected_brand=selected_brand,
                            preferred_socket=None,
                            preferred_platform=None,
                        )
                        if cross_docs:
                            # Filter out non-CPU products (e.g. coolers with 'CPU' in name)
                            real_cpus = []
                            for cd in cross_docs:
                                cd_slot = self._infer_slot(
                                    category_id=self._normalize_category_id(cd.get("categoryId")),
                                    category_code=cd.get("categoryCode"),
                                    name=self._sanitize_text(cd.get("name", "")),
                                )
                                if (cd_slot or "").upper() == "CPU":
                                    real_cpus.append(cd)
                            if real_cpus:
                                # Pick the best cross-socket CPU candidate
                                cross_best = max(real_cpus, key=lambda d: float(d.get("price", 0)))
                                cross_price = self._to_number(cross_best.get("price"))
                                if cross_price and cross_price > current_price:
                                    cross_socket = OrchestratorAgent._extract_socket_from_raw(cross_best)
                                    cross_name = self._sanitize_text(cross_best.get("name", ""))
                                    # Find a mainboard compatible with this new CPU
                                    mb_remaining = aggressive_ceiling - (current_total - current_price)
                                    mb_docs = self.db_agent.mongo_service.get_alternative_products_for_slot(
                                        slot="MAINBOARD",
                                        budget_max=float(mb_remaining),
                                        target_price=mb_remaining * 0.5,
                                        limit=50,
                                        exclude_product_ids=[],
                                        selected_brand=selected_brand,
                                        preferred_socket=cross_socket,
                                        preferred_platform=None,
                                    )
                                    for mbdoc in mb_docs:
                                        mb_slot = self._infer_slot(
                                            category_id=self._normalize_category_id(mbdoc.get("categoryId")),
                                            category_code=mbdoc.get("categoryCode"),
                                            name=self._sanitize_text(mbdoc.get("name", "")),
                                        )
                                        if (mb_slot or "").upper() != "MAINBOARD":
                                            continue
                                        mb_price = self._to_number(mbdoc.get("price"))
                                        if not mb_price or mb_price <= 0:
                                            continue
                                        mb_tentative = current_total - current_price + cross_price
                                        # Find current mainboard index to replace
                                        mb_idx = next((i for i, item in enumerate(primary) if (item.slot or "").upper() == "MAINBOARD"), None)
                                        if mb_idx is not None:
                                            mb_current_price = self._to_number(primary[mb_idx].price) or 0
                                            mb_tentative = mb_tentative - mb_current_price + mb_price
                                        else:
                                            mb_tentative = mb_tentative + mb_price
                                        if mb_tentative > aggressive_ceiling * 1.03:
                                            continue
                                        cpu_swap_mb = (mbdoc, mb_price, mb_idx)
                                        break
                                    if cpu_swap_mb:
                                        # Append cross-socket candidate to docs (don't overwrite)
                                        docs = list(docs) + [cross_best]

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
                        if tentative_total > aggressive_ceiling * 1.03:
                            continue

                        candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                        candidate = ProductSuggestion(
                            productId=str(doc.get("_id", "")),
                            categoryId=category_id,
                            slot=normalized_slot,
                            name=name,
                            price=int(candidate_price),
                            image=doc.get("image"),
                            url=doc.get("url"),
                            socket=candidate_socket,
                            reason="Nang cap de toi uu ngan sach",
                        )

                        delta = candidate_price - current_price
                        if delta > best_delta:
                            best_delta = delta
                            best_upgrade = (idx, candidate, tentative_total)

                if best_upgrade is not None:
                    idx, candidate, tentative_total = best_upgrade
                    swapped_slot = (primary[idx].slot or "").upper()
                    primary[idx] = candidate
                    # If CPU was upgraded to a different socket, swap mainboard too
                    if swapped_slot == "CPU" and cpu_swap_mb:
                        mbdoc, mb_price, mb_idx = cpu_swap_mb
                        mb_name = self._sanitize_text(mbdoc.get("name", ""))
                        mb_slot_inferred = self._infer_slot(
                            category_id=self._normalize_category_id(mbdoc.get("categoryId")),
                            category_code=mbdoc.get("categoryCode"),
                            name=mb_name,
                        )
                        if mb_idx is not None:
                            primary[mb_idx] = ProductSuggestion(
                                productId=str(mbdoc.get("_id", "")),
                                categoryId=self._normalize_category_id(mbdoc.get("categoryId")),
                                slot=mb_slot_inferred,
                                name=mb_name,
                                price=int(mb_price),
                                image=mbdoc.get("image"),
                                url=mbdoc.get("url"),
                                socket=OrchestratorAgent._extract_socket_from_raw(mbdoc),
                                reason="Swap mainboard de tuong thich voi CPU moi",
                            )
                        else:
                            primary.append(ProductSuggestion(
                                productId=str(mbdoc.get("_id", "")),
                                categoryId=self._normalize_category_id(mbdoc.get("categoryId")),
                                slot=mb_slot_inferred,
                                name=mb_name,
                                price=int(mb_price),
                                image=mbdoc.get("image"),
                                url=mbdoc.get("url"),
                                socket=OrchestratorAgent._extract_socket_from_raw(mbdoc),
                                reason="Bo sung mainboard tuong thich voi CPU moi",
                            ))
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
        budget_max = (constraints or {}).get("budget_max")
        gaming_mode = bool((constraints or {}).get("gaming_mode"))
        design_mode = bool((constraints or {}).get("design_mode"))
        streaming_mode = bool((constraints or {}).get("streaming_mode"))
        office_mode = bool((constraints or {}).get("office_mode"))
        
        # CRITICAL: Use slot priority based on use case
        if gaming_mode:
            ordered_slots = ["GPU", "CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER"]
        elif design_mode:
            # Design: GPU first (GPU acceleration), then CPU (multi-core), then RAM
            ordered_slots = ["GPU", "CPU", "RAM", "MAINBOARD", "SSD", "PSU", "CASE", "COOLER"]
        elif streaming_mode:
            # Streaming: CPU first (encoding), then GPU (NVENC), then RAM
            ordered_slots = ["CPU", "GPU", "RAM", "MAINBOARD", "SSD", "PSU", "CASE", "COOLER"]
        elif office_mode:
            ordered_slots = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER"]  # GPU optional for office
        else:
            ordered_slots = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER", "GPU"]
        
        used_slots = set()
        selected_cpu_item = None
        selected_cpu_socket = None
        selected_cpu_platform = None
        
        for slot in ordered_slots:
            candidates = by_slot.get(slot, [])
            if not candidates:
                continue
            
            # For MAINBOARD slot in gaming mode, filter by CPU socket if CPU already selected
            if slot == "MAINBOARD" and selected_cpu_item is not None:
                filtered_candidates = []
                for c in candidates:
                    if OrchestratorAgent._are_products_socket_compatible(selected_cpu_item, c):
                        filtered_candidates.append(c)
                if filtered_candidates:
                    candidates = filtered_candidates
                else:
                    # No compatible mainboard - skip this slot, will be filled by supplement
                    continue
                    
            if budget_max and budget_max > 0:
                # Target price for this slot
                target_ratio = OrchestratorAgent._target_ratio_for_slot(constraints or {}, slot)
                target_price = float(budget_max) * target_ratio
                
                # For gaming/design/streaming: prioritize higher performance GPU
                if slot == "GPU" and (gaming_mode or design_mode or streaming_mode):
                    # Pick the most expensive GPU that fits within budget
                    valid_candidates = [c for c in candidates if (OrchestratorAgent._to_number(c.price) or 0) <= budget_max * 0.7]
                    if valid_candidates:
                        best_candidate = max(valid_candidates, key=lambda c: OrchestratorAgent._to_number(c.price) or 0)
                    else:
                        best_candidate = max(candidates, key=lambda c: OrchestratorAgent._to_number(c.price) or 0)
                else:
                    # Original logic: pick candidate closest to target_price but not exceeding budget
                    # But also prefer higher-end when within reasonable range
                    valid_candidates = [c for c in candidates if (OrchestratorAgent._to_number(c.price) or 0) <= budget_max]
                    if valid_candidates:
                        # For CPU and MAINBOARD at higher budgets, prefer newer sockets
                        if slot in ("CPU", "MAINBOARD") and budget_max >= 15_000_000:
                            def _socket_score(item):
                                s = (item.socket or "").upper()
                                if not s:
                                    return 0
                                if "1700" in s or "LGA1700" in s:
                                    return 3
                                if "AM5" in s or s.startswith("AM"):
                                    return 2
                                if "1200" in s or "LGA1200" in s:
                                    return 1
                                return 0
                            valid_candidates.sort(key=lambda c: (-_socket_score(c), OrchestratorAgent._to_number(c.price) or 0))
                        else:
                            valid_candidates.sort(key=lambda c: OrchestratorAgent._to_number(c.price) or 0)
                        mid_idx = min(len(valid_candidates) // 2, 2)
                        best_candidate = valid_candidates[mid_idx] if valid_candidates else candidates[0]
                    else:
                        best_candidate = min(candidates, key=lambda c: abs((OrchestratorAgent._to_number(c.price) or 0) - target_price))
                primary.append(best_candidate)
            else:
                best_candidate = candidates[0]; primary.append(best_candidate)
            used_slots.add(slot)
            
            # Track selected CPU for socket compatibility check with Mainboard
            if slot == "CPU":
                selected_cpu_item = best_candidate
                selected_cpu_socket = OrchestratorAgent._extract_socket_from_product(best_candidate)
                selected_cpu_platform = OrchestratorAgent._extract_platform_from_text(best_candidate.name)

        for item in products:
            slot = (item.slot or "").upper()
            if not slot or slot in used_slots:
                continue
            # Skip HDD unless user explicitly requested storage
            if slot == "HDD":
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
        # Use gaming priority for upgrade order - GPU first for gaming builds
        if gaming_mode:
            slot_order = ["GPU", "CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER"]
        elif office_mode:
            slot_order = ["RAM", "SSD", "PSU", "MAINBOARD", "CPU", "CASE", "COOLER", "GPU"]
        else:
            slot_order = ["CPU", "MAINBOARD", "RAM", "SSD", "PSU", "CASE", "COOLER", "GPU"]

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
        
        # If we have socket info for both, compare directly
        if cpu_socket and mainboard_socket:
            return cpu_socket == mainboard_socket
        
        # CRITICAL: If CPU has socket info but mainboard doesn't, 
        # we cannot verify compatibility - return False (not compatible)
        # This prevents incorrectly pairing i5-12400F (LGA1700) with H310M (unknown socket)
        if cpu_socket and not mainboard_socket:
            return False
        
        # Fallback to platform check (less reliable than socket)
        cpu_platform = OrchestratorAgent._extract_platform_from_text(cpu.name)
        mainboard_platform = OrchestratorAgent._extract_platform_from_text(mainboard.name)
        if cpu_platform and mainboard_platform and cpu_platform != mainboard_platform:
            return False

        # If we still don't have enough info, assume compatible rather than reject
        # This allows builds to proceed when socket data is missing from DB
        return True

    @staticmethod
    def _extract_socket_from_product(product: ProductSuggestion) -> Optional[str]:
        # First try product.socket (extracted from DB)
        if product.socket:
            return product.socket
        # Fallback to name
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
        budget_constraints = OrchestratorAgent._extract_budget_constraints(context, query)
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
            candidate_socket = OrchestratorAgent._extract_socket_from_raw(raw)

            suggestion = ProductSuggestion(
                productId=product_id,
                categoryId=category_id,
                slot=suggestion_slot,
                name=name,
                price=int(numeric_price) if numeric_price is not None else raw.get("price"),
                image=raw.get("image"),
                url=raw.get("url") or ev.url,
                socket=candidate_socket,
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

        # 1. Start with socket-compatible candidates or all suggestions if no constraints
        candidates = filtered if has_constraints and filtered else suggestions

        # 2. Filter by slot to ensure we have products for each category within budget
        found_slots = {s.slot for s in candidates if s.slot}
        final_filtered = []
        
        for slot in found_slots:
            slot_items = [s for s in candidates if s.slot == slot]
            if not slot_items:
                continue

            # A. Try strict budget caps
            strict = [
                s for s in slot_items 
                if OrchestratorAgent._is_within_budget_constraints(
                    OrchestratorAgent._to_number(s.price), s.slot, budget_constraints, enforce_slot_caps=False
                )
            ]
            
            if strict:
                # Rank and add top candidates
                ranked = OrchestratorAgent._rank_suggestions(
                    strict,
                    low_budget_mode=low_budget_mode,
                    has_core_selected=has_core_selected,
                    allow_duplicate_fill=allow_duplicate_fill,
                    office_mode=office_mode,
                    cpu_igpu_by_product=cpu_igpu_by_product,
                    gaming_mode=budget_constraints.get("gaming_mode", False),
                )
                final_filtered.extend(ranked[:5])
            else:
                # B. Fallback to relaxed budget caps
                relaxed = [
                    s for s in slot_items 
                    if OrchestratorAgent._is_within_budget_constraints(
                        OrchestratorAgent._to_number(s.price), s.slot, budget_constraints, enforce_slot_caps=False
                    )
                ]
                if relaxed:
                    ranked = OrchestratorAgent._rank_suggestions(
                        relaxed,
                        low_budget_mode=low_budget_mode,
                        has_core_selected=has_core_selected,
                        allow_duplicate_fill=allow_duplicate_fill,
                        office_mode=office_mode,
                        cpu_igpu_by_product=cpu_igpu_by_product,
                        gaming_mode=budget_constraints.get("gaming_mode", False),
                    )
                    final_filtered.extend(ranked[:3])

        # 3. Final ranking and limiting
        if not final_filtered:
            # If still nothing, we return empty instead of leaking expensive parts
            return []

        final_ranked = OrchestratorAgent._rank_suggestions(
            final_filtered,
            low_budget_mode=low_budget_mode,
            has_core_selected=has_core_selected,
            allow_duplicate_fill=allow_duplicate_fill,
            office_mode=office_mode,
            cpu_igpu_by_product=cpu_igpu_by_product,
            gaming_mode=budget_constraints.get("gaming_mode", False),
        )
        
        return OrchestratorAgent._limit_products_per_slot(final_ranked, MAX_PRODUCTS_PER_SLOT)[:MAX_PRODUCT_SUGGESTIONS]

    def _retrieve_budget_fallback_evidences(self, context: Dict[str, object]) -> List[RetrievedEvidence]:
        budget_max = self._extract_budget_max(context)
        if budget_max is None:
            return []

        budget_text = context.get("budget") if isinstance(context.get("budget"), str) else ""
        brand_text = context.get("brand") if isinstance(context.get("brand"), str) else ""
        
        # Detect mode from context
        gaming_mode = OrchestratorAgent._is_gaming_context(context)
        design_mode = OrchestratorAgent._is_design_context(context)
        streaming_mode = OrchestratorAgent._is_streaming_context(context)
        office_mode = OrchestratorAgent._is_office_context(context)

        # Build slot list based on mode
        if gaming_mode:
            slot_keywords = "CPU MAINBOARD RAM SSD PSU GPU CASE COOLER do hoa gaming hieu nang cao"
        elif design_mode:
            slot_keywords = "CPU MAINBOARD RAM SSD PSU GPU CASE COOLER do hoa thiet ke render video"
        elif streaming_mode:
            slot_keywords = "CPU MAINBOARD RAM SSD PSU GPU CASE COOLER streaming live stream"
        elif office_mode:
            slot_keywords = "CPU MAINBOARD RAM SSD PSU CASE COOLER van phong office"
        else:
            slot_keywords = "CPU MAINBOARD RAM SSD PSU GPU CASE COOLER"

        fallback_query = f"goi y linh kien {slot_keywords} can bang ngan sach gia tot"
        
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
                max_results=60,
            )
        )
        if not observation.success:
            return []
        return observation.evidences

    def _build_budget_shortlist_products(self, context: Dict[str, object], query: Optional[str] = None) -> List[ProductSuggestion]:
        constraints = OrchestratorAgent._extract_budget_constraints(context, query)
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

            candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
            shortlist.append(
                ProductSuggestion(
                    productId=product_id,
                    categoryId=category_id,
                    slot=slot,
                    name=name,
                    price=int(numeric_price),
                    image=doc.get("image"),
                    url=doc.get("url"),
                    socket=candidate_socket,
                    reason="Phu hop ngan sach da chon",
                )
            )
            if (slot or "").upper() == "CPU":
                cpu_igpu_by_product[product_id] = OrchestratorAgent._has_integrated_graphics(doc, name)

        if office_mode and not explicit_gpu_request:
            shortlist = [item for item in shortlist if (item.slot or "").upper() != "GPU"]
            shortlist = OrchestratorAgent._prefer_office_igpu_cpu(shortlist, cpu_igpu_by_product)
        
        shortlist_slots = set((item.slot or "").upper() for item in shortlist)

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
            gaming_mode=constraints.get("gaming_mode", False),
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
                limit=50,
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

                candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                supplemented.append(
                    ProductSuggestion(
                        productId=product_id,
                        categoryId=category_id,
                        slot=normalized_slot,
                        name=name,
                        price=int(numeric_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        socket=candidate_socket,
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
        gaming_mode = bool(constraints.get("gaming_mode"))
        design_mode = bool(constraints.get("design_mode"))
        streaming_mode = bool(constraints.get("streaming_mode"))
        low_budget = bool(constraints.get("low_budget"))
        
        # For design/streaming with low budget, fallback to gaming ratios
        if low_budget and (design_mode or streaming_mode):
            return GAMING_SLOT_CAP_RATIO.get(slot, 0.1)
        
        if gaming_mode:
            budget_max = constraints.get("budget_max")
            if isinstance(budget_max, (int, float)) and budget_max >= 16_000_000:
                return HIGH_BUDGET_GAMING_TARGET_RATIO.get(slot, 0.1)
            return GAMING_SLOT_CAP_RATIO.get(slot, 0.1)
        if design_mode:
            return DESIGN_SLOT_CAP_RATIO.get(slot, 0.1)
        if streaming_mode:
            return STREAMING_SLOT_CAP_RATIO.get(slot, 0.1)

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
        constraints = OrchestratorAgent._extract_budget_constraints(context)
        budget_max = constraints.get("budget_max")
        if budget_max is None:
            return []

        # For replacement, always use full budget (not remaining)
        effective_budget = float(budget_max) if isinstance(budget_max, (int, float)) else None
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
        price_pref = (preference or {}).get("price")
        upgrade_intent = price_pref == "higher"
        downgrade_intent = price_pref == "lower"
        office_gpu_downgrade = slot.upper() == "GPU" and price_pref == "much_lower"
        if upgrade_intent:
            # For upgrade requests, use full budget and target higher price
            query_budget_max = float(budget_max) if isinstance(budget_max, (int, float)) else query_budget_max
            if selected_slot_price is not None:
                target_price_for_query = selected_slot_price * 1.5  # Target 50% higher
            else:
                target_price_for_query = None
        if downgrade_intent:
            # For downgrade requests, target lower price
            if selected_slot_price is not None:
                query_budget_max = max(1.0, selected_slot_price * 0.95)
                target_price_for_query = selected_slot_price * 0.7
            else:
                target_price_for_query = None
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
        constraints_for_filter["remaining_budget"] = float(budget_max) if isinstance(budget_max, (int, float)) else None
        constraints_for_filter.pop("budget_max", None)

        def _to_products(candidates: List[Dict[str, Any]], reason_text: str) -> List[ProductSuggestion]:
            converted: List[ProductSuggestion] = []
            ssd_capacity_pref = (preference or {}).get("ssd_capacity")
            passed_count = 0
            rejected_count = 0
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
                    rejected_count += 1
                    continue

                numeric_price = OrchestratorAgent._to_number(doc.get("price"))
                if office_gpu_downgrade and selected_slot_price is not None:
                    if numeric_price is None or numeric_price >= selected_slot_price * 0.7:
                        continue
                if upgrade_intent and selected_slot_price is not None:
                    if numeric_price is None or numeric_price <= selected_slot_price:
                        rejected_count += 1
                        continue

                if not OrchestratorAgent._is_within_budget_constraints(
                    price=numeric_price,
                    slot=suggestion_slot,
                    constraints=constraints_for_filter,
                    enforce_slot_caps=False,
                ):
                    rejected_count += 1
                    continue
                if numeric_price is None or numeric_price <= 0:
                    continue

                passed_count += 1

                candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                converted.append(
                    ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot=suggestion_slot,
                        name=name,
                        price=int(numeric_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        socket=candidate_socket,
                        reason=reason_text,
                    )
                )
            return converted

        reason = f"Goi y thay the {slot} cung tam gia"
        if selected_slot_price is None:
            reason = f"Goi y thay the {slot} trong ngan sach hien tai"
        if upgrade_intent:
            reason = f"Goi y {slot} manh hon trong ngan sach hien tai"
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

        higher_markers = (
            "cao hon",
            "lon hon",
            "nhieu hon",
            "manh hon",
            "tot hon",
            "xong hon",
            "mac hon",
            "dat hon",
            "nang cap",
            "tang dung luong",
            "dung luong cao",
            "capacity higher",
            "higher end",
            "performance",
        )
        lower_markers = (
            "thap hon",
            "nho hon",
            "it hon",
            "re hon",
            "giam dung luong",
            "dung luong thap",
            "capacity lower",
            "lower end",
        )

        if any(marker in normalized for marker in higher_markers):
            preference["price"] = "higher"
        elif any(marker in normalized for marker in lower_markers):
            preference["price"] = "lower"

        ssd_requested = any(keyword in normalized for keyword in REPLACEMENT_SLOT_KEYWORDS.get("SSD", []))
        if ssd_requested:
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
            budget_max = constraints.get("budget_max")
            office_mode = bool(constraints.get("office_mode"))
            if office_mode or (isinstance(budget_max, (int, float)) and budget_max <= 10_000_000):
                return capacity >= 120.0
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
        gaming_mode: bool = False,
    ) -> List[ProductSuggestion]:
        if not suggestions:
            return []

        if gaming_mode:
            priority_map = GAMING_SLOT_PRIORITY
        elif low_budget_mode:
            priority_map = LOW_BUDGET_SLOT_PRIORITY
        else:
            priority_map = DEFAULT_SLOT_PRIORITY

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

        budget_constraints = OrchestratorAgent._extract_budget_constraints(context, query)
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
            gaming_mode=budget_constraints.get("gaming_mode", False),
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

        constraints = OrchestratorAgent._extract_budget_constraints(context) # Inside should_enforce_budget_floor
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
    def _extract_budget_constraints(context: Optional[Dict[str, object]], query: Optional[str] = None) -> Dict[str, Optional[float]]:
        if not isinstance(context, dict):
            context = {}

        # Merge query into a temporary context for extraction if budget is missing
        temp_context = dict(context)
        if query and not temp_context.get("budget"):
            temp_context["budget"] = query

        budget_max = OrchestratorAgent._extract_budget_max(temp_context)
        budget_min = OrchestratorAgent._extract_budget_min(temp_context)
        target_min, target_max = OrchestratorAgent._extract_budget_target_window(temp_context, budget_min, budget_max)
        selected_total = OrchestratorAgent._sum_selected_component_price(temp_context)
        remaining_budget = None
        if budget_max is not None:
            remaining_budget = max(0.0, budget_max - selected_total)

        low_budget = budget_max is not None and budget_max <= 10_000_000
        purpose = temp_context.get("purpose") or query or ""
        is_gaming = isinstance(purpose, str) and any(kw in OrchestratorAgent._normalize_for_matching(purpose) for kw in ["gaming", "choi game", "game"])
        is_design = OrchestratorAgent._is_design_context(temp_context, query)
        is_streaming = OrchestratorAgent._is_streaming_context(temp_context, query)
        is_office = OrchestratorAgent._is_office_context(temp_context, query)
        
        # Priority: gaming > streaming > design > office
        if is_gaming:
            is_design = False
            is_streaming = False
            is_office = False
        elif is_streaming:
            is_design = False
            is_office = False
        elif is_design:
            is_office = False

        return {
            "budget_max": budget_max,
            "budget_min": budget_min,
            "target_min": target_min,
            "target_max": target_max,
            "remaining_budget": remaining_budget,
            "low_budget": low_budget,
            "gaming_mode": is_gaming,
            "design_mode": is_design,
            "streaming_mode": is_streaming,
            "office_mode": is_office,
            "office_overkill_mode": bool(
                is_office
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
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return (None, None)
        if not isinstance(budget_min, (int, float)) or budget_min <= 0:
            return (budget_max * 0.85, budget_max * 0.95)
        if budget_max <= budget_min:
            return (None, None)

        budget_text = context.get("budget") if isinstance(context.get("budget"), str) else ""
        normalized = OrchestratorAgent._normalize_for_matching(budget_text) if budget_text else ""

        if (
            abs(budget_min - 10_000_000) < 1
            and abs(budget_max - 15_000_000) < 1
            or re.search(r"10\s*(-|den|toi|~)\s*15", normalized)
        ):
            return (12_000_000.0, 13_000_000.0)

        if budget_min < (budget_max * 0.1):
            return (budget_max * 0.85, budget_max * 0.95)

        span = budget_max - budget_min
        return (budget_min + span * 0.5, budget_min + span * 0.9)

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
    def _extract_budget_max(context: Dict[str, object]) -> Optional[float]:
        for key in ("budgetMax", "budget_max", "budgetExact", "budget_exact"):
            numeric = OrchestratorAgent._to_number(context.get(key))
            if numeric is not None and numeric > 0:
                return numeric

        budget_text = context.get("budget")
        if not isinstance(budget_text, str) or not budget_text.strip():
            return None

        normalized = OrchestratorAgent._normalize_for_matching(budget_text)

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
    def _is_office_context(context: Optional[Dict[str, object]], query: Optional[str] = None) -> bool:
        purpose = ""
        if isinstance(context, dict):
            purpose = str(context.get("purpose") or "").lower()
        
        normalized_query = OrchestratorAgent._normalize_for_matching(query or "")
        normalized_purpose = OrchestratorAgent._normalize_for_matching(purpose)
        
        return any(kw in normalized_purpose for kw in OFFICE_PURPOSE_KEYWORDS) or \
               any(kw in normalized_query for kw in OFFICE_PURPOSE_KEYWORDS)

    @staticmethod
    def _is_gaming_context(context: Optional[Dict[str, object]], query: Optional[str] = None) -> bool:
        purpose_match = False
        if isinstance(context, dict):
            purpose = context.get("purpose")
            if isinstance(purpose, str) and purpose.strip():
                normalized_purpose = OrchestratorAgent._normalize_for_matching(purpose)
                purpose_match = any(kw in normalized_purpose for kw in ("gaming", "game", "choi game", "gamer"))
        
        query_match = False
        if isinstance(query, str) and query.strip():
            normalized_query = OrchestratorAgent._normalize_for_matching(query)
            query_match = any(kw in normalized_query for kw in ("gaming", "game", "choi game", "gamer"))

        return purpose_match or query_match

    @staticmethod
    def _is_design_context(context: Optional[Dict[str, object]], query: Optional[str] = None) -> bool:
        purpose_match = False
        if isinstance(context, dict):
            purpose = str(context.get("purpose") or "").lower()
            normalized_purpose = OrchestratorAgent._normalize_for_matching(purpose)
            purpose_match = any(kw in normalized_purpose for kw in DESIGN_PURPOSE_KEYWORDS)
        
        query_match = False
        if isinstance(query, str) and query.strip():
            normalized_query = OrchestratorAgent._normalize_for_matching(query)
            query_match = any(kw in normalized_query for kw in DESIGN_PURPOSE_KEYWORDS)

        return purpose_match or query_match

    @staticmethod
    def _is_streaming_context(context: Optional[Dict[str, object]], query: Optional[str] = None) -> bool:
        purpose_match = False
        if isinstance(context, dict):
            purpose = str(context.get("purpose") or "").lower()
            normalized_purpose = OrchestratorAgent._normalize_for_matching(purpose)
            purpose_match = any(kw in normalized_purpose for kw in STREAMING_PURPOSE_KEYWORDS)
        
        query_match = False
        if isinstance(query, str) and query.strip():
            normalized_query = OrchestratorAgent._normalize_for_matching(query)
            query_match = any(kw in normalized_query for kw in STREAMING_PURPOSE_KEYWORDS)

        return purpose_match or query_match

    @staticmethod
    def _is_greeting_intent(query: str) -> bool:
        normalized = OrchestratorAgent._normalize_for_matching(query)
        greetings = (
            "chao", "hi", "hello", "xin chao", "hey", "bonjour", "alo", "kaka", "haha", 
            "ban la ai", "ai day", "tro ly gi", "ten la gi"
        )
        words = normalized.split()
        if len(words) <= 3 and any(normalized.startswith(g) for g in greetings):
            return True
        return normalized in greetings

    @staticmethod
    def _is_clarification_needed(query: str, context: Dict[str, object]) -> bool:
        normalized = OrchestratorAgent._normalize_for_matching(query)
        build_keywords = ("build", "lap", "rap", "tu van", "goi y", "cau hinh", "mua", "can", "muon")
        if any(kw in normalized for kw in build_keywords):
            component_keywords = ("cpu", "gpu", "vga", "card", "main", "ram", "ssd", "nguon", "psu", "case", "tan nhiet", "cooler")
            if any(kw in normalized for kw in component_keywords):
                return False
            has_budget = OrchestratorAgent._extract_budget_max(context) is not None
            has_purpose = bool(context.get("purpose")) or OrchestratorAgent._is_gaming_context(context, query)
            if len(normalized.split()) <= 4 and not has_budget and not has_purpose:
                return True
        return False

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
            if price is not None:
                total += max(0.0, price) * max(1.0, qty)
        return total

    @staticmethod
    def _is_within_slot_target_cap(price, slot, constraints):
        budget_max = constraints.get("budget_max") if constraints else None
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return True
        if not slot or price is None or price <= 0:
            return True
        ratio = PRIMARY_BUILD_TARGET_RATIO.get(str(slot).upper(), 0.20)
        return price <= budget_max * ratio * 1.5

    @staticmethod
    def _is_within_budget_constraints(
        price: Optional[float],
        slot: Optional[str],
        constraints: Dict[str, Optional[float]],
        enforce_slot_caps: bool = True,
    ) -> bool:
        budget_max = constraints.get("budget_max")
        remaining_budget = constraints.get("remaining_budget")
        budget_is_active = budget_max is not None or remaining_budget is not None
        
        if price is None:
            return not budget_is_active
        
        if price <= 0:
            return False

        if remaining_budget is not None and price > remaining_budget:
            return False

        if budget_max is not None and price > budget_max:
            return False

        gaming_mode = bool(constraints.get("gaming_mode"))
        design_mode = bool(constraints.get("design_mode"))
        streaming_mode = bool(constraints.get("streaming_mode"))
        office_mode = bool(constraints.get("office_mode"))
        low_budget = bool(constraints.get("low_budget"))

        if budget_max is not None and slot:
            slot_key = slot.upper()
            # For design/streaming with low budget (< 10M), fallback to gaming ratios
            if low_budget and (design_mode or streaming_mode):
                ratio_table = GAMING_SLOT_CAP_RATIO if enforce_slot_caps else GAMING_RELAXED_SLOT_CAP_RATIO
            elif low_budget:
                ratio_table = LOW_BUDGET_SLOT_CAP_RATIO if enforce_slot_caps else LOW_BUDGET_RELAXED_SLOT_CAP_RATIO
            elif gaming_mode:
                ratio_table = GAMING_SLOT_CAP_RATIO if enforce_slot_caps else GAMING_RELAXED_SLOT_CAP_RATIO
            elif (design_mode or streaming_mode) and isinstance(budget_max, (int, float)) and budget_max >= 15_000_000:
                # For design/streaming at high budgets, use gaming ratios for better GPU
                ratio_table = GAMING_SLOT_CAP_RATIO if enforce_slot_caps else GAMING_RELAXED_SLOT_CAP_RATIO
            elif design_mode:
                ratio_table = DESIGN_SLOT_CAP_RATIO if enforce_slot_caps else DESIGN_RELAXED_SLOT_CAP_RATIO
            elif streaming_mode:
                ratio_table = STREAMING_SLOT_CAP_RATIO if enforce_slot_caps else STREAMING_RELAXED_SLOT_CAP_RATIO
            elif office_mode:
                ratio_table = OFFICE_SLOT_HARD_CAP_RATIO if enforce_slot_caps else DEFAULT_RELAXED_SLOT_CAP_RATIO
            else:
                ratio_table = DEFAULT_SLOT_CAP_RATIO if enforce_slot_caps else DEFAULT_RELAXED_SLOT_CAP_RATIO
                
            ratio = ratio_table.get(slot_key)
            if ratio is not None:
                slot_cap = budget_max * ratio
                
                # SPECIAL RULE: For budgets under 25M, secondary components should have absolute hard caps
                if budget_max < 25_000_000:
                    if slot_key == "CASE":
                        slot_cap = min(slot_cap, 2_000_000)
                    elif slot_key == "COOLER":
                        slot_cap = min(slot_cap, 1_500_000)
                    elif slot_key == "PSU":
                        slot_cap = min(slot_cap, 2_500_000)

                if price > slot_cap:
                    return False

        return True

    @staticmethod
    def _normalize_for_matching(value: str) -> str:
        normalized = unicodedata.normalize("NFD", value.lower())
        without_accents = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
        # Handle Vietnamese special characters
        without_accents = without_accents.replace("đ", "d").replace("Đ", "d")
        return re.sub(r"\s+", " ", without_accents).strip()

    @staticmethod
    def _to_number(value: object) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)

        if not isinstance(value, str):
            return None

        # Standardize Vietnamese/International formatting
        # Remove currency symbols and non-numeric chars except separators
        cleaned = re.sub(r"[^\d.,]", "", value)
        if not cleaned:
            return None

        # Handle dot as thousand separator (e.g. 1.500.000) vs decimal (e.g. 1.5)
        if "." in cleaned and "," in cleaned:
            # Format like 1.500,00 -> 1500.00
            normalized = cleaned.replace(".", "").replace(",", ".")
        elif "," in cleaned and cleaned.count(",") > 1:
            # Format like 1,500,000 -> 1500000
            normalized = cleaned.replace(",", "")
        elif "." in cleaned and cleaned.count(".") > 1:
            # Format like 1.500.000 -> 1500000
            normalized = cleaned.replace(".", "")
        elif "," in cleaned and len(cleaned.split(",")[1]) == 3:
             # Likely 1,500 -> 1500
             normalized = cleaned.replace(",", "")
        else:
            normalized = cleaned.replace(",", ".")

        try:
            num = float(normalized)
            return num if num >= 0 else None
        except ValueError:
            return None

    @staticmethod
    def _normalize_category_id(value: object) -> Optional[str]:
        if value is None:
            return None
        return str(value)

    @staticmethod
    def _infer_slot(category_id: Optional[str], category_code: object, name: str) -> Optional[str]:
        upper_name = name.upper()
        
        # 1. High-confidence name heuristics (Primary source of truth for messy DBs)
        # We look for clear indicators of the product type in the name first.
        heuristics = {
            "COOLER": ["TẢN NHIỆT", "COOLER", "QUẠT CASE", "QUẠT CPU", "QUẠT TẢN NHIỆT", "FAN CASE"],
            "CPU": ["CPU", "BỘ VI XỬ LÝ", "RYZEN", "CORE I3", "CORE I5", "CORE I7", "CORE I9", "7500F", "12400F"],
            "GPU": ["VGA", "CARD MÀN HÌNH", "RTX", "GTX", "RADEON", "GT 710", "GT 1030"],
            "MAINBOARD": ["MAINBOARD", "BO MẠCH CHỦ", "MOTHERBOARD", "B650", "A320", "B450", "Z790", "H610"],
            "RAM": ["RAM", "BỘ NHỚ TRONG", "DDR4", "DDR5", "DESKTOP KINGSTON"],
            "SSD": ["SSD", "M.2 NVME", "Ổ CỨNG SSD"],
            "HDD": ["HDD", "Ổ CỨNG HDD", "SKYHAWK", "IRONWOLF"],
            "PSU": ["PSU", "NGUỒN MÁY TÍNH"],
            "CASE": ["THÙNG MÁY", "CASE"],
        }
        
        for slot, keywords in heuristics.items():
            if any(k in upper_name for k in keywords):
                return slot

        # 2. Category code (Secondary)
        if isinstance(category_code, str) and category_code.strip():
            normalized_code = category_code.strip().upper().replace("-", "").replace("_", "").replace(" ", "")
            category_aliases = {
                "MAINBOARD": "MAINBOARD",
                "MOTHERBOARD": "MAINBOARD",
                "CPU": "CPU",
                "GPU": "GPU",
                "VGA": "GPU",
                "RAM": "RAM",
                "SSD": "SSD",
                "NVME": "SSD",
                "M2": "SSD",
                "HDD": "HDD",
                "HARDDISK": "HDD",
                "PSU": "PSU",
                "CASE": "CASE",
                "COOLER": "COOLER",
            }
            mapped = category_aliases.get(normalized_code)
            if mapped:
                return mapped

        # 3. Category ID (Last resort)
        if category_id and category_id in CATEGORY_SLOT_BY_ID:
            return CATEGORY_SLOT_BY_ID[category_id]

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
            if candidate_socket:
                if candidate_socket != cpu_socket:
                    return False
            else:
                # Fallback to platform check if socket extraction failed
                candidate_platform = OrchestratorAgent._extract_platform_from_raw(raw)
                if candidate_platform and cpu_platform and candidate_platform != cpu_platform:
                    return False

        if normalized_slot == "CPU" and mainboard_socket:
            if candidate_socket:
                if candidate_socket != mainboard_socket:
                    return False
            else:
                candidate_platform = OrchestratorAgent._extract_platform_from_raw(raw)
                if candidate_platform and mainboard_platform and candidate_platform != mainboard_platform:
                    return False

        return True

    @staticmethod
    def _is_cooler_compatible(cooler_raw: Dict[str, Any], cpu_socket: Optional[str]) -> bool:
        """Check if cooler supports the CPU socket."""
        if not cpu_socket:
            return True
        
        # Get supported_sockets from cooler
        supported_sockets = cooler_raw.get("supported_sockets")
        if not supported_sockets:
            return True  # Can't verify, assume compatible
        
        # Check each supported socket
        if isinstance(supported_sockets, list):
            for sock in supported_sockets:
                if isinstance(sock, str):
                    # Normalize the supported socket
                    normalized = OrchestratorAgent._normalize_socket_value(sock)
                    if normalized and normalized == cpu_socket:
                        return True
        
        return False

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
        
        # Priority 1: Explicit socket field - this is most reliable in your DB
        socket_value = raw.get("socket")
        if isinstance(socket_value, str) and socket_value.strip():
            # Normalize directly from socket field (e.g., "1700", "1151-v2", "AM5")
            normalized = OrchestratorAgent._normalize_socket_value(socket_value.strip())
            if normalized:
                return normalized
        
        # Priority 2: Direct name field
        name = raw.get("name")
        if isinstance(name, str) and name.strip():
            candidates.append(name)

        # Priority 3: Specs dictionary - check Socket key (case sensitive)
        specs = raw.get("specs_raw") or raw.get("specsRaw")
        if isinstance(specs, dict):
            for key in ("Socket",):
                value = specs.get(key)
                if isinstance(value, str) and value.strip():
                    candidates.append(value)

        for value in candidates:
            normalized = OrchestratorAgent._normalize_socket_value(value)
            if normalized:
                return normalized
        
        # Fallback: Try to infer socket from chipset (for mainboards without explicit socket in name)
        # Check both "chipset" (top-level) and "specs_raw.Chipset"
        chipset = raw.get("chipset")
        if not isinstance(chipset, str) or not chipset.strip():
            if isinstance(specs, dict):
                chipset = specs.get("Chipset")  # Note: uppercase C in your DB
        
        if isinstance(chipset, str) and chipset.strip():
            socket_from_chipset = OrchestratorAgent._socket_from_chipset(chipset.strip().upper())
            if socket_from_chipset:
                return socket_from_chipset
        
        return None

    @staticmethod
    def _socket_from_chipset(chipset: str) -> Optional[str]:
        """Map chipset to socket - for mainboards without explicit socket in name."""
        # Intel LGA1700 chipsets (12th/13th/14th gen)
        if chipset in {"H610", "H670", "H770", "B660", "B760", "B760M", "B840", "B850", "B860", "Z690", "Z790", "Z890"}:
            return "LGA1700"
        # Intel LGA1200 (10th/11th gen)
        if chipset in {"H410", "H470", "H570", "B460", "B560", "Z490", "Z590"}:
            return "LGA1200"
        # Intel LGA1151 (8th/9th gen)
        if chipset in {"H310", "H510", "B360", "B365", "H370", "Z370", "Z390", "C232"}:
            return "LGA1151"
        # Intel LGA1851 (Arrow Lake)
        if chipset in {"B850", "B860", "Z890"}:
            return "LGA1851"
        
        # AMD AM5 (Ryzen 7000 series)
        if chipset in {"A620", "B650", "B650E", "X670", "X670E", "X870", "X870E"}:
            return "AM5"
        # AMD AM4 (Ryzen 3000/5000 series)
        if chipset in {"A320", "A520", "B350", "B450", "B550", "X370", "X470", "X570"}:
            return "AM4"
        
        return None

    @staticmethod
    def _normalize_socket_value(value: object) -> Optional[str]:
        if not isinstance(value, str):
            return None

        text = value.upper()
        
        # AM4, AM5 patterns
        am_match = re.search(r"AM\d+", text)
        if am_match:
            return am_match.group(0)  # Returns "AM4", "AM5", etc.

        # LGA pattern: "LGA1700", "FCLGA1700", "Intel LGA 1700"
        lga_match = re.search(r"(LGA|INTEL\s+LGA)\s*(\d{3,4})", text, re.IGNORECASE)
        if lga_match:
            return f"LGA{lga_match.group(2)}"
        
        # Also check "FCLGA1700" style
        fclga_match = re.search(r"FC(LGA\s*\d{3,4})", text, re.IGNORECASE)
        if fclga_match:
            return fclga_match.group(1).replace(" ", "")
        
        # Check for bare number like "1700", "1151-v2"
        bare_num_match = re.search(r"(\d{4})", text)
        if bare_num_match:
            num = bare_num_match.group(1)
            if num in {"1700", "1200", "1151", "1150", "1851"}:
                return f"LGA{num}"

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

    def _upgrade_gaming_gpu(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
        all_products: List[ProductSuggestion],
    ) -> List[ProductSuggestion]:
        """Ensure gaming builds have a strong GPU. Upgrade if current GPU is too weak."""
        gpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "GPU"), None)
        if gpu_idx is None:
            # No GPU in build - need to add one for gaming
            return self._ensure_required_primary_slots(primary, constraints, context)
        
        current_gpu = primary[gpu_idx]
        current_gpu_price = self._to_number(current_gpu.price) or 0.0
        budget_max = constraints.get("budget_max")
        
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary
        
        # For gaming, GPU should be at least 40% of budget for decent performance
        min_gaming_gpu_price = budget_max * 0.40
        if current_gpu_price >= min_gaming_gpu_price:
            return primary  # GPU is already strong enough
        
        # Try to find a stronger GPU within budget
        current_total = self._sum_product_prices(primary)
        
        # Reserve budget for COOLER (required for gaming) if not already present
        has_cooler = any((item.slot or "").upper() == "COOLER" for item in primary)
        cooler_reserve = 0.0 if has_cooler else 500_000.0  # Reserve 500k for cooler
        
        remaining_for_upgrade = budget_max - (current_total - current_gpu_price) - cooler_reserve
        
        selected_brand = self._extract_selected_brand(context)
        
        # Get better GPU options
        better_gpus = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="GPU",
            budget_max=float(budget_max),
            target_price=float(min_gaming_gpu_price),
            limit=30,
            exclude_product_ids=[current_gpu.product_id],
            selected_brand=selected_brand,
        )
        
        # Find a better GPU that fits in remaining budget
        for doc in better_gpus:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "GPU":
                continue
            
            candidate_price = self._to_number(doc.get("price"))
            if candidate_price is None or candidate_price <= 0:
                continue
            
            # Check if we can afford this GPU (with cooler reserve)
            tentative_total = current_total - current_gpu_price + candidate_price
            max_allowed = budget_max * 1.03 - cooler_reserve
            if tentative_total > max_allowed:
                continue
            
            primary[gpu_idx] = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="GPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                reason="Nang cap GPU manh hon cho gaming",
            )
            return primary
        
        return primary

    def _ensure_office_igpu(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        """Ensure office builds use CPU with integrated graphics (igpu) to save cost."""
        cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
        if cpu_idx is None:
            return primary
        
        cpu_item = primary[cpu_idx]
        
        # Check if CPU already has igpu
        if self._has_integrated_graphics_from_raw(cpu_item.product_id):
            return primary
        
        # CPU doesn't have igpu - need to find a replacement
        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary
        
        selected_brand = self._extract_selected_brand(context)
        
        # Get CPU with igpu
        mainboard_item = next((item for item in primary if (item.slot or "").upper() == "MAINBOARD"), None)
        preferred_socket = self._extract_socket_from_product(mainboard_item) if mainboard_item else None
        preferred_platform = self._extract_platform_from_text(mainboard_item.name) if mainboard_item else None
        
        current_total = self._sum_product_prices(primary)
        cpu_price = self._to_number(cpu_item.price) or 0.0
        
        cpus_with_igpu = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="CPU",
            budget_max=float(budget_max),
            target_price=float(cpu_price * 1.1) if cpu_price > 0 else None,
            limit=50,
            exclude_product_ids=[cpu_item.product_id],
            selected_brand=selected_brand,
            preferred_socket=preferred_socket,
            preferred_platform=preferred_platform,
        )
        
        for doc in cpus_with_igpu:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "CPU":
                continue
            
            # Check if this CPU has igpu
            if not self._has_integrated_graphics_from_raw_doc(doc):
                continue
            
            # Check compatibility with mainboard
            if mainboard_item:
                if not self._is_socket_compatible(
                    slot="CPU",
                    raw=doc,
                    cpu_socket=None,
                    mainboard_socket=preferred_socket,
                    cpu_platform=None,
                    mainboard_platform=preferred_platform,
                ):
                    continue
            
            candidate_price = self._to_number(doc.get("price"))
            if candidate_price is None or candidate_price <= 0:
                continue
            
            tentative_total = current_total - cpu_price + candidate_price
            if tentative_total > budget_max * 1.05:
                continue
            
            candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
            primary[cpu_idx] = ProductSuggestion(
                productId=str(doc.get("_id", "")),
                categoryId=category_id,
                slot="CPU",
                name=name,
                price=int(candidate_price),
                image=doc.get("image"),
                url=doc.get("url"),
                socket=candidate_socket,
                reason="Chon CPU co igpu cho van phong tiet kiem",
            )
            return primary
        
        return primary

    def _final_compatibility_check(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
    ) -> List[ProductSuggestion]:
        """Final check to ensure CPU-Mainboard compatibility. Replace if incompatible."""
        cpu_item = next((item for item in primary if (item.slot or "").upper() == "CPU"), None)
        mb_item = next((item for item in primary if (item.slot or "").upper() == "MAINBOARD"), None)
        
        if not cpu_item or not mb_item:
            return primary
        
        # Check if they're already compatible
        if OrchestratorAgent._are_products_socket_compatible(cpu_item, mb_item):
            return primary
        
        # They're not compatible - need to replace one
        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary
        
        # Get CPU socket
        cpu_socket = self._extract_socket_from_product(cpu_item)
        
        # Try to find a compatible mainboard
        selected_brand = self._extract_selected_brand(context)
        cpu_platform = self._extract_platform_from_text(cpu_item.name)
        
        compatible_mbs = self.db_agent.mongo_service.get_alternative_products_for_slot(
            slot="MAINBOARD",
            budget_max=float(budget_max),
            target_price=float(self._to_number(mb_item.price) or 0) * 1.2 if mb_item.price else None,
            limit=30,
            exclude_product_ids=[mb_item.product_id],
            selected_brand=selected_brand,
            preferred_socket=cpu_socket,
            preferred_platform=cpu_platform,
        )
        
        current_total = self._sum_product_prices(primary)
        
        for doc in compatible_mbs:
            category_id = self._normalize_category_id(doc.get("categoryId"))
            name = self._sanitize_text(doc.get("name", ""))
            slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
            if (slot or "").upper() != "MAINBOARD":
                continue
            
            # Check socket compatibility
            candidate_socket = self._extract_socket_from_raw(doc)
            if cpu_socket and candidate_socket and candidate_socket != cpu_socket:
                continue
            
            candidate_price = self._to_number(doc.get("price"))
            if candidate_price is None or candidate_price <= 0:
                continue
            
            # Check budget
            tentative_total = current_total - (self._to_number(mb_item.price) or 0) + candidate_price
            if tentative_total > budget_max * 1.05:
                continue
            
            # Replace incompatible mainboard
            mb_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "MAINBOARD"), None)
            if mb_idx is not None:
                candidate_socket = OrchestratorAgent._extract_socket_from_raw(doc)
                primary[mb_idx] = ProductSuggestion(
                    productId=str(doc.get("_id", "")),
                    categoryId=category_id,
                    slot="MAINBOARD",
                    name=name,
                    price=int(candidate_price),
                    image=doc.get("image"),
                    url=doc.get("url"),
                    socket=candidate_socket,
                    reason="Thay the mainboard khong tuong thich voi CPU",
                )
                break
        
        # If no compatible mainboard found, try to find a compatible CPU instead
        if not any((item.slot or "").upper() == "MAINBOARD" for item in primary if item.product_id != mb_item.product_id):
            # Get mainboard socket from DB
            mb_socket = self._extract_socket_from_raw({"socket": mb_item.name, "specs_raw": {"chipset": "H310"}})
            
            # Try to find CPU that matches the mainboard
            mb_platform = self._extract_platform_from_text(mb_item.name)
            
            compatible_cpus = self.db_agent.mongo_service.get_alternative_products_for_slot(
                slot="CPU",
                budget_max=float(budget_max),
                target_price=float(self._to_number(cpu_item.price) or 0) * 1.1 if cpu_item.price else None,
                limit=30,
                exclude_product_ids=[cpu_item.product_id],
                selected_brand=selected_brand,
                preferred_socket=mb_socket,
                preferred_platform=mb_platform,
            )
            
            for doc in compatible_cpus:
                category_id = self._normalize_category_id(doc.get("categoryId"))
                name = self._sanitize_text(doc.get("name", ""))
                slot = self._infer_slot(category_id=category_id, category_code=doc.get("categoryCode"), name=name)
                if (slot or "").upper() != "CPU":
                    continue
                
                candidate_socket = self._extract_socket_from_raw(doc)
                if mb_socket and candidate_socket and candidate_socket != mb_socket:
                    continue
                
                candidate_price = self._to_number(doc.get("price"))
                if candidate_price is None or candidate_price <= 0:
                    continue
                
                tentative_total = current_total - (self._to_number(cpu_item.price) or 0) + candidate_price
                if tentative_total > budget_max * 1.05:
                    continue
                
                cpu_idx = next((idx for idx, item in enumerate(primary) if (item.slot or "").upper() == "CPU"), None)
                if cpu_idx is not None:
                    primary[cpu_idx] = ProductSuggestion(
                        productId=str(doc.get("_id", "")),
                        categoryId=category_id,
                        slot="CPU",
                        name=name,
                        price=int(candidate_price),
                        image=doc.get("image"),
                        url=doc.get("url"),
                        socket=candidate_socket,
                        reason=f"Thay CPU de tuong thich voi mainboard {mb_item.name}",
                    )
                    break
        
        return primary

    def _enforce_budget_cap(
        self,
        primary: List[ProductSuggestion],
        constraints: Dict[str, Optional[float]],
        context: Dict[str, object],
        all_products: List[ProductSuggestion],
    ) -> List[ProductSuggestion]:
        """Downsize components if total exceeds budget cap."""
        budget_max = constraints.get("budget_max")
        if not isinstance(budget_max, (int, float)) or budget_max <= 0:
            return primary

        current_total = self._sum_product_prices(primary)
        hard_cap = budget_max  # No tolerance — stay within budget
        if current_total <= hard_cap:
            return primary

        # Target: get under hard_cap but stay above 90% of budget
        target_floor = budget_max * 0.90

        selected_brand = self._extract_selected_brand(context)

        # Build lookup from all_products
        by_slot: Dict[str, List[ProductSuggestion]] = {}
        for item in all_products:
            slot = (item.slot or "").upper()
            if slot:
                by_slot.setdefault(slot, []).append(item)

        # Try to downsize most expensive slots first (GPU, CPU, then others)
        downgrade_order = ["GPU", "CPU", "RAM", "SSD", "MAINBOARD", "PSU", "CASE", "COOLER"]
        
        for slot in downgrade_order:
            if current_total <= hard_cap:
                break
            
            idx = next((i for i, item in enumerate(primary) if (item.slot or "").upper() == slot), None)
            if idx is None:
                continue
            
            current_item = primary[idx]
            current_price = self._to_number(current_item.price) or 0.0
            
            # Find cheaper alternatives from all_products first
            candidates = by_slot.get(slot, [])
            cheaper = [c for c in candidates if (self._to_number(c.price) or 0) < current_price and c.product_id != current_item.product_id]
            cheaper.sort(key=lambda c: -(self._to_number(c.price) or 0))
            
            replaced = False
            for candidate in cheaper:
                candidate_price = self._to_number(candidate.price) or 0.0
                new_total = current_total - current_price + candidate_price
                if new_total <= hard_cap and new_total >= target_floor:
                    primary[idx] = candidate
                    current_total = new_total
                    replaced = True
                    break

            # Fallback: query DB for cheaper alternatives
            if not replaced:
                db_cheaper = self.db_agent.mongo_service.get_alternative_products_for_slot(
                    slot=slot,
                    budget_max=float(current_price),
                    limit=20,
                    selected_brand=selected_brand,
                )
                db_cheaper.sort(key=lambda d: -(self._to_number(d.get("price")) or 0))
                for doc in db_cheaper:
                    cand_price = self._to_number(doc.get("price"))
                    if cand_price is None or cand_price <= 0 or cand_price >= current_price:
                        continue
                    candidate_id = str(doc.get("_id", ""))
                    if not candidate_id or candidate_id == current_item.product_id:
                        continue
                    new_total = current_total - current_price + cand_price
                    if new_total <= hard_cap and new_total >= target_floor:
                        primary[idx] = ProductSuggestion(
                            productId=candidate_id,
                            categoryId=self._normalize_category_id(doc.get("categoryId")),
                            slot=slot,
                            name=self._sanitize_text(doc.get("name", "")),
                            price=int(cand_price),
                            image=doc.get("image"),
                            url=doc.get("url"),
                            socket=OrchestratorAgent._extract_socket_from_raw(doc),
                            reason="Ha cap de vua ngan sach",
                        )
                        current_total = new_total
                        replaced = True
                        break

        return primary

    def _has_integrated_graphics_from_raw(self, product_id: str) -> bool:
        """Check if a product has integrated graphics by looking up in DB."""
        if not product_id:
            return False
        try:
            docs = self.db_agent.mongo_service.get_products_by_ids([product_id])
            if docs:
                return self._has_integrated_graphics(docs[0], "")
        except Exception:
            pass
        return False

    def _has_integrated_graphics_from_raw_doc(self, doc: Dict[str, Any]) -> bool:
        """Check if a raw document has integrated graphics."""
        has_igpu = doc.get("has_igpu")
        if isinstance(has_igpu, bool):
            return has_igpu
        
        igpu_name = doc.get("igpu_name")
        if igpu_name and isinstance(igpu_name, str) and igpu_name.strip():
            return True
        
        name = doc.get("name", "")
        return self._has_integrated_graphics(doc, name)
