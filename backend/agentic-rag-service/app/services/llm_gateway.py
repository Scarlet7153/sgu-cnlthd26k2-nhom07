from typing import Any, Dict

import httpx
import logging
import time
from litellm import completion


logger = logging.getLogger(__name__)


class LLMGateway:
    def __init__(
        self,
        model: str,
        api_key: str = "",
        base_url: str = "",
        temperature: float = 0.2,
        timeout_seconds: int = 75,
        max_tokens: int = 600,
    ) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.timeout_seconds = timeout_seconds
        self.max_tokens = max_tokens

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if self.model.startswith("ollama/"):
            last_error = None
            for attempt in range(3):
                try:
                    return self._generate_via_ollama_api(system_prompt=system_prompt, user_prompt=user_prompt)
                except Exception as exc:
                    last_error = exc
                    if attempt < 2:
                        time.sleep(6)
            logger.exception("Ollama direct API call failed after 3 retries: %s", last_error)
            return "[LLM fallback] Khong goi duoc provider, da tra ve cau tra loi an toan dua tren bang chung hien co."

        # Fallback local behavior for environments without provider credentials.
        if not self.api_key:
            return "[LLM fallback] Da tiep nhan yeu cau va tong hop theo bang chung truy xuat duoc."

        extra: Dict[str, Any] = {}
        if self.base_url:
            normalized_base_url = self.base_url.rstrip("/")
            if self.model.startswith("ollama/") and normalized_base_url.endswith("/api"):
                normalized_base_url = normalized_base_url[:-4]
            extra["api_base" if self.model.startswith("openai/") else "base_url"] = normalized_base_url

        try:
            for attempt in range(3):
                try:
                    response = completion(
                        model=self.model,
                        api_key=self.api_key,
                        temperature=self.temperature,
                        timeout=self.timeout_seconds,
                        max_tokens=self.max_tokens,
                        messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                        stream=True,
                        **extra,
                    )
                    # Collect streaming response
                    content_parts = []
                    for chunk in response:
                        if chunk.choices and chunk.choices[0].delta:
                            c = chunk.choices[0].delta.content
                            if c:
                                content_parts.append(c)
                    return "".join(content_parts) if content_parts else ""
                except Exception:
                    if attempt == 2:
                        raise
                    time.sleep(1)
        except Exception as exc:
            logger.exception(f"LiteLLM failed after 3 retries: {exc}")
            return "[LLM fallback] Khong goi duoc provider."

    def _generate_via_ollama_api(self, system_prompt: str, user_prompt: str) -> str:
        base = (self.base_url or "https://ollama.com/api").rstrip("/")
        endpoint = f"{base}/chat" if base.endswith("/api") else f"{base}/api/chat"
        model_name = self.model.split("/", 1)[1]

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        msgs = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": user_prompt})

        payload = {
            "model": model_name,
            "messages": msgs,
            "stream": False,
        }

        response = httpx.post(endpoint, headers=headers, json=payload, timeout=self.timeout_seconds)
        response.raise_for_status()
        data = response.json()
        result = data.get("response")
        if isinstance(result, str) and result.strip():
            return result.strip()

        message = data.get("message", {})
        message_content = message.get("content") if isinstance(message, dict) else None
        if isinstance(message_content, str) and message_content.strip():
            return message_content.strip()

        thinking = data.get("thinking")
        if isinstance(thinking, str) and thinking.strip():
            return thinking.strip()

        return "[LLM fallback] Provider response is empty."
