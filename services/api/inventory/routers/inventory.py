from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from ..database import get_db
from ..models import SKU, StockEntry, StockExit
from ..schemas import (
    OrderResponse,
    OrderSKUResponse,
    SKUCreate,
    SKUResponse,
    StockEntryCreate,
    StockEntryResponse,
    StockExitCreate,
    StockExitResponse,
)

# Reuse the AUTH-01 dependency registered by the main API.
from auth.dependencies import get_current_user

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _user_uuid(current_user: Any) -> str:
    """Extract the TinyDB user's UUID without coupling inventory to a SQL User model."""
    if isinstance(current_user, dict):
        value = (
            current_user.get("id")
            or current_user.get("user_uuid")
            or current_user.get("uuid")
        )
    else:
        value = (
            getattr(current_user, "id", None)
            or getattr(current_user, "user_uuid", None)
            or getattr(current_user, "uuid", None)
        )

    if not value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user UUID is missing.",
        )
    return str(value)


def _get_sku_or_404(session: Session, sku_id: int, *, lock: bool = False) -> SKU:
    statement = select(SKU).where(SKU.id == sku_id)
    if lock:
        # Serializes movements for this SKU so concurrent outbound writes cannot
        # both pass the stock check using the same starting quantity.
        statement = statement.with_for_update()

    sku = session.exec(statement).first()
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found.")
    return sku


def _compute_current_stock(session: Session, sku_id: int, warehouse: str) -> int:
    inbound = session.exec(
        select(func.coalesce(func.sum(StockEntry.quantity), 0)).where(
            StockEntry.sku_id == sku_id,
            StockEntry.warehouse == warehouse,
        )
    ).one()

    outbound = session.exec(
        select(func.coalesce(func.sum(StockExit.quantity), 0)).where(
            StockExit.sku_id == sku_id,
            StockExit.warehouse == warehouse,
        )
    ).one()

    return int(inbound or 0) - int(outbound or 0)


def _sku_response(session: Session, sku: SKU) -> SKUResponse:
    return SKUResponse(
        id=sku.id,
        name=sku.name,
        sku=sku.sku,
        client_name=sku.client_name,
        category=sku.category,
        warehouse=sku.warehouse,
        current_stock=_compute_current_stock(session, sku.id, sku.warehouse),
    )


@router.get("/products", response_model=list[SKUResponse])
def list_products(db: Session = Depends(get_db)):
    products = db.exec(select(SKU).order_by(SKU.id)).all()
    return [_sku_response(db, product) for product in products]


@router.post(
    "/products",
    response_model=SKUResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    payload: SKUCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    # Dependency intentionally enforces auth even though SKU has no user_uuid field.
    _user_uuid(current_user)

    duplicate = db.exec(
        select(SKU).where(
            SKU.sku == payload.sku,
            SKU.warehouse == payload.warehouse.value,
        )
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"SKU '{payload.sku}' already exists in warehouse '{payload.warehouse.value}'.",
        )

    product = SKU(**payload.model_dump(mode="json"))
    db.add(product)
    db.commit()
    db.refresh(product)

    # New product starts at zero because stock is movement-derived only.
    return _sku_response(db, product)


@router.get("/products/{id}", response_model=SKUResponse)
def get_product(id: int, db: Session = Depends(get_db)):
    product = _get_sku_or_404(db, id)
    return _sku_response(db, product)


@router.post(
    "/orders/inbound",
    response_model=StockEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inbound_order(
    payload: StockEntryCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    product = _get_sku_or_404(db, payload.sku_id, lock=True)

    if product.warehouse != payload.warehouse.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Warehouse mismatch for SKU '{product.sku}'. "
                f"SKU warehouse: {product.warehouse}, order warehouse: {payload.warehouse.value}."
            ),
        )

    entry = StockEntry(
        **payload.model_dump(mode="json"),
        user_uuid=_user_uuid(current_user),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return StockEntryResponse.model_validate(entry)


@router.post(
    "/orders/outbound",
    response_model=StockExitResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_outbound_order(
    payload: StockExitCreate,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    product = _get_sku_or_404(db, payload.sku_id, lock=True)

    if product.warehouse != payload.warehouse.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Warehouse mismatch for SKU '{product.sku}'. "
                f"SKU warehouse: {product.warehouse}, order warehouse: {payload.warehouse.value}."
            ),
        )

    available = _compute_current_stock(db, product.id, product.warehouse)
    if payload.quantity > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient stock for SKU '{product.sku}'. "
                f"Available: {available}, requested: {payload.quantity}."
            ),
        )

    stock_exit = StockExit(
        **payload.model_dump(mode="json"),
        user_uuid=_user_uuid(current_user),
    )
    db.add(stock_exit)
    db.commit()
    db.refresh(stock_exit)

    return StockExitResponse.model_validate(stock_exit)


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    results: list[OrderResponse] = []

    inbound_rows = db.exec(
        select(StockEntry, SKU)
        .join(SKU, SKU.id == StockEntry.sku_id)
        .order_by(StockEntry.created_at.desc())
    ).all()

    for entry, sku in inbound_rows:
        results.append(
            OrderResponse(
                order_type="inbound",
                id=entry.id,
                sku_id=entry.sku_id,
                quantity=entry.quantity,
                warehouse=entry.warehouse,
                created_at=entry.created_at,
                user_uuid=entry.user_uuid,
                reference=entry.reference,
                sku=OrderSKUResponse(
                    id=sku.id,
                    name=sku.name,
                    sku=sku.sku,
                    client_name=sku.client_name,
                    category=sku.category,
                    warehouse=sku.warehouse,
                ),
            )
        )

    outbound_rows = db.exec(
        select(StockExit, SKU)
        .join(SKU, SKU.id == StockExit.sku_id)
        .order_by(StockExit.created_at.desc())
    ).all()

    for stock_exit, sku in outbound_rows:
        results.append(
            OrderResponse(
                order_type="outbound",
                id=stock_exit.id,
                sku_id=stock_exit.sku_id,
                quantity=stock_exit.quantity,
                warehouse=stock_exit.warehouse,
                created_at=stock_exit.created_at,
                user_uuid=stock_exit.user_uuid,
                exit_type=stock_exit.exit_type,
                tracking_number=stock_exit.tracking_number,
                sku=OrderSKUResponse(
                    id=sku.id,
                    name=sku.name,
                    sku=sku.sku,
                    client_name=sku.client_name,
                    category=sku.category,
                    warehouse=sku.warehouse,
                ),
            )
        )

    # Unified movement timeline, newest first.
    results.sort(key=lambda item: item.created_at, reverse=True)
    return results
