from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ChatOptions(BaseModel):
    max_iterations: Optional[int] = Field(default=None, alias="maxIterations")
    enable_web_fallback: bool = Field(default=False, alias="enableWebFallback")


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
    ram_type: Optional[Any] = Field(default=None, alias="ramType")
    socket: Optional[str] = None
    chipset: Optional[str] = None
    vram_gb: Optional[int] = Field(default=None, alias="vramGb")
    capacity_gb: Optional[int] = Field(default=None, alias="capacityGb")
    wattage_w: Optional[int] = Field(default=None, alias="wattageW")
    efficiency: Optional[str] = None


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


class ChatContext(BaseModel):
    budget: Optional[str] = None
    purpose: Optional[str] = None
    brand: Optional[str] = None
    budget_exact: Optional[int] = Field(default=None, alias="budgetExact")


class ChatResponse(BaseModel):
    answer: str
    confidence: float = 0.0
    products: List[ProductSuggestion] = Field(default_factory=list)
    primary_build: List[ProductSuggestion] = Field(default_factory=list, alias="primaryBuild")
    alternatives_by_slot: Dict[str, List[ProductSuggestion]] = Field(default_factory=dict, alias="alternativesBySlot")
    estimated_build_total: Optional[int] = Field(default=None, alias="estimatedBuildTotal")
    budget_status: Optional[Literal["within_budget", "near_budget", "over_budget", "under_budget"]] = Field(
        default=None,
        alias="budgetStatus",
    )
    citations: List[Citation] = Field(default_factory=list)
    context_update: Optional[ChatContext] = Field(default=None, alias="contextUpdate")
    trace: ChatTrace


class ChatContextUpdateResponse(BaseModel):
    status: Literal["ok"]


class ErrorResponse(BaseModel):
    error_code: str
    message: str
