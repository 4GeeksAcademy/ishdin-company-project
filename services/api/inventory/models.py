from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import CheckConstraint, Column, DateTime, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SKU(SQLModel, table=True):
    __tablename__ = "skus"
    __table_args__ = (
        UniqueConstraint("sku", "warehouse", name="uq_sku_warehouse"),
        CheckConstraint(
            "category IN ('fashion', 'electronics', 'cosmetics')",
            name="ck_sku_category",
        ),
        CheckConstraint(
            "warehouse IN ('LA', 'ZGZ')",
            name="ck_sku_warehouse",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    sku: str = Field(index=True)
    client_name: str = Field(index=True)
    category: str = Field(index=True)
    warehouse: str = Field(index=True)

    stock_entries: list["StockEntry"] = Relationship(back_populates="sku_record")
    stock_exits: list["StockExit"] = Relationship(back_populates="sku_record")


class StockEntry(SQLModel, table=True):
    __tablename__ = "stock_entries"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_entry_quantity_positive"),
        CheckConstraint(
            "warehouse IN ('LA', 'ZGZ')",
            name="ck_stock_entry_warehouse",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    quantity: int
    reference: str = Field(index=True)
    warehouse: str = Field(index=True)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    # References a TinyDB user UUID. Intentionally NOT a PostgreSQL foreign key.
    user_uuid: str = Field(index=True)

    sku_record: Optional[SKU] = Relationship(back_populates="stock_entries")


class StockExit(SQLModel, table=True):
    __tablename__ = "stock_exits"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_exit_quantity_positive"),
        CheckConstraint(
            "exit_type IN ('dispatch', 'loss')",
            name="ck_stock_exit_type",
        ),
        CheckConstraint(
            "warehouse IN ('LA', 'ZGZ')",
            name="ck_stock_exit_warehouse",
        ),
        CheckConstraint(
            "(exit_type = 'dispatch' AND tracking_number IS NOT NULL) "
            "OR (exit_type = 'loss' AND tracking_number IS NULL)",
            name="ck_stock_exit_tracking_number",
        ),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    sku_id: int = Field(foreign_key="skus.id", index=True)
    quantity: int
    exit_type: str = Field(index=True)
    tracking_number: Optional[str] = Field(default=None, index=True)
    warehouse: str = Field(index=True)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    # References a TinyDB user UUID. Intentionally NOT a PostgreSQL foreign key.
    user_uuid: str = Field(index=True)

    sku_record: Optional[SKU] = Relationship(back_populates="stock_exits")
