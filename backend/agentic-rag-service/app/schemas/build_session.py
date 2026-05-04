from typing import List, Optional
from pydantic import BaseModel, Field


class BuildComponentPayload(BaseModel):
    slot: str
    product_id: str = Field(alias="productId")
    category_id: Optional[str] = Field(default=None, alias="categoryId")
    name: str
    price: int
    quantity: int = 1
    image: Optional[str] = None
    url: Optional[str] = None
    ram_type: Optional[str] = Field(default=None, alias="ramType")


class BuildComponentResponse(BaseModel):
    slot: str
    product_id: str = Field(alias="productId")
    category_id: Optional[str] = Field(default=None, alias="categoryId")
    name: str
    price: int
    quantity: int
    image: Optional[str] = None
    url: Optional[str] = None
    ram_type: Optional[str] = Field(default=None, alias="ramType")
    selected_at: str = Field(alias="selectedAt")


class BuildSessionResponse(BaseModel):
    session_id: str = Field(alias="sessionId")
    account_id: Optional[str] = Field(default=None, alias="accountId")
    status: str
    total_price: int = Field(alias="totalPrice")
    selected_components: List[BuildComponentResponse] = Field(default_factory=list, alias="selectedComponents")


class CheckoutValidateResponse(BaseModel):
    session_id: str = Field(alias="sessionId")
    ready: bool
    missing_slots: List[str] = Field(default_factory=list, alias="missingSlots")
    total_price: int = Field(alias="totalPrice")
