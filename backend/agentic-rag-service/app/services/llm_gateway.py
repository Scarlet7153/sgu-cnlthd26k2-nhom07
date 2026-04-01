from typing import Any, Dict

import httpx
import logging
from litellm import completion


logger = logging.getLogger(__name__)


class LLMGateway:
    def __init__(
        self,
        model: str,
        api_key: str = "",
        base_url: str = "",
        temperature: float = 0.2,
    ) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if self.model.startswith("ollama/"):
            try:
                return self._generate_via_ollama_api(system_prompt=system_prompt, user_prompt=user_prompt)
            except Exception as exc:
                logger.exception("Ollama direct API call failed: %s", exc)
                return "[LLM fallback] Khong goi duoc provider, da tra ve cau tra loi an toan dua tren bang chung hien co."

        # Fallback local behavior for environments without provider credentials.
        if not self.api_key:
            return "[LLM fallback] Da tiep nhan yeu cau va tong hop theo bang chung truy xuat duoc."

        extra: Dict[str, Any] = {}
        if self.base_url:
            normalized_base_url = self.base_url.rstrip("/")
            # LiteLLM's Ollama provider appends /api/generate itself.
            # If users configure .../api from docs, trim it to avoid /api/api/generate.
            if self.model.startswith("ollama/") and normalized_base_url.endswith("/api"):
                normalized_base_url = normalized_base_url[:-4]
            extra["base_url"] = normalized_base_url

        try:
            response = completion(
                model=self.model,
                api_key=self.api_key,
                temperature=self.temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                **extra,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.exception("LiteLLM call failed: %s", exc)
            return "[LLM fallback] Khong goi duoc provider, da tra ve cau tra loi an toan dua tren bang chung hien co."

    def _generate_via_ollama_api(self, system_prompt: str, user_prompt: str) -> str:
        base = (self.base_url or "http://localhost:11434/api").rstrip("/")
        endpoint = f"{base}/generate" if base.endswith("/api") else f"{base}/api/generate"
        model_name = self.model.split("/", 1)[1]

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": model_name,
            "prompt": f"{system_prompt}\n\n{user_prompt}",
            "stream": False,
            "options": {"temperature": self.temperature},
        }

        response = httpx.post(endpoint, headers=headers, json=payload, timeout=240)
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
