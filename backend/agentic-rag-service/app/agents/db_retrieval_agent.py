from app.agents.contracts import AgentObservation, AgentTask
from app.services.embedding_service import EmbeddingService
from app.services.mongo_search_service import MongoSearchService


class DBRetrievalAgent:
    name = "db_retrieval"

    def __init__(self, mongo_service: MongoSearchService, embedding_service: EmbeddingService) -> None:
        self.mongo_service = mongo_service
        self.embedding_service = embedding_service

    def run(self, task: AgentTask) -> AgentObservation:
        try:
            retrieval_query = self._compose_retrieval_query(task.query, task.context)
            vector = self.embedding_service.embed(retrieval_query)
            evidences = self.mongo_service.hybrid_search(retrieval_query, vector, limit=task.max_results)
            return AgentObservation(
                success=True,
                action="hybrid_search",
                message=f"Retrieved {len(evidences)} evidences from internal DB",
                evidences=evidences,
            )
        except Exception as exc:
            return AgentObservation(
                success=False,
                action="hybrid_search",
                message=f"DB retrieval failed: {exc}",
                evidences=[],
            )

    @staticmethod
    def _compose_retrieval_query(query: str, context: dict) -> str:
        # Improve lexical hit-rate by appending user constraints when available.
        extras = []
        for key in ("brand", "purpose", "budget"):
            value = context.get(key)
            if isinstance(value, str) and value.strip():
                extras.append(value.strip())

        if not extras:
            return query

        return f"{query} | {' | '.join(extras)}"
