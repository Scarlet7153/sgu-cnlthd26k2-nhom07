from typing import Dict


class SmolAgentAdapter:
    """
    Optional adapter for SmolAgents CodeAgent.
    This keeps the integration boundary ready while allowing safe fallback in environments
    that do not yet provide model/tool credentials.
    """

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled

    def summarize_plan(self, query: str, context: Dict[str, object]) -> str:
        if not self.enabled:
            return ""

        try:
            # Lazy import so service can still run even when smolagents runtime is not configured.
            from smolagents import CodeAgent

            # Minimal placeholder execution for ReAct-style planning summary.
            agent = CodeAgent(tools=[])
            prompt = (
                "Create a short retrieval plan for this user query. "
                f"Query: {query}. Context: {context}. "
                "Respond with one concise sentence."
            )
            result = agent.run(prompt)
            return str(result or "")
        except Exception:
            return ""
