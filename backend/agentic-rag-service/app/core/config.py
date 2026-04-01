from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = Field(default="agentic-rag-service", alias="APP_NAME")
    app_env: str = Field(default="dev", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8090, alias="APP_PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    react_max_iterations: int = Field(default=4, alias="REACT_MAX_ITERATIONS")
    react_timeout_seconds: int = Field(default=30, alias="REACT_TIMEOUT_SECONDS")
    min_db_evidence_count: int = Field(default=2, alias="MIN_DB_EVIDENCE_COUNT")
    enable_smolagents: bool = Field(default=False, alias="ENABLE_SMOLAGENTS")

    litellm_model: str = Field(default="gpt-4o-mini", alias="LITELLM_MODEL")
    litellm_api_key: str = Field(default="", alias="LITELLM_API_KEY")
    litellm_base_url: str = Field(default="", alias="LITELLM_BASE_URL")
    litellm_temperature: float = Field(default=0.2, alias="LITELLM_TEMPERATURE")

    mongodb_uri: str = Field(default="", alias="MONGODB_URI")
    mongodb_product_database: str = Field(default="product_db", alias="MONGODB_PRODUCT_DATABASE")
    mongodb_product_collection: str = Field(default="products", alias="MONGODB_PRODUCT_COLLECTION")
    mongodb_agent_database: str = Field(default="agentic_rag_db", alias="MONGODB_AGENT_DATABASE")
    chat_histories_collection: str = Field(default="chat_histories", alias="CHAT_HISTORIES_COLLECTION")
    pc_build_sessions_collection: str = Field(default="pc_build_sessions", alias="PC_BUILD_SESSIONS_COLLECTION")
    atlas_text_index: str = Field(default="product_text_idx", alias="ATLAS_TEXT_INDEX")
    atlas_vector_index: str = Field(default="product_vector_idx", alias="ATLAS_VECTOR_INDEX")
    embedding_field: str = Field(default="embedding_vector", alias="EMBEDDING_FIELD")

    text_score_weight: float = Field(default=0.45, alias="TEXT_SCORE_WEIGHT")
    vector_score_weight: float = Field(default=0.55, alias="VECTOR_SCORE_WEIGHT")

    embedding_model: str = Field(
        default="VoVanPhuc/sup-SimCSE-VietNamese-phobert-base",
        alias="EMBEDDING_MODEL",
    )

    web_search_max_results: int = Field(default=5, alias="WEB_SEARCH_MAX_RESULTS")
    required_build_slots: str = Field(
        default="CPU,MAINBOARD,RAM,GPU,SSD,PSU,CASE,COOLER",
        alias="REQUIRED_BUILD_SLOTS",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
