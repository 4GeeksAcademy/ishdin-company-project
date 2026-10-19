from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Warehouse(str, Enum):
    LA = "LA"
    ZGZ = "ZGZ"


class Category(str, Enum):
    FASHION = "fashion"
    ELECTRONICS = "electronics"
    COSMETICS = "cosmetics"


class ExitType(str, Enum):
    DISPATCH = "dispatch"
    LOSS = "loss"


class RequestSchema(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class SKUCreate(RequestSchema):
    name: str = Field(min_length=1, max_length=200)
    sku: str = Field(min_length=1, max_length=100)
    client_name: str = Field(min_length=1, max_length=200)
    category: Category
    warehouse: Warehouse


class SKUResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    client_name: str
    category: Category
    warehouse: Warehouse
    # Computed from movements. Never stored in the SKU table.
    current_stock: int


class StockEntryCreate(RequestSchema):
    sku_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    reference: str = Field(min_length=1, max_length=150)
    warehouse: Warehouse


class StockEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_id: int
    quantity: int
    reference: str
    warehouse: Warehouse
    created_at: datetime
    user_uuid: str


class StockExitCreate(RequestSchema):
    sku_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    exit_type: ExitType
    tracking_number: Optional[str] = Field(default=None, max_length=150)
    warehouse: Warehouse

    @model_validator(mode="after")
    def validate_tracking_number(self):
        if self.exit_type == ExitType.DISPATCH and not self.tracking_number:
            raise ValueError("tracking_number is required when exit_type is 'dispatch'.")
        if self.exit_type == ExitType.LOSS and self.tracking_number is not None:
            raise ValueError("tracking_number must be null when exit_type is 'loss'.")
        return self


class StockExitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku_id: int
    quantity: int
    exit_type: ExitType
    tracking_number: Optional[str]
    warehouse: Warehouse
    created_at: datetime
    user_uuid: str


class OrderSKUResponse(BaseModel):
    id: int
    name: str
    sku: str
    client_name: str
    category: Category
    warehouse: Warehouse


class OrderResponse(BaseModel):
    order_type: str
    id: int
    sku_id: int
    quantity: int
    warehouse: Warehouse
    created_at: datetime
    user_uuid: str
    sku: OrderSKUResponse

    # Inbound-only field
    reference: Optional[str] = None

    # Outbound-only fields
    exit_type: Optional[ExitType] = None
    tracking_number: Optional[str] = None
