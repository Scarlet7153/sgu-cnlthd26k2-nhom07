from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatOptions(BaseModel):
    max_iterations: Optional[int] = Field(default=None, alias="maxIterations")
    enable_web_fallback: bool = Field(default=True, alias="enableWebFallback")


class ChatRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    account_id: Optional[str] = Field(default=None, alias="accountId")
    query: str
    context: Dict[str, Any] = Field(default_factory=dict)
    options: ChatOptions = Field(default_factory=ChatOptions)


class ChatContextUpdateRequest(BaseModel):
    session_id: str = Field(alias="sessionId")
    account_id: Optional[str] = Field(default=None, alias="accountId")
    context: Dict[str, Any] = Field(default_factory=dict)


class ProductSuggestion(BaseModel):
    product_id: str = Field(alias="productId")
    category_id: Optional[str] = Field(default=None, alias="categoryId")
    slot: Optional[str] = None
    name: str
    price: Optional[int] = None
    image: Optional[str] = None
    url: Optional[str] = None
    reason: Optional[str] = None


class Citation(BaseModel):
    source: Literal["db", "web"]
    title: str
    url: Optional[str] = None
    score: float = 0.0
    snippet: Optional[str] = None


class AgentActionTrace(BaseModel):
    agent: str
    action: str
    status: Literal["success", "error", "skipped"]
    observation: str


class ChatTrace(BaseModel):
    iterations: int = 0
    actions: List[AgentActionTrace] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    confidence: float = 0.0
    products: List[ProductSuggestion] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)
    trace: ChatTrace


class ChatContextUpdateResponse(BaseModel):
    status: Literal["ok"]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
