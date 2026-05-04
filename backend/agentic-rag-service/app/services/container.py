from app.agents.db_retrieval_agent import DBRetrievalAgent
from app.agents.orchestrator import OrchestratorAgent
from app.agents.web_retrieval_agent import WebRetrievalAgent
from app.core.config import Settings
from app.services.embedding_service import EmbeddingService
from app.services.llm_gateway import LLMGateway
from app.services.chat_history_service import ChatHistoryService
from app.services.mongo_search_service import MongoSearchService
from app.services.pc_build_session_service import PCBuildSessionService
from app.services.smolagent_adapter import SmolAgentAdapter
from app.tools.web_search_tool import WebSearchTool


class ServiceContainer:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

        self.embedding_service = EmbeddingService(model_name=settings.embedding_model)
        self.mongo_search_service = MongoSearchService(
            mongodb_uri=settings.mongodb_uri,
            database=settings.mongodb_product_database,
            collection=settings.mongodb_product_collection,
            text_index=settings.atlas_text_index,
            vector_index=settings.atlas_vector_index,
            embedding_field=settings.embedding_field,
            text_weight=settings.text_score_weight,
            vector_weight=settings.vector_score_weight,
        )
        self.llm_gateway = LLMGateway(
            model=settings.litellm_model,
            api_key=settings.litellm_api_key,
            base_url=settings.litellm_base_url,
            temperature=settings.litellm_temperature,
            timeout_seconds=settings.litellm_timeout_seconds,
            max_tokens=settings.litellm_max_tokens,
        )
        self.smolagent_adapter = SmolAgentAdapter(enabled=settings.enable_smolagents)
        self.chat_history_service = ChatHistoryService(
            mongodb_uri=settings.mongodb_uri,
            database=settings.mongodb_agent_database,
            collection=settings.chat_histories_collection,
        )
        self.pc_build_session_service = PCBuildSessionService(
            mongodb_uri=settings.mongodb_uri,
            database=settings.mongodb_agent_database,
            collection=settings.pc_build_sessions_collection,
            required_slots=settings.required_build_slots.split(","),
            mongo_search_service=self.mongo_search_service,
        )

        self.db_agent = DBRetrievalAgent(
            mongo_service=self.mongo_search_service,
            embedding_service=self.embedding_service,
        )
        self.web_agent = WebRetrievalAgent(tool=WebSearchTool())
        self.orchestrator = OrchestratorAgent(
            llm_gateway=self.llm_gateway,
            smolagent_adapter=self.smolagent_adapter,
            db_agent=self.db_agent,
            web_agent=self.web_agent,
            min_db_evidence_count=settings.min_db_evidence_count,
            default_max_iterations=settings.react_max_iterations,
            default_timeout_seconds=settings.react_timeout_seconds,
        )
