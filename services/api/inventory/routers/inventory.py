from typing import Any
from services.api.cache import app_cache
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    status,
)
from fastapi.responses import JSONResponse
from uuid import uuid4
from sqlalchemy import func
from sqlmodel import Session, select

from ..database import get_db
from ..models import SKU, StockEntry, StockExit
from ..schemas import (
    DirectStockEditAttempt,
    InventoryAuditRequest,
    InventoryAuditResponse,
    OrderResponse,
    OrderSKUResponse,
    SKUCreate,
    SKUResponse,
    StockEntryCreate,
    StockEntryResponse,
    StockExitCreate,
    StockExitResponse,
)
from services.api.telemetry.emitter import track_server_event
# Reuse the AUTH-01 dependency registered by the main API.
from auth.dependencies import get_current_user

router = APIRouter(prefix="/inventory", tags=["inventory"])
PRODUCTS_CACHE_KEY = "inventory:products"
PRODUCTS_CACHE_TTL_SECONDS = 30
ORDERS_CACHE_KEY = "inventory:orders"
ORDERS_CACHE_TTL_SECONDS = 60
STOCK_THRESHOLD_QUANTITY = 10

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

def _telemetry_warehouse(
    warehouse: str,
) -> str:
    return (
        "los_angeles"
        if warehouse == "LA"
        else "zaragoza"
    )


def _telemetry_country(
    warehouse: str,
) -> str:
    return (
        "US"
        if warehouse == "LA"
        else "ES"
    )


def _telemetry_client_id(
    client_name: str,
) -> str:
    return "-".join(
        client_name
        .strip()
        .lower()
        .split()
    )


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
    cached_products = app_cache.get(PRODUCTS_CACHE_KEY)

    if cached_products is not None:
        return cached_products

    products = db.exec(
        select(SKU).order_by(SKU.id)
    ).all()

    response = [
        _sku_response(db, product)
        for product in products
    ]

    app_cache.set(
        PRODUCTS_CACHE_KEY,
        response,
        ttl_seconds=PRODUCTS_CACHE_TTL_SECONDS,
    )

    return response


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
    app_cache.delete(PRODUCTS_CACHE_KEY)
    app_cache.delete(ORDERS_CACHE_KEY)
    db.refresh(product)

    # New product starts at zero because stock is movement-derived only.
    return _sku_response(db, product)


@router.get("/products/{id}", response_model=SKUResponse)
def get_product(id: int, db: Session = Depends(get_db)):
    product = _get_sku_or_404(db, id)
    return _sku_response(db, product)

@router.patch("/products/{id}/stock")
def reject_direct_stock_edit(
    id: int,
    payload: DirectStockEditAttempt,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Direct stock modification is intentionally forbidden.

    TrackFlow stock may change only through inbound and
    outbound inventory movements.
    """

    product = _get_sku_or_404(
        db,
        id,
    )

    user_uuid = _user_uuid(
        current_user,
    )

    request_id = (
        request.headers.get("X-Request-ID")
        or str(uuid4())
    )

    properties = {
        "warehouse":
            _telemetry_warehouse(
                product.warehouse,
            ),

        "client_id":
            _telemetry_client_id(
                product.client_name,
            ),

        # Telemetry product_id means business SKU.
        "product_id":
            product.sku,

        "product_category":
            product.category,

        "quantity":
            payload.quantity,

        "attempted_operation":
            payload.attempted_operation,

        "country":
            _telemetry_country(
                product.warehouse,
            ),
    }

    actor_role = getattr(
        current_user,
        "role",
        None,
    )

    if actor_role is not None:
        properties["actor_role"] = (
            actor_role.value
            if hasattr(actor_role, "value")
            else str(actor_role)
        )

    background_tasks.add_task(
        track_server_event,
        event_type="direct_stock_edit_rejected",
        properties=properties,
        user_id=user_uuid,
        request_id=request_id,
    )

    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": (
                "Direct stock modification is not allowed. "
                "Stock can only be changed through inbound "
                "or outbound orders."
            )
        },
        background=background_tasks,
    )

@router.post(
    "/products/{id}/audit",
    response_model=InventoryAuditResponse,
)
def audit_inventory_product(
    id: int,
    payload: InventoryAuditRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    """
    Compare a physical warehouse count with TrackFlow's
    system-calculated stock.

    This endpoint detects discrepancies but never changes stock.
    """

    product = _get_sku_or_404(
        db,
        id,
    )

    user_uuid = _user_uuid(
        current_user,
    )

    system_quantity = _compute_current_stock(
        db,
        product.id,
        product.warehouse,
    )

    physical_quantity = (
        payload.physical_quantity
    )

    difference_quantity = (
        physical_quantity
        - system_quantity
    )

    audit_id = str(uuid4())

    discrepancy_detected = (
        difference_quantity != 0
    )

    if discrepancy_detected:
        request_id = (
            request.headers.get("X-Request-ID")
            or str(uuid4())
        )

        background_tasks.add_task(
            track_server_event,
            event_type="inventory_discrepancy_detected",
            properties={
                "warehouse":
                    _telemetry_warehouse(
                        product.warehouse,
                    ),

                "client_id":
                    _telemetry_client_id(
                        product.client_name,
                    ),

                "product_id":
                    product.sku,

                "product_category":
                    product.category,

                # System-calculated stock
                "quantity":
                    system_quantity,

                "physical_quantity":
                    physical_quantity,

                "difference_quantity":
                    difference_quantity,

                "audit_id":
                    audit_id,

                "country":
                    _telemetry_country(
                        product.warehouse,
                    ),
            },
            user_id=user_uuid,
            request_id=request_id,
        )

    return InventoryAuditResponse(
        audit_id=audit_id,
        product_id=product.sku,
        system_quantity=system_quantity,
        physical_quantity=physical_quantity,
        difference_quantity=difference_quantity,
        discrepancy_detected=discrepancy_detected,
    )
    
@router.post(
    "/orders/inbound",
    response_model=StockEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inbound_order(
    payload: StockEntryCreate,
    background_tasks: BackgroundTasks,
    request: Request,
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

    user_uuid = _user_uuid(
        current_user,
    )

    entry = StockEntry(
        **payload.model_dump(mode="json"),
        user_uuid=user_uuid,
    )
    db.add(entry)
    db.commit()

    app_cache.delete(PRODUCTS_CACHE_KEY)
    app_cache.delete(ORDERS_CACHE_KEY)
    db.refresh(entry)
    request_id = (
        getattr(
            request.state,
            "request_id",
            None,
        )
        or request.headers.get(
            "X-Request-ID",
        )
        or str(uuid4())
    )


    background_tasks.add_task(
        track_server_event,
        event_type="inbound_order_created",
        properties={
            "warehouse": _telemetry_warehouse(
                product.warehouse,
            ),

            "client_id": _telemetry_client_id(
                product.client_name,
            ),

            "product_id": product.sku,

            "product_category":
                product.category,

            "quantity":
                entry.quantity,

            "inbound_order_id":
                str(entry.id),

            "country": _telemetry_country(
                product.warehouse,
            ),
        },
        user_id=user_uuid,
        request_id=request_id,
    )

    return StockEntryResponse.model_validate(entry)


@router.post(
    "/orders/outbound",
    response_model=StockExitResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_outbound_order(
    payload: StockExitCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user),
):
    product = _get_sku_or_404(
        db,
        payload.sku_id,
        lock=True,
    )

    if product.warehouse != payload.warehouse.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Warehouse mismatch for SKU '{product.sku}'. "
                f"SKU warehouse: {product.warehouse}, "
                f"order warehouse: {payload.warehouse.value}."
            ),
        )

    available = _compute_current_stock(
        db,
        product.id,
        product.warehouse,
    )

    if payload.quantity > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient stock for SKU '{product.sku}'. "
                f"Available: {available}, "
                f"requested: {payload.quantity}."
            ),
        )

    user_uuid = _user_uuid(
        current_user,
    )

    stock_exit = StockExit(
        **payload.model_dump(mode="json"),
        user_uuid=user_uuid,
    )

    db.add(stock_exit)
    db.commit()

    app_cache.delete(
        PRODUCTS_CACHE_KEY,
    )

    app_cache.delete(
        ORDERS_CACHE_KEY,
    )

    db.refresh(stock_exit)

    request_id = (
        getattr(
            request.state,
            "request_id",
            None,
        )
        or request.headers.get(
            "X-Request-ID",
        )
        or str(uuid4())
    )

    background_tasks.add_task(
        track_server_event,
        event_type="outbound_order_created",
        properties={
            "warehouse": _telemetry_warehouse(
                product.warehouse,
            ),
            "client_id": _telemetry_client_id(
                product.client_name,
            ),
            "product_id": product.sku,
            "product_category": product.category,
            "quantity": stock_exit.quantity,
            "outbound_order_id": str(
                stock_exit.id,
            ),
            "country": _telemetry_country(
                product.warehouse,
            ),
        },
        user_id=user_uuid,
        request_id=request_id,
    )

    current_stock = _compute_current_stock(
        db,
        product.id,
        product.warehouse,
    )

    if (
        available >= STOCK_THRESHOLD_QUANTITY
        and current_stock < STOCK_THRESHOLD_QUANTITY
    ):
        background_tasks.add_task(
            track_server_event,
            event_type="stock_threshold_triggered",
            properties={
                "warehouse": _telemetry_warehouse(
                    product.warehouse,
                ),
                "client_id": _telemetry_client_id(
                    product.client_name,
                ),
                "product_id": product.sku,
                "product_category": product.category,
                "quantity": current_stock,
                "threshold_quantity":
                    STOCK_THRESHOLD_QUANTITY,
                "country": _telemetry_country(
                    product.warehouse,
                ),
            },
            user_id=user_uuid,
            request_id=request_id,
        )

    return StockExitResponse.model_validate(
        stock_exit,
    )


@router.get("/orders", response_model=list[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    cached_orders = app_cache.get(ORDERS_CACHE_KEY)

    if cached_orders is not None:
        return cached_orders

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
    results.sort(
    key=lambda item: item.created_at,
    reverse=True,
)

    app_cache.set(
        ORDERS_CACHE_KEY,
        results,
        ttl_seconds=ORDERS_CACHE_TTL_SECONDS,
    )

    return results
