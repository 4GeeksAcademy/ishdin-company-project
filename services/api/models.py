from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SupplierStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class SupplierCountry(str, Enum):
    USA = "USA"
    SPAIN = "Spain"


class SupplierCurrency(str, Enum):
    USD = "USD"
    EUR = "EUR"


class SupplierCategory(str, Enum):
    CARRIER_LAST_MILE = "carrier_last_mile"
    CARRIER_INTERNATIONAL = "carrier_international"
    WAREHOUSE_SUPPLIES = "warehouse_supplies"
    PACKAGING_MATERIALS = "packaging_materials"
    REVERSE_LOGISTICS = "reverse_logistics"
    FLEET_MAINTENANCE = "fleet_maintenance"
    IT_AND_WMS_SOFTWARE = "it_and_wms_software"
    CLEANING_AND_FACILITIES = "cleaning_and_facilities"


class SupplierBase(BaseModel):
    """Shared TrackFlow supplier fields accepted from the client."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    name: str = Field(..., min_length=1)
    country: SupplierCountry
    categories: list[SupplierCategory] = Field(..., min_length=1)
    rate_per_shipment: float = Field(..., gt=0)
    currency: SupplierCurrency
    status: SupplierStatus

    service_zone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_country_currency(self):
        if self.country == "USA" and self.currency != "USD":
            raise ValueError("USA suppliers must use USD currency.")

        if self.country == "Spain" and self.currency != "EUR":
            raise ValueError("Spain suppliers must use EUR currency.")

        return self


class SupplierCreate(SupplierBase):
    """Input model for POST /suppliers."""
    pass


class Supplier(SupplierBase):
    """Stored supplier model with system-generated update timestamp."""

    updated_at: datetime


class SupplierResponse(Supplier):
    """Response model including TinyDB-assigned ID."""

    id: int = Field(..., gt=0)


class SupplierRateUpdate(BaseModel):
    """Input model for PATCH /suppliers/{id}/rate."""

    rate_per_shipment: float = Field(..., gt=0)


class SupplierStatusUpdate(BaseModel):
    """Input model for PATCH /suppliers/{id}/status."""

    model_config = ConfigDict(use_enum_values=True)

    status: SupplierStatus

class DeleteSupplierResponse(BaseModel):
    """Response returned after deleting a supplier."""

    message: str
    id: int = Field(..., gt=0)