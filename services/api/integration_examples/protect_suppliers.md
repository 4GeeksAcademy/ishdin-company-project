# Protect the existing Supplier routes

In the existing:

```text
/services/api/routes/suppliers.py
```

add these imports:

```python
from fastapi import Depends

from auth.dependencies import get_current_user
from auth.models import UserStored
```

Then add the dependency parameter to **all six existing supplier endpoints**.

## POST /suppliers

```python
def create_supplier(
    payload: SupplierCreate,
    current_user: UserStored = Depends(get_current_user),
):
    ...
```

## GET /suppliers

Keep the existing filter parameters and add:

```python
current_user: UserStored = Depends(get_current_user)
```

## GET /suppliers/{supplier_id}

```python
def get_supplier(
    supplier_id: int,
    current_user: UserStored = Depends(get_current_user),
):
    ...
```

## PATCH /suppliers/{supplier_id}/rate

```python
def update_supplier_rate(
    supplier_id: int,
    payload: SupplierRateUpdate,
    current_user: UserStored = Depends(get_current_user),
):
    ...
```

## PATCH /suppliers/{supplier_id}/status

```python
def update_supplier_status(
    supplier_id: int,
    payload: SupplierStatusUpdate,
    current_user: UserStored = Depends(get_current_user),
):
    ...
```

## DELETE /suppliers/{supplier_id}

```python
def delete_supplier(
    supplier_id: int,
    current_user: UserStored = Depends(get_current_user),
):
    ...
```

Protecting these six routes satisfies the exercise requirement to protect at
least five existing routes outside `/users` and `/auth`.

Also protect the incident-analysis endpoints because they expose customer data.
