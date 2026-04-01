from app.agents.contracts import AgentObservation, AgentTask
from app.tools.web_search_tool import WebSearchTool


class WebRetrievalAgent:
    name = "web_retrieval"

    def __init__(self, tool: WebSearchTool) -> None:
        self.tool = tool

    def run(self, task: AgentTask) -> AgentObservation:
        try:
            evidences = self.tool.search(task.query, task.max_results)
            return AgentObservation(
                success=True,
                action="web_search",
                message=f"Retrieved {len(evidences)} evidences from web",
                evidences=evidences,
            )
        except Exception as exc:
            return AgentObservation(
                success=False,
                action="web_search",
                message=f"Web retrieval failed: {exc}",
                evidences=[],
            )
