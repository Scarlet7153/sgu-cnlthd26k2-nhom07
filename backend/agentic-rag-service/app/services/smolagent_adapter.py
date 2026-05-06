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
        response = completion(model=self.model_id, api_key=os.environ.get('LITELLM_API_KEY', ''), messages=clean, timeout=120, **extra)
        raw_message = response.choices[0].message
        cnt = raw_message.content
        native_tool_calls = getattr(raw_message, 'tool_calls', None)
        
        tool_calls_local = native_tool_calls
        
        @dataclass
        class Msg:
            content = cnt
            role: str = "assistant"
            tool_calls = tool_calls_local
            raw = raw_message
        return Msg()


class SmolAgentAdapter:
    """Adapter for running smolagents ToolCallingAgent with PC builder tools."""

    def __init__(self, enabled):
        self.enabled = enabled

    def run_react(self, query, context, tools, llm_gateway, result_state=None):
        if not self.enabled:
            return {"answer": "", "products": [], "primary_build": [], "context_update": None}

        from smolagents import ToolCallingAgent

        model = LLMGatewayModelWrapper(llm_gateway)
        agent = ToolCallingAgent(tools=list(tools), model=model, max_steps=1)
        ctx_str = json.dumps(context, default=str, ensure_ascii=False)
        has_selected = isinstance(context, dict) and bool(context.get("selectedComponents"))
        if has_selected:
            # Session upgrade: force build_pc, don't rely on model to choose
            task = (
                f"Context: {ctx_str}\n"
                f"Query: {query}\n\n"
                "CRITICAL: Build a new PC using build_pc with the budget and purpose from the context.\n"
                "Do NOT analyze compatibility. Just call build_pc.\n"
            )
        else:
            task = (
                f"Context: {ctx_str}\n"
                f"Query: {query}\n\n"
                "Rules (follow in order):\n"
                "1. If user asks for specific components (e.g. 'gợi ý Mainboard', 'RAM phù hợp'): call search_products with a descriptive query.\n"
                "2. If budget+purpose given: call build_pc. Map user intent to EXACTLY one of: gaming, office, design, streaming.\n"
                "   - đồ họa/render/video/3D/blender → design\n"
                "   - văn phòng/excel/word/web → office\n"
                "   - game/FPS/esports → gaming\n"
                "   - stream/youtuber/record → streaming\n"
                "3. If budget/purpose missing: call final_answer asking for them.\n"
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
        
        if prod_list:
            parts_lines = "\n".join([f'  - {p["slot"]}: {p["name"]} ({p["price"]:,} VND)' for p in prod_list])
            answer = f"Đã xây dựng PC với tổng chi phí {total:,} VND. Linh kiện:\n{parts_lines}"
        elif result is not None and str(result) not in ("None", ""):
            answer = str(result)
        else:
            answer = "Tôi cần thêm thông tin về ngân sách và nhu cầu của bạn để tư vấn PC phù hợp."
        
        return {"answer": answer, "products": prod_list, "primary_build": prod_list, "context_update": ctx_upd, "total": total}

    def summarize_plan(self, query, context):
        return ""
