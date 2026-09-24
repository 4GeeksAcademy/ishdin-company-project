from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status

from database import suppliers_table
from models import (
    DeleteSupplierResponse,
    Supplier,
    SupplierCategory,
    SupplierCountry,
    SupplierCreate,
    SupplierRateUpdate,
    SupplierResponse,
    SupplierStatusUpdate,
)


router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def _document_to_response(document) -> SupplierResponse:
    """Convert a TinyDB document into the API response shape."""
    return SupplierResponse(
        id=document.doc_id,
        **dict(document),
    )


def _get_supplier_or_404(supplier_id: int):
    """Return one TinyDB supplier document or raise HTTP 404."""
    document = suppliers_table.get(doc_id=supplier_id)

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {supplier_id} was not found.",
        )

    return document


@router.post(
    "",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a supplier",
)
def create_supplier(payload: SupplierCreate) -> SupplierResponse:
    """
    Register a supplier.

    FastAPI/Pydantic validates the request before this function runs, so
    invalid country, category, status, rate, or currency combinations return
    HTTP 422 before anything is written to TinyDB.
    """
    supplier = Supplier(
        **payload.model_dump(),
        updated_at=datetime.now(timezone.utc),
    )

    document_id = suppliers_table.insert(
        supplier.model_dump(mode="json")
    )

    return SupplierResponse(
        id=document_id,
        **supplier.model_dump(),
    )


@router.get(
    "",
    response_model=list[SupplierResponse],
    summary="List or filter suppliers",
)
def list_suppliers(
    country: SupplierCountry | None = Query(
        default=None,
        description="Filter by exact TrackFlow country value.",
    ),
    category: SupplierCategory | None = Query(
        default=None,
        description="Filter by product category.",
    ),
) -> list[SupplierResponse]:
    """
    Return all suppliers when no filters are provided.

    Both filters can be used independently or together.
    """
    documents = suppliers_table.all()

    country_value = country.value if country is not None else None
    category_value = category.value if category is not None else None

    if country_value is not None:
        documents = [
            document
            for document in documents
            if document.get("country") == country_value
        ]

    if category_value is not None:
        documents = [
            document
            for document in documents
            if category_value in document.get("categories", [])
        ]

    return [
        _document_to_response(document)
        for document in documents
    ]


@router.get(
    "/{supplier_id}",
    response_model=SupplierResponse,
    summary="Get supplier detail",
)
def get_supplier(supplier_id: int) -> SupplierResponse:
    document = _get_supplier_or_404(supplier_id)
    return _document_to_response(document)


@router.patch(
    "/{supplier_id}/rate",
    response_model=SupplierResponse,
    summary="Update supplier rate",
)
def update_supplier_rate(
    supplier_id: int,
    payload: SupplierRateUpdate,
) -> SupplierResponse:
    """
    Update only the supplier rate.

    `updated_at` is refreshed automatically for audit traceability.
    """
    _get_supplier_or_404(supplier_id)

    suppliers_table.update(
        {
            "rate_per_shipment": payload.rate_per_shipment,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        doc_ids=[supplier_id],
    )

    updated_document = _get_supplier_or_404(supplier_id)
    return _document_to_response(updated_document)


@router.patch(
    "/{supplier_id}/status",
    response_model=SupplierResponse,
    summary="Activate or suspend supplier",
)
def update_supplier_status(
    supplier_id: int,
    payload: SupplierStatusUpdate,
) -> SupplierResponse:
    """
    Change status between the only two valid values: active and suspended.

    `updated_at` is intentionally not changed because TrackFlow defines it as
    the timestamp of the latest rate update.
    """
    _get_supplier_or_404(supplier_id)

    suppliers_table.update(
        {"status": payload.status},
        doc_ids=[supplier_id],
    )

    updated_document = _get_supplier_or_404(supplier_id)
    return _document_to_response(updated_document)


@router.delete(
    "/{supplier_id}",
    response_model=DeleteSupplierResponse,
    summary="Delete supplier",
)
def delete_supplier(supplier_id: int) -> DeleteSupplierResponse:
    _get_supplier_or_404(supplier_id)

    suppliers_table.remove(doc_ids=[supplier_id])

    return DeleteSupplierResponse(
        message="Supplier deleted successfully.",
        id=supplier_id,
    )
