"""SmolAgent adapter for ReAct-based PC building agent."""
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass
import json
import logging
import re
import os

logger = logging.getLogger(__name__)


@dataclass
class FakeMessage:
    content: str
    role: str = "assistant"
    tool_calls = None


class FakeToolCall:
    def __init__(self, name, arguments):
        self.id = "call_1"
        self.type = "function"
        self.function = type('obj', (object,), {'name': name, 'arguments': arguments})()


class LLMGatewayModelWrapper:
    """Wraps LLMGateway to implement smolagents Model interface."""

    def __init__(self, llm_gateway):
        self.gateway = llm_gateway
        self.model_id = llm_gateway.model if hasattr(llm_gateway, 'model') else "unknown"

    def __call__(self, messages, **kwargs):
        if self.model_id.startswith("ollama/"):
            return self._call_via_gateway(messages)
        return self._call_via_completion(messages, kwargs)

    def _call_via_gateway(self, messages):
        system_prompt = ""
        user_prompt = ""
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            if not isinstance(content, str):
                content = str(content)
            if role == "system":
                system_prompt = content
            elif role == "user":
                user_prompt = content
        if not system_prompt and not user_prompt:
            for msg in messages:
                content = msg.get("content", "")
                if isinstance(content, list):
                    content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
                if content:
                    user_prompt = str(content)
                    break
        response_text = self.gateway.generate(system_prompt=system_prompt, user_prompt=user_prompt)
        
        # Parse multiple function call formats
        msg = FakeMessage(content=response_text)
        tc = None
        # Format 1: <minimax:tool_call><invoke name="fn"><parameter name="k">v</parameter></invoke>
        m = re.search(r'<invoke\s+name="(\w+)"\s*>(.*?)</invoke>', response_text, re.DOTALL)
        if m:
            fn = m.group(1)
            args_text = m.group(2)
            parsed = {}
            for pm in re.finditer(r'<parameter\s+name="(\w+)"\s*>([^<]*)</parameter>', args_text):
                k, v = pm.group(1), pm.group(2).strip()
                try: v = float(v) if '.' in v or v.isdigit() else v
                except: pass
                parsed[k] = v
            if parsed:
                tc = [FakeToolCall(fn, json.dumps(parsed))]
        # Format 2: <FunctionCall>name\nkey="val"\n</FunctionCall>
        if not tc:
            m = re.search(r'<FunctionCall>\s*(\w+)\s*\n(.*?)</FunctionCall>', response_text, re.DOTALL)
            if m:
                fn = m.group(1)
                parsed = {}
                for line in m.group(2).split('\n'):
                    line = line.strip()
                    if '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        try: v = float(v) if '.' in v or v.isdigit() else v
                        except: pass
                        parsed[k] = v
                if parsed:
                    tc = [FakeToolCall(fn, json.dumps(parsed))]
        # Format 3: ```python fn(k=v, ...) ```
        if not tc:
            m = re.search(r'```(?:python)?\s*\n?\s*(\w+)\(([^)]*)\)', response_text)
            if m:
                fn = m.group(1)
                parsed = {}
                for a in m.group(2).split(','):
                    a = a.strip()
                    if '=' in a:
                        k, v = a.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        try: v = float(v) if '.' in v or v.isdigit() else v
                        except: pass
                        parsed[k] = v
                if parsed:
                    tc = [FakeToolCall(fn, json.dumps(parsed))]
        if tc:
            msg.tool_calls = tc
        return msg

    def _call_via_completion(self, messages, extra_kwargs=None):
        from litellm import completion
        import os
        import json
        
        valid_roles = {"system", "user", "assistant", "tool", "function"}
        clean = []
        for m in messages:
            role = str(m.get("role", "user"))
            if role not in valid_roles:
                role = "user"
            content = m.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            clean.append({"role": role, "content": str(content)})
        
        extra = {}
        base_url = os.environ.get('LITELLM_BASE_URL', '')
        if base_url:
            extra["api_base" if self.model_id.startswith("openai/") else "base_url"] = base_url.rstrip("/")
        if extra_kwargs and "tools_to_call_from" in extra_kwargs:
            tools_raw = extra_kwargs["tools_to_call_from"]
            converted = []
            for t in tools_raw:
                name = getattr(t, 'name', '')
                desc = getattr(t, 'description', '')
                inputs = getattr(t, 'inputs', {})
                required_list = getattr(t, 'required', [])
                props = {}
                required = []
                for pname, pinfo in inputs.items():
                    if isinstance(pinfo, dict):
                        ptype = {'str': 'string', 'int': 'number', 'float': 'number'}.get(pinfo.get('type', ''), pinfo.get('type', 'string'))
                        entry = {'type': ptype}
                        if 'description' in pinfo:
                            entry['description'] = pinfo['description']
                        if pinfo.get('enum'):
                            entry['enum'] = pinfo['enum']
                        props[pname] = entry
                        if pname in required_list:
                            required.append(pname)
                converted.append({
                    'type': 'function',
                    'function': {
                        'name': name,
                        'description': desc,
                        'parameters': {'type': 'object', 'properties': props, 'required': required}
                    }
                })
            if converted:
                extra["tools"] = converted
        # Some models ignore tools when system role is present (gpt-5.x on chiasegpu)
        # Only merge for models known to need it, not for models that work with system+tools
        needs_merge = any(x in self.model_id.lower() for x in ("gpt-5.", "gpt-4."))
        if extra.get("tools") and needs_merge:
            system_msgs = [m for m in clean if m["role"] == "system"]
            if system_msgs:
                sys_content = system_msgs[0]["content"]
                clean = [m for m in clean if m["role"] != "system"]
                for m in clean:
                    if m["role"] == "user":
                        m["content"] = sys_content + "\n\n" + m["content"]
                        break
        response = completion(model=self.model_id, api_key=os.environ.get('LITELLM_API_KEY', ''), messages=clean, timeout=120, temperature=0, stream=True, **extra)
        # Collect streaming chunks
        raw_message = None
        content_parts = []
        tool_calls_by_id = {}
        for chunk in response:
            if chunk.choices and chunk.choices[0].delta:
                delta = chunk.choices[0].delta
                c = delta.content
                if c:
                    content_parts.append(c)
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index if tc.index is not None else 0
                        if idx not in tool_calls_by_id:
                            tool_calls_by_id[idx] = {'id': tc.id or '', 'name': '', 'arguments': ''}
                        if tc.id:
                            tool_calls_by_id[idx]['id'] = tc.id
                        if tc.function and tc.function.name:
                            tool_calls_by_id[idx]['name'] += tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls_by_id[idx]['arguments'] += tc.function.arguments
        # Build fake message
        from dataclasses import dataclass
        @dataclass
        class Msg:
            content: str = ""
            role: str = "assistant"
            tool_calls: list = None
            raw: object = None
        cnt = "".join(content_parts)
        raw_message = response if hasattr(response, 'choices') else None
        tool_calls_local = None
        if tool_calls_by_id:
            converted = []
            for tc in sorted(tool_calls_by_id.values(), key=lambda x: list(tool_calls_by_id.keys())[0]):
                converted.append(FakeToolCall(tc['name'], tc['arguments']))
            tool_calls_local = converted
        return Msg(content=cnt, tool_calls=tool_calls_local, raw=raw_message)


class SmolAgentAdapter:
    """Adapter for running smolagents ToolCallingAgent with PC builder tools."""

    def __init__(self, enabled):
        self.enabled = enabled

    def run_react(self, query, context, tools, llm_gateway, result_state=None):
        if not self.enabled:
            return {"answer": "", "products": [], "primary_build": [], "context_update": None}

        from smolagents import ToolCallingAgent

        model = LLMGatewayModelWrapper(llm_gateway)
        ctx_str = json.dumps(context, default=str, ensure_ascii=False)
        agent = ToolCallingAgent(tools=list(tools), model=model, max_steps=1)
        
        task = (
            f"Context: {ctx_str}\n"
            f"Query: {query}\n\n"
            "Rules (follow in order):\n"
            "1. If user asks about a specific product or component — price, availability, "
            "recommendations, comparisons (e.g. 'RTX 4060 giá bao nhiêu', 'gợi ý Mainboard', "
            "'RAM DDR5 nào tốt', 'i5-13600K bao nhiêu tiền'): "
            "call search_products with slot=<component type> and a descriptive query.\n"
            "2. If user wants to REPLACE/SWAP a component (e.g. 'đổi GPU', 'thay case', "
            "'bỏ PSU', 'case này xấu'): call find_replacements.\n"
            "   - Pass current_build_json with the selected components from context.\n"
            "3. If user wants to BUILD/LAP/UPGRADE PC:\n"
            "   - FIRST check Context JSON for budget/budgetExact and purpose fields.\n"
            "   - If BOTH budget (or budgetExact) AND purpose exist in Context: call build_pc immediately.\n"
            "   - If budget is missing: call final_answer asking for budget only (do NOT ask purpose if already in Context).\n"
            "   - If purpose is missing: call final_answer asking for purpose only (do NOT ask budget if already in Context).\n"
            "   - When calling build_pc, map purpose to EXACTLY one of: gaming, office, design, streaming.\n"
            "     đồ họa/render/video/3D/blender → design\n"
            "     văn phòng/excel/word/web → office\n"
            "     game/FPS/esports/chơi game → gaming\n"
            "     stream/youtuber/record → streaming\n"
            "4. If user asks conceptual/educational questions unrelated to specific products "
            "(e.g. 'CPU là gì', 'DDR4 và DDR5 khác nhau thế nào'): call final_answer to answer directly.\n"
            "   Do NOT use final_answer for product price or availability — use search_products instead.\n"
            "Budget ranges: '25-30 trieu' -> budget=30000000 budget_min=25000000.\n"
        )
        result = agent.run(task)

        data = result_state[0] if result_state else {}
        prod_list = data.get("products", data.get("primary_build", []))
        total = data.get("total", 0)
        budget_exact = data.get("budgetExact", 0)
        ctx_upd = data.get("context_update")
        if ctx_upd is None and budget_exact:
            purpose = context.get("purpose", "gaming") if isinstance(context, dict) else "gaming"
            ctx_upd = {"budget": str(budget_exact), "purpose": purpose, "budgetExact": budget_exact}

        # Always propagate known context (purpose/budget) even when LLM is asking for missing info
        if ctx_upd is None and isinstance(context, dict):
            known_purpose = context.get("purpose")
            known_budget = context.get("budgetExact") or context.get("budget")
            if known_purpose or known_budget:
                ctx_upd = {}
                if known_purpose:
                    ctx_upd["purpose"] = known_purpose
                if known_budget:
                    if isinstance(known_budget, (int, float)):
                        ctx_upd["budgetExact"] = int(known_budget)
                    else:
                        ctx_upd["budget"] = str(known_budget)

        # Auto-extract purpose/budget from query when context is empty
        if ctx_upd is None and isinstance(context, dict) and not context.get("purpose") and not context.get("budgetExact") and not context.get("budget"):
            query_lower = query.lower()
            auto_purpose = None
            if any(w in query_lower for w in ["chơi game", "gaming", "game", "fps", "esports"]):
                auto_purpose = "gaming"
            elif any(w in query_lower for w in ["đồ họa", "do hoa", "render", "video", "3d", "blender", "photoshop", "thiết kế", "thiet ke"]):
                auto_purpose = "design"
            elif any(w in query_lower for w in ["văn phòng", "van phong", "excel", "word", "học tập", "duyet web", "office"]):
                auto_purpose = "office"
            elif any(w in query_lower for w in ["stream", "youtuber", "record", "phát sóng", "content creator"]):
                auto_purpose = "streaming"

            import re
            budget_match = re.search(r'(\d+)\s*(triệu|trieu|tr|million|m)\b', query_lower)
            auto_budget = None
            if budget_match:
                amount = int(budget_match.group(1))
                if amount < 1000:
                    auto_budget = amount * 1_000_000
                else:
                    auto_budget = amount

            if auto_purpose or auto_budget:
                ctx_upd = {}
                if auto_purpose:
                    ctx_upd["purpose"] = auto_purpose
                if auto_budget:
                    ctx_upd["budgetExact"] = auto_budget
                    ctx_upd["budget"] = f"{auto_budget // 1_000_000} trieu"

        is_search_query = result is not None and "Tìm thấy" in str(result)

        import re
        def strip_markdown(text):
            text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
            text = re.sub(r'\*(.+?)\*', r'\1', text)
            text = re.sub(r'__(.+?)__', r'\1', text)
            text = re.sub(r'_(.+?)_', r'\1', text)
            text = re.sub(r'~~(.+?)~~', r'\1', text)
            return text

        # Handle case where LLM outputs JSON instead of plain text (e.g. when final_answer tool missing)
        result_str = str(result) if result is not None else ""
        try:
            parsed_json = json.loads(result_str)
            if isinstance(parsed_json, dict) and "answer" in parsed_json:
                result_str = parsed_json["answer"]
        except (json.JSONDecodeError, TypeError):
            pass

        if is_search_query:
            answer = strip_markdown(result_str)
            if result_state and len(result_state) > 0:
                result_state[0] = {"products": prod_list, "total": 0}
        else:
            if result_str and len(result_str) > 20 and "giá" in result_str.lower():
                answer = strip_markdown(result_str)
                if result_state and len(result_state) > 0:
                    result_state[0] = {"products": prod_list, "total": 0}
            elif prod_list:
                if result_str and result_str not in ("None", ""):
                    answer = strip_markdown(result_str)
                else:
                    parts_lines = "\n".join([f'  - {p["slot"]}: {p["name"]} ({p["price"]:,} VND)' for p in prod_list])
                    answer = f"Đã xây dựng PC với tổng chi phí {total:,} VND. Linh kiện:\n{parts_lines}"
            elif result_str and result_str not in ("None", ""):
                answer = strip_markdown(result_str)
            else:
                answer = "Tôi cần thêm thông tin về ngân sách và nhu cầu của bạn để tư vấn PC phù hợp."

        return {"answer": answer, "products": prod_list, "primary_build": prod_list, "context_update": ctx_upd, "total": total}

    def summarize_plan(self, query, context):
        return ""
