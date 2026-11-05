# TrackFlow Backend Serialization Audit

## Phase 1 — Step 1: Endpoint Inventory

**Repository:** `4GeeksAcademy/ishdin-company-project`  
**Branch:** `Backend-Serialization-Audit`  
**Production FastAPI entrypoint:** `services.api.main:app`

### Scope

This inventory follows the routers actually mounted by `services/api/main.py`, which is the application started by `services/Dockerfile`.

FastAPI framework-generated endpoints such as `/docs`, `/redoc`, `/docs/oauth2-redirect`, and `/openapi.json` are excluded from the business serialization audit.

**Total application endpoints identified: 32**

> Phase 1 Step 1 records route, method, purpose, authentication requirement, and source location only.  
> Serialization state, response shape, consumer field usage, classification, and target schema will be added in the next audit step.

---

## Endpoint Summary

| Area | Endpoint count |
|---|---:|
| System | 1 |
| Suppliers | 6 |
| Incident CSV analysis | 2 |
| Incident manager | 5 |
| Authentication | 5 |
| Users | 5 |
| Profiles | 2 |
| Inventory | 6 |
| **Total** | **32** |

---

## 1. System

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 1 | GET | `/health` | Health check used to confirm the backend is running | No | `services/api/main.py` |

---

## 2. Suppliers

Router prefix: `/suppliers`

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 2 | POST | `/suppliers` | Register a new supplier | Yes | `services/api/routes/suppliers.py` |
| 3 | GET | `/suppliers` | List suppliers, optionally filtering by country/category | Yes | `services/api/routes/suppliers.py` |
| 4 | GET | `/suppliers/{supplier_id}` | Return one supplier | Yes | `services/api/routes/suppliers.py` |
| 5 | PATCH | `/suppliers/{supplier_id}/rate` | Update a supplier's shipment rate | Yes | `services/api/routes/suppliers.py` |
| 6 | PATCH | `/suppliers/{supplier_id}/status` | Activate or suspend a supplier | Yes | `services/api/routes/suppliers.py` |
| 7 | DELETE | `/suppliers/{supplier_id}` | Delete a supplier | Yes | `services/api/routes/suppliers.py` |

---

## 3. Incident CSV Analysis

`services/api/main.py` mounts this router with prefix `/api/incidents`.

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 8 | POST | `/api/incidents/analyze` | Upload and analyze an incident CSV and return summary metrics | Yes | `services/api/app/api/incidents.py` |
| 9 | GET | `/api/incidents/results/export` | Export the latest authorized incident-analysis result as CSV | Yes | `services/api/app/api/incidents.py` |

---

## 4. Incident Manager

Router prefix: `/api/incidents`

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 10 | POST | `/api/incidents` | Register a new incident | Yes | `services/api/incidents/routes.py` |
| 11 | GET | `/api/incidents` | List/filter incidents by status, origin, branch, or category | Yes | `services/api/incidents/routes.py` |
| 12 | GET | `/api/incidents/summary` | Return incident summary metrics | Yes | `services/api/incidents/routes.py` |
| 13 | GET | `/api/incidents/{incident_id}` | Return one incident | Yes | `services/api/incidents/routes.py` |
| 14 | PATCH | `/api/incidents/{incident_id}/status` | Update incident lifecycle status | Yes | `services/api/incidents/routes.py` |

---

## 5. Authentication

Router prefix: `/auth`

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 15 | POST | `/auth/login` | Validate credentials and issue a JWT access token | No | `services/api/auth/routes/auth.py` |
| 16 | POST | `/auth/forgot-password` | Request a password-reset email without revealing account existence | No | `services/api/auth/routes/auth.py` |
| 17 | POST | `/auth/reset-password` | Set a new password using a one-time reset token | No | `services/api/auth/routes/auth.py` |
| 18 | POST | `/auth/change-password` | Change the authenticated user's password | Yes | `services/api/auth/routes/auth.py` |
| 19 | GET | `/auth/me` | Return authenticated user identity plus linked profile | Yes | `services/api/auth/routes/auth.py` |

---

## 6. Users

Router prefix: `/users`

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 20 | POST | `/users` | Register a new user and linked profile | No | `services/api/auth/routes/users.py` |
| 21 | GET | `/users` | List users | Yes | `services/api/auth/routes/users.py` |
| 22 | GET | `/users/{user_id}` | Return one user when caller is self/admin | Yes | `services/api/auth/routes/users.py` |
| 23 | PUT | `/users/{user_id}` | Update user credential/account fields subject to permissions | Yes | `services/api/auth/routes/users.py` |
| 24 | DELETE | `/users/{user_id}` | Delete a user and linked profile | Yes | `services/api/auth/routes/users.py` |

---

## 7. Profiles

Router prefix: `/profiles`

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 25 | GET | `/profiles/me` | Return the authenticated user's profile | Yes | `services/api/auth/routes/profiles.py` |
| 26 | PUT | `/profiles/me` | Update the authenticated user's profile | Yes | `services/api/auth/routes/profiles.py` |

---

## 8. Inventory

Router prefix: `/inventory`

| # | Method | Route | Purpose | Auth | Source |
|---:|---|---|---|---|---|
| 27 | GET | `/inventory/products` | List inventory products with derived current stock | No* | `services/api/inventory/routers/inventory.py` |
| 28 | POST | `/inventory/products` | Create an inventory SKU/product | Yes | `services/api/inventory/routers/inventory.py` |
| 29 | GET | `/inventory/products/{id}` | Return one inventory product with current stock | No* | `services/api/inventory/routers/inventory.py` |
| 30 | POST | `/inventory/orders/inbound` | Register an inbound stock movement | Yes | `services/api/inventory/routers/inventory.py` |
| 31 | POST | `/inventory/orders/outbound` | Register an outbound stock movement after stock validation | Yes | `services/api/inventory/routers/inventory.py` |
| 32 | GET | `/inventory/orders` | Return unified inbound/outbound movement history | No* | `services/api/inventory/routers/inventory.py` |

`*` The current route signatures do not declare `Depends(get_current_user)` for these GET endpoints. This inventory records the code as it exists; authorization policy is outside Phase 1 Step 1 unless it affects serialization decisions later.

---

## Mounted Router Map

```text
services/api/main.py
│
├── /health
├── suppliers_router
│   └── /suppliers...
├── incidents_router
│   ├── /api/incidents/analyze
│   └── /api/incidents/results/export
├── incident_manager_router
│   └── /api/incidents...
├── auth_router
│   └── /auth...
├── users_router
│   └── /users...
├── profiles_router
│   └── /profiles...
└── inventory_router
    └── /inventory...
```

---

## Step 1 Status

- [x] Confirm production FastAPI entrypoint.
- [x] Trace all routers mounted by that entrypoint.
- [x] List every mounted application endpoint.
- [x] Record HTTP method.
- [x] Record route path.
- [x] Record purpose.
- [x] Record current authentication dependency presence.
- [x] Record source file.
- [ ] Inspect current response behavior and `response_model`.
- [ ] Trace frontend/consumer field usage.
- [ ] Classify each endpoint as already serialized / partially serialized / not serialized.
- [ ] Define target output field list for endpoints requiring changes.

**Phase 1 Step 1 result: 32 application endpoints identified.**
