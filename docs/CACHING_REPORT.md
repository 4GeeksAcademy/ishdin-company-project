# TrackFlow Performance Optimization — Caching Report

## Project

**Repository:** `4GeeksAcademy/ishdin-company-project`  
**Branch:** `performance-optimization-caching`  
**Backend:** FastAPI  
**Frontend:** Next.js / React / TypeScript  
**Backend entrypoint:** `services/api/main.py`

---

# 1. Objective

TrackFlow's platform is receiving increasing traffic and repeated API requests.

The goal of this optimization is not to cache every endpoint. The goal is to identify caching opportunities using measurable evidence and apply caching only when the following factors justify it:

1. **Cost** — how expensive is the operation?
2. **Frequency** — how often is the same operation repeated?
3. **Stability** — how often does the underlying data change?

A cache will only be introduced when the expected performance benefit is worth the added complexity and the risk of temporarily stale data.

Every cache introduced by this project must have:

- an explicit TTL;
- a documented cache key;
- a clear freshness tradeoff;
- an invalidation strategy when writes affect the cached data.

Personalized, session-specific, or sensitive responses must not use a shared cache unless the cache is explicitly scoped to the authenticated user.

---

# 2. Phase 1 — Request Timing Instrumentation

Request timing middleware was added to `services/api/main.py` using `time.perf_counter()`.

The middleware records:

- HTTP method;
- request path;
- response status;
- total request duration in milliseconds.

Example log format:

```text
INFO:api.timing:GET /health → 200 | 1.5ms
```

## Initial timing verification

The middleware was verified by repeatedly calling:

```text
GET /health
```

Observed results:

```text
GET /health → 200 | 2.2ms
GET /health → 200 | 1.5ms
GET /health → 200 | 1.0ms
```

### Initial conclusion

`GET /health` currently completes in approximately **1–2 ms**.

It is therefore not a useful caching candidate because:

- the computation cost is extremely low;
- there is no meaningful database work;
- caching would add complexity without measurable benefit.

The following framework/documentation routes were also observed:

```text
GET /docs
GET /openapi.json
```

These routes are excluded from the TrackFlow business caching audit because they are FastAPI framework/documentation endpoints rather than application business endpoints.

---

# 3. Backend Endpoint Inventory

The following audit covers the TrackFlow application endpoints mounted by the production FastAPI application.

Classification used during the profiling stage:

- **Investigate** — potentially valuable caching candidate; requires realistic load measurements.
- **Do not cache** — caching is inappropriate because the operation writes data, is personalized, is security-sensitive, or is too freshness-sensitive.
- **Low priority** — technically cacheable, but current implementation suggests lower expected value than stronger candidates.

No endpoint marked **Investigate** is considered approved for caching until measurements are collected with realistic data.

---

## 3.1 System

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| GET | `/health` | Simple application health response | Do not cache | Measured around 1–2 ms. No expensive database or computation work. |

---

# 4. Supplier API

Supplier data is stored in TinyDB.

The supplier list endpoint loads the supplier collection and applies country/category filtering in Python.

Supplier records change when suppliers are created, deleted, or when rate/status is updated.

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| POST | `/suppliers` | Create supplier | Do not cache | Write operation. May require invalidation of supplier read caches later. |
| GET | `/suppliers` | List/filter suppliers | Investigate | Read operation with potentially repeated filters. Data is relatively stable, but current dataset is small. Measure after realistic seeding. |
| GET | `/suppliers/{supplier_id}` | Supplier detail | Low priority | Single TinyDB lookup. Likely inexpensive unless traffic is very high. |
| PATCH | `/suppliers/{supplier_id}/rate` | Update shipment rate | Do not cache | Write operation. Would invalidate supplier caches. |
| PATCH | `/suppliers/{supplier_id}/status` | Change supplier status | Do not cache | Write operation. Would invalidate supplier caches. |
| DELETE | `/suppliers/{supplier_id}` | Delete supplier | Do not cache | Write operation. Would invalidate supplier caches. |

## Supplier observations

Current seed data contains approximately **15 suppliers**.

At this size, performance measurements are unlikely to demonstrate meaningful caching benefits.

`GET /suppliers` will therefore remain an **investigation candidate** rather than an approved cache target until the realistic-load profiling phase is complete.

---

# 5. Incident CSV Analysis API

These endpoints operate on uploaded incident CSV analysis results.

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| POST | `/api/incidents/analyze` | Upload and analyze incident CSV | Do not cache | User-triggered computation/write-like operation. Input files may differ. |
| GET | `/api/incidents/results/export` | Export latest analysis result | Do not cache | Result depends on latest analysis ownership/process state. Shared caching could expose another user's data. |

## CSV analysis observations

The export endpoint is not suitable for a shared application cache because the latest analysis is tied to application state and authorization.

Security and correctness are more important than avoiding the export-generation cost.

---

# 6. Incident Manager API

Incident data is stored in TinyDB.

List and summary operations scan collections and perform Python filtering/aggregation.

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| POST | `/api/incidents` | Create incident | Do not cache | Write operation. Would invalidate incident list/summary caches. |
| GET | `/api/incidents` | List/filter incidents | Investigate | Reads the collection and applies filters. Could become expensive with thousands of incidents and repeated identical filters. |
| GET | `/api/incidents/summary` | Calculate incident aggregates | Investigate | Scans incident collection and calculates multiple grouped counters. Strong potential candidate with larger datasets. |
| GET | `/api/incidents/{incident_id}` | Incident detail | Low priority | Direct lookup by identifier; likely lower cost than list/summary operations. |
| PATCH | `/api/incidents/{incident_id}/status` | Change incident status | Do not cache | Write operation. Would invalidate incident list, summary, and possibly detail caches. |

## Incident summary implementation observation

`GET /api/incidents/summary` currently reads the incident collection and computes aggregates for:

- status;
- category;
- origin;
- branch.

The work grows as the number of incidents grows.

This makes it an important endpoint to profile after realistic data is generated.

---

# 7. Authentication API

Authentication responses are security-sensitive and several responses depend on the current user.

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| POST | `/auth/login` | Authenticate and issue JWT | Do not cache | Credentials and tokens are security-sensitive. |
| POST | `/auth/forgot-password` | Initiate password reset | Do not cache | Security-sensitive state-changing workflow. |
| POST | `/auth/reset-password` | Reset password | Do not cache | Security-sensitive state-changing workflow. |
| POST | `/auth/change-password` | Change authenticated user's password | Do not cache | Security-sensitive write operation. |
| GET | `/auth/me` | Return current authenticated identity | Do not shared-cache | Response is user-specific. A shared cache could expose one user's data to another. |

## Authentication conclusion

Authentication endpoints are deliberately excluded from shared caching.

Any future caching of user-specific authentication/profile responses would require a cache key explicitly scoped to the authenticated user's identity, but no such optimization is justified at this stage.

---

# 8. User API

User-management responses contain account information and are governed by authentication and authorization.

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| POST | `/users` | Register user | Do not cache | Write operation. |
| GET | `/users` | List users | Do not cache initially | Contains account data and is authorization-sensitive. Shared caching adds unnecessary security complexity. |
| GET | `/users/{user_id}` | User detail | Do not shared-cache | Authorization and identity-sensitive response. |
| PUT | `/users/{user_id}` | Update user | Do not cache | Write operation. |
| DELETE | `/users/{user_id}` | Delete user | Do not cache | Write operation. |

## User API conclusion

User endpoints are not initial cache candidates.

Performance optimization should first target shared operational data where the freshness/security tradeoff is significantly safer.

---

# 9. Profile API

Profile responses are tied directly to the authenticated user.

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| GET | `/profiles/me` | Current user's profile | Do not shared-cache | Personalized data. |
| PUT | `/profiles/me` | Update profile | Do not cache | Write operation. |

## Profile conclusion

Shared caching is intentionally rejected because profile data belongs to the current authenticated user.

---

# 10. Inventory API

Inventory is backed by PostgreSQL through SQLModel.

This area currently appears to contain some of the strongest potential caching opportunities.

---

## 10.1 Inventory product list

```text
GET /inventory/products
```

The current implementation first retrieves the SKU collection.

For each SKU, the API calculates `current_stock`.

The stock calculation performs:

1. an aggregate `SUM()` over inbound stock movements;
2. an aggregate `SUM()` over outbound stock movements.

Conceptually, for `N` products the endpoint may perform approximately:

```text
1 product query
+
N inbound aggregate queries
+
N outbound aggregate queries
```

For example, with 500 products this pattern could result in roughly:

```text
1 + 500 + 500
= approximately 1001 database operations
```

The exact database behavior and latency must be measured before optimization.

---

## 10.2 Inventory endpoint audit

| Method | Endpoint | Operation | Initial decision | Reason |
|---|---|---|---|---|
| GET | `/inventory/products` | List products and calculate current stock | **Investigate — high priority** | Potentially many aggregate database queries per request. Frequently useful to backoffice views. |
| POST | `/inventory/products` | Create SKU | Do not cache | Write operation. Would invalidate product caches. |
| GET | `/inventory/products/{id}` | Product detail with computed stock | Investigate / lower priority | Includes current-stock aggregation but only for one SKU. Freshness requirements may outweigh benefit. |
| POST | `/inventory/orders/inbound` | Add stock | Do not cache | Write operation. Must invalidate any cached stock/product responses. |
| POST | `/inventory/orders/outbound` | Remove stock | Do not cache | Write operation. Must invalidate any cached stock/product responses. |
| GET | `/inventory/orders` | Unified movement history | **Investigate — high priority** | Performs joined reads for inbound/outbound history, constructs response objects, combines results, and sorts the timeline. |

---

# 11. Initial Candidate Ranking

Before realistic-load profiling, the current code suggests the following investigation order.

| Priority | Endpoint | Why it deserves measurement |
|---:|---|---|
| 1 | `GET /inventory/products` | Repeated stock aggregation for every SKU creates potentially high database cost. |
| 2 | `GET /inventory/orders` | Multiple joined queries plus response construction and sorting over movement history. |
| 3 | `GET /api/incidents/summary` | Full collection scan plus multiple aggregations. |
| 4 | `GET /api/incidents` | Full collection load and Python filtering for repeated query combinations. |
| 5 | `GET /suppliers` | Stable shared data and repeatable filters, but likely inexpensive with current dataset. |

This ranking is an **investigation order only**.

It is not a final caching decision.

---

# 12. Endpoints Deliberately Not Selected for Caching

Several endpoints were intentionally excluded even though caching is technically possible.

## `GET /health`

Reason:

- approximately 1–2 ms measured latency;
- no database operation;
- negligible computational cost.

Caching would provide almost no benefit.

---

## `GET /auth/me`

Reason:

- response belongs to the authenticated user;
- a shared cache could return one user's account information to another;
- performance benefit does not currently justify per-user cache complexity.

This is an example where security and correctness outweigh potential performance improvement.

---

## Write endpoints

Examples:

```text
POST /inventory/orders/inbound
POST /inventory/orders/outbound
POST /inventory/products
PATCH /api/incidents/{id}/status
POST /api/incidents
PATCH /suppliers/{id}/rate
PATCH /suppliers/{id}/status
DELETE /suppliers/{id}
```

These operations change application state.

They should not themselves be cached.

Instead, they may later serve as **cache invalidation triggers** for related read endpoints.

---

# 13. Freshness vs. Performance Considerations

Inventory demonstrates an important caching tradeoff.

A cached product list could significantly reduce repeated database aggregation work.

However:

```text
POST /inventory/orders/inbound
```

and:

```text
POST /inventory/orders/outbound
```

change stock immediately.

If `GET /inventory/products` is cached without invalidation, the backoffice could temporarily show an incorrect stock quantity.

Therefore, if product responses are eventually cached, the implementation must use one or both of the following:

- short TTL;
- immediate invalidation following stock-changing operations.

For operational inventory data, correctness is more important than maximizing cache duration.

---

# 14. Realistic Data Requirement

Current TrackFlow demo data is too small to produce trustworthy performance measurements.

Current inventory seed data contains approximately:

```text
6 SKUs
5 inbound movements
3 outbound movements
```

Current supplier data contains approximately:

```text
15 suppliers
```

These record counts do not represent realistic application load.

Before choosing final cache targets, a dedicated performance-data seeder will be created.

The seeder should generate varied and relationally valid data such as:

- multiple clients;
- fashion, electronics, and cosmetics categories;
- LA and ZGZ warehouses;
- varied SKU names and identifiers;
- many inbound movements;
- many outbound movements;
- varied quantities;
- varied references;
- valid tracking numbers;
- varied timestamps;
- valid foreign-key relationships.

The performance dataset must remain separate from the normal TrackFlow demo seed so normal application startup is not permanently inflated.

---

# 15. Next Profiling Step

The next phase will create realistic performance data before timing candidate endpoints.

After seeding, the same endpoint will be called repeatedly with identical inputs.

For each candidate we will capture:

- approximate database row count;
- number of repeated requests;
- minimum latency;
- maximum latency;
- representative/average latency;
- whether repeated responses are identical;
- how frequently the underlying data changes.

Example measurement table:

| Endpoint | Dataset | Requests | Baseline latency | Stability | Final cache decision |
|---|---|---:|---:|---|---|
| `/inventory/products` | TBD | TBD | TBD | TBD | Pending |
| `/inventory/orders` | TBD | TBD | TBD | TBD | Pending |
| `/api/incidents/summary` | TBD | TBD | TBD | TBD | Pending |
| `/api/incidents` | TBD | TBD | TBD | TBD | Pending |
| `/suppliers` | TBD | TBD | TBD | TBD | Pending |

No backend cache will be introduced until this table contains measured evidence.

---

# Phase 1–2 Status

- [x] Identify production FastAPI application.
- [x] Add request timing middleware.
- [x] Verify timing output.
- [x] Record initial `/health` baseline.
- [x] Exclude FastAPI documentation routes from business analysis.
- [x] Inventory backend endpoints.
- [x] Evaluate initial cost characteristics.
- [x] Evaluate data freshness characteristics.
- [x] Identify security/personalization exclusions.
- [x] Rank endpoints for further investigation.
- [x] Document endpoints deliberately not selected for caching.
- [ ] Create realistic performance dataset.
- [ ] Measure candidate endpoints under realistic load.
- [ ] Select final backend caching targets.
- [ ] Define cache keys.
- [ ] Define TTL values.
- [ ] Define invalidation behavior.
- [ ] Implement backend caching.
- [ ] Measure post-cache performance.
- [ ] Profile frontend rendering.
- [ ] Implement justified lazy loading.
- [ ] Implement justified memoization.
- [ ] Complete final before/after report.


| Endpoint | Dataset | Requests | Baseline latency | Stability | Final cache decision |
|---|---|---:|---:|---|---|
| `/inventory/products` | 126 SKUs, 970 entries, 607 exits | 10 | min 20535.6 ms / avg 20610.7 ms / max 20711.1 ms | Stable between inventory writes | Cache |
| `/inventory/orders` | 1,577 inventory movements | 10 | min 434.4 ms / avg 476.1 ms / max 599.1 ms | Stable between inventory writes | Cache |
| `/api/incidents/summary` | 3,097 incidents | TBD | TBD | TBD | Pending |
| `/api/incidents` | 3,097 incidents | TBD | TBD | TBD | Pending |
| `/suppliers` | ~15 suppliers | TBD | TBD | High | Pending |


# Phase 5 — Cache Design

Based on realistic-load profiling, TrackFlow will cache two shared inventory read endpoints using an in-process TTL cache.

| Endpoint | Cache key | TTL | Invalidation |
|---|---|---:|---|
| `GET /inventory/products` | `inventory:products` | 30 seconds | Product creation and all inbound/outbound inventory movements |
| `GET /inventory/orders` | `inventory:orders` | 60 seconds | All inbound/outbound inventory movements |

An in-process cache was selected because the current TrackFlow development deployment uses a single FastAPI process and the assignment does not require distributed caching infrastructure.

Redis was deliberately not introduced at this stage because it would add operational complexity without being necessary for the measured use case. If TrackFlow later runs multiple API workers or application instances, a shared external cache such as Redis should replace the process-local cache.

`GET /inventory/products` uses the shorter TTL because its response contains current stock. Inventory freshness is operationally important, especially before outbound movements. `GET /inventory/orders` is a historical timeline and can tolerate a longer 60-second TTL.

TTL expiration acts as a safety mechanism, while successful write operations also explicitly invalidate affected caches.

Cached values will contain completed API response data rather than SQLModel ORM instances or database sessions.

The implementation will use cache-aside behavior:

1. Check for an unexpired cached value.
2. On a hit, return it.
3. On a miss, calculate the response normally.
4. Store the completed response with its TTL.
5. After successful writes, invalidate all affected keys.

The first implementation remains process-local. This means separate FastAPI workers would maintain separate caches, which is an accepted limitation for the current project stage.