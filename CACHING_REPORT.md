# TrackFlow Performance Optimization — Caching Report

## 1. Objective

This performance optimization focused on identifying expensive and frequently repeated operations in the TrackFlow application and improving them with evidence-based caching and frontend rendering optimizations.

The work followed these principles:

- Measure performance before introducing caching.
- Use realistic data volume rather than a very small development dataset.
- Cache only operations that are expensive, repeated, and sufficiently stable.
- Give every backend cache entry an explicit TTL.
- Invalidate cached data when successful writes make it stale.
- Avoid shared caching for user-specific or security-sensitive responses.
- Use lazy loading and memoization only where they provide a meaningful frontend benefit.
- Measure the result after optimization.

---

# 2. Backend Profiling

## Timing Middleware

A FastAPI timing middleware was added using `time.perf_counter()`.

The middleware records:

- HTTP method
- request path
- response status
- execution duration in milliseconds

Example output:

```text
INFO:api.timing:GET /inventory/products → 200 | 20662.5ms
INFO:api.timing:GET /inventory/orders → 200 | 687.1ms
```

This provided a zero-dependency baseline measurement mechanism before caching was introduced.

A request was considered more interesting for optimization when it showed one or more of the following characteristics:

- latency greater than approximately 100–200 ms
- repeated calls to the same path
- stable results between writes
- expensive database work
- processing of a large number of rows

---

# 3. Backend Endpoint Audit

The application endpoints were reviewed before selecting cache candidates.

| Endpoint / Area | Decision | Reason |
|---|---|---|
| `GET /health` | Do not cache | Already approximately 1–2 ms and performs no expensive database work |
| `GET /inventory/products` | Cache | Extremely expensive, frequently read, stable between inventory writes |
| `GET /inventory/products/{id}` | Lower priority | Smaller response and less frequently used than the complete product listing |
| `GET /inventory/orders` | Cache | Reads and assembles a large movement history and is stable between writes |
| `GET /api/incidents` | Investigate / lower priority | Potential candidate, but inventory endpoints had much stronger measured cost |
| `GET /api/incidents/summary` | Investigate / lower priority | Aggregation may benefit from caching, but inventory measurements justified higher priority |
| `GET /suppliers` | Lower priority | Dataset is relatively small |
| `/auth/me` | Do not use shared cache | Response is user-specific |
| Login / password reset / user update endpoints | Do not cache | Security-sensitive or write operations |
| Inventory POST endpoints | Do not cache | Writes must always reach the database |

The two endpoints selected for backend caching were therefore:

1. `GET /inventory/products`
2. `GET /inventory/orders`

---

# 4. Realistic Performance Dataset

Performance measurements were performed after adding realistic test data rather than relying on the original small dataset.

A dedicated performance seeder was created:

```text
services/api/scripts/seed_performance_data.py
```

The seeder creates varied:

- products
- clients
- categories
- warehouses
- quantities
- dates
- inbound movements
- outbound movements
- incidents

It preserves valid foreign-key relationships and avoids creating thousands of identical rows.

## Dataset Size

The performance seed added approximately:

- 120 SKUs
- 960 stock entries
- 600 stock exits
- 3,000 incidents

Final measured database size:

| Data type | Approx. before seed | After seed |
|---|---:|---:|
| SKUs | 6 | 126 |
| Stock entries | 10 | 970 |
| Stock exits | 7 | 607 |
| Incidents | 97 | 3,097 |

The approximate pre-seed counts are derived from the known seeded additions and the measured final counts.

The final inventory dataset contained:

```text
126 SKUs
970 inbound movements
607 outbound movements
1,577 total inventory movements
3,097 incidents
```

Pre-seeding latency was not recorded, so no artificial before-seeding latency comparison is reported. All backend cache decisions were based on measurements taken against the larger realistic dataset.

---

# 5. Baseline Backend Performance

Ten repeated requests were measured before caching.

## `/inventory/products`

```text
requests = 10
min = 20535.6 ms
avg = 20610.7 ms
max = 20711.1 ms
```

Average response time:

```text
20.61 seconds
```

This endpoint was the strongest caching candidate.

The main reason for the high cost is that the endpoint loads all SKUs and calculates `current_stock` separately for every product.

For each SKU, current stock performs:

- one SUM query for inbound stock
- one SUM query for outbound stock

With 126 SKUs, one product-list request performs approximately:

```text
1 product query + (126 × 2 stock queries)
≈ 253 database queries
```

Because the PostgreSQL database is remote, this results in significant network/database round-trip cost.

This is also an N+1-style database access pattern. Query optimization is a valid future improvement, but caching was the focus of this performance task.

## `/inventory/orders`

Baseline:

```text
requests = 10
min = 434.4 ms
avg = 476.1 ms
max = 599.1 ms
```

This endpoint:

- loads inbound order rows
- joins the associated SKU data
- loads outbound order rows
- joins SKU data
- builds response objects
- merges both movement types
- sorts the unified history

With more than 1,500 inventory movements, this was also a justified caching candidate.

---

# 6. Response Stability Verification

Caching was not selected based only on latency.

Repeated identical requests were hashed using SHA-256 to verify that responses remained stable when no writes occurred.

## Products response

Three consecutive requests produced:

```text
4e7370108d5336faf27312dc449c4421b454f4ae0067052d765a2225d6292419
4e7370108d5336faf27312dc449c4421b454f4ae0067052d765a2225d6292419
4e7370108d5336faf27312dc449c4421b454f4ae0067052d765a2225d6292419
```

## Orders response

Three consecutive requests produced:

```text
d3f2bc9e4a3d08e09ee4626879dfa1c9d6f95838aa4adb6c9794fef119f609fe
d3f2bc9e4a3d08e09ee4626879dfa1c9d6f95838aa4adb6c9794fef119f609fe
d3f2bc9e4a3d08e09ee4626879dfa1c9d6f95838aa4adb6c9794fef119f609fe
```

This confirmed that both responses were stable between inventory writes.

The candidate decision therefore had all three desired signals:

| Signal | Products | Orders |
|---|---|---|
| High cost | Yes | Yes |
| Repeated reads | Yes | Yes |
| Stable response between writes | Yes | Yes |

---

# 7. Cache Design

TrackFlow uses a small in-process TTL cache for the current implementation.

A reusable cache utility was added at:

```text
services/api/cache.py
```

The cache uses:

- Python dictionary storage
- `time.monotonic()` for expiry
- a lock for safe concurrent access
- explicit TTL values
- explicit invalidation
- copies of stored response data rather than live database sessions

The cache uses a cache-aside pattern.

```text
GET request
    ↓
Check cache
    ↓
Hit? ── Yes ──→ return cached response
    ↓ No
Execute database work
    ↓
Build API response
    ↓
Store with TTL
    ↓
Return response
```

---

# 8. Cache Keys and TTL Decisions

| Endpoint | Cache key | TTL |
|---|---|---:|
| `GET /inventory/products` | `inventory:products` | 30 seconds |
| `GET /inventory/orders` | `inventory:orders` | 60 seconds |

## Products TTL — 30 seconds

The products response contains `current_stock`.

Inventory stock is operationally sensitive because employees may use it before registering an outbound movement.

For that reason, the product cache uses the shorter TTL.

## Orders TTL — 60 seconds

Order history is comparatively stable and primarily historical.

A slightly longer TTL is acceptable because an order-history page can tolerate a short delay more easily than an operational stock value.

---

# 9. Freshness vs Performance Tradeoff

Caching creates an intentional tradeoff:

```text
More caching
    → faster responses
    → greater possibility of stale data

Less caching
    → fresher responses
    → more database work
```

For TrackFlow, stock freshness is more important than maximum cache duration.

Therefore:

- products use a 30-second TTL
- orders use a 60-second TTL
- successful inventory writes explicitly invalidate relevant cache entries

The TTL acts primarily as a safety mechanism. Normal writes invalidate the cache immediately rather than waiting for expiration.

---

# 10. Cache Invalidation Strategy

## Create product

```text
POST /inventory/products
```

Invalidates:

```text
inventory:products
```

Creating a new SKU changes the products listing but does not create an inventory movement.

## Create inbound order

```text
POST /inventory/orders/inbound
```

Invalidates:

```text
inventory:products
inventory:orders
```

An inbound order:

- increases current stock
- adds a new order-history record

## Create outbound order

```text
POST /inventory/orders/outbound
```

Invalidates:

```text
inventory:products
inventory:orders
```

An outbound movement:

- reduces current stock
- adds a new order-history record

The invalidation occurs only after the database transaction succeeds.

This prevents the application from clearing a valid cache when a write fails.

---

# 11. Backend Cache Validation

## Product Cache

Observed behavior:

```text
Cache MISS  → 20662.5 ms
Cache HIT   → 2.2 ms
Cache HIT   → 2.0 ms
TTL expired → 20656.1 ms
```

This proved:

- cache miss executes the expensive database path
- cache hit returns the stored response
- the 30-second TTL expires correctly

Write invalidation was also tested:

```text
GET products → cache hit
POST inbound → successful write
GET products → cache miss
```

The next product request became expensive again after the write, proving that the cache was correctly invalidated.

---

# 12. Backend Before/After Results

## Products

Baseline average:

```text
20610.7 ms
```

Ten cached product requests produced approximately:

```text
1.8–3.2 ms
```

Measured cached average:

```text
~2.37 ms
```

Approximate response-time reduction:

```text
99.99%
```

Approximate speedup:

```text
~8,700×
```

This is the largest performance improvement in the project.

## Orders

Baseline average:

```text
476.1 ms
```

Representative observed cache-hit measurements included:

```text
40.1 ms
34.5 ms
29.5 ms
```

Average across these representative cache-hit samples:

```text
~34.7 ms
```

Approximate reduction compared with the original baseline average:

```text
~92.7%
```

Approximate speedup:

```text
~13.7×
```

Additional testing confirmed expected miss → hit behavior and successful invalidation after inventory writes.

## Summary

| Endpoint | Before | Representative cached result | Improvement |
|---|---:|---:|---:|
| `/inventory/products` | 20,610.7 ms avg | ~2.37 ms avg | ~99.99% |
| `/inventory/orders` | 476.1 ms avg | ~34.7 ms representative avg | ~92.7% |

---

# 13. Why Redis Was Not Used

Redis was considered but deliberately not introduced at this stage.

The current TrackFlow development setup uses a single FastAPI application process, and the assignment allows an in-process cache.

Adding Redis would introduce additional:

- infrastructure
- configuration
- deployment complexity
- operational dependencies

without being necessary to demonstrate the measured caching benefit.

## Limitation

The current cache is process-local.

If TrackFlow later runs:

- multiple Uvicorn workers
- multiple containers
- multiple API instances

each process would maintain an independent cache.

At that point, a shared cache such as Redis should replace the current in-process implementation.

---

# 14. Deliberately Not Cached

## `GET /health`

The health endpoint was deliberately not cached.

Measured response times were approximately:

```text
1–2 ms
```

It performs no expensive database calculation.

Caching it would add complexity without meaningful benefit.

This is an example where:

```text
cost × frequency × stability
```

does not justify additional cache logic because the original operation is already extremely inexpensive.

## User-specific authentication data

Shared caching was also deliberately avoided for endpoints such as:

```text
/auth/me
```

because the response varies by authenticated user.

Using a shared cache key for user-specific data could return one user's information to another user.

Any future caching of authenticated data would require user-scoped cache keys.

---

# 15. Frontend Lazy-Loading Audit

The Next.js frontend was also reviewed for components that did not need to be part of the initial page rendering work.

Two components were selected.

## ProductsTable

Created:

```text
uis/backoffice/components/inventory/ProductsTable.tsx
```

The products route dynamically imports this component using `next/dynamic`.

The page continues to load:

- heading
- search input
- loading state
- error state

without requiring the large table component immediately.

The table is loaded only when it is needed to display data.

## OrdersTable

Created:

```text
uis/backoffice/components/inventory/OrdersTable.tsx
```

The orders route also uses `next/dynamic`.

The page can initially render:

- heading
- filter
- loading state
- error state

while the larger order-history table remains in a separate JavaScript chunk.

## Why whole routes were not selected

Next.js App Router already performs route-level code splitting.

Therefore, simply choosing inbound and outbound pages as "lazy-loaded routes" would provide less meaningful additional optimization.

Extracting large conditional table components provided a clearer demonstration of explicit component-level lazy loading.

---

# 16. Memoization Decision

The products page contains a product search feature.

The search operates across several fields:

- product name
- SKU
- client name
- category
- warehouse

React DevTools Profiler was used while repeatedly typing and clearing search values.

The `InventoryProductsPage` showed repeated render activity, with many recorded commits approximately in the:

```text
35–100 ms
```

range and observed peaks near:

```text
99.5 ms
```

This provided evidence that the search interaction was a meaningful place to reduce repeated work.

The final implementation separates searchable-data preparation from query filtering.

First, normalized searchable text is memoized only when the product dataset changes:

```tsx
const searchableProducts = useMemo(
  () =>
    products.map((product) => ({
      product,
      searchText: [
        product.name,
        product.sku,
        product.client_name,
        product.category,
        product.warehouse,
      ]
        .join(" ")
        .toLowerCase(),
    })),
  [products],
);
```

Then the query filter uses the already-normalized search text:

```tsx
const filteredProducts = useMemo(() => {
  const value = query.trim().toLowerCase();

  if (!value) {
    return products;
  }

  return searchableProducts
    .filter(({ searchText }) => searchText.includes(value))
    .map(({ product }) => product);
}, [products, query, searchableProducts]);
```

## Benefit

Before this change, each search keystroke could repeatedly:

- iterate over all products
- access five string fields
- lowercase each field
- search each field

With the revised approach:

```text
products change
    ↓
normalize searchable text once

query changes
    ↓
search already-normalized strings
```

This is a genuine memoization use case because the prepared search data is reusable across multiple query changes.

---

# 17. Frontend Verification

After implementing lazy loading and memoization:

```text
npm run build
```

completed successfully after correcting local generated-directory permissions.

The Jest suite also passed:

```text
Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
Snapshots:   0 total
```

This confirmed that the frontend performance changes did not break the existing tested behavior.

---

# 18. Backend Regression Verification

The FastAPI backend regression test suite completed successfully after the caching implementation.

Result:

```text
235 passed
1 warning
```

The warning was a Starlette/TestClient deprecation warning and was unrelated to the caching implementation.

No backend tests failed.

---

# 19. Performance Conclusions

The measurements show that caching was justified for the selected endpoints.

The strongest result was:

```text
GET /inventory/products
~20.6 seconds → ~2.4 milliseconds on a cache hit
```

This endpoint combined:

- very high operation cost
- repeated reads
- stable output between writes

and therefore provided extremely high cache value.

`GET /inventory/orders` also benefited significantly, dropping from hundreds of milliseconds to tens of milliseconds on observed cache hits.

Frontend optimizations reduced unnecessary initial JavaScript work by lazy-loading the two large table components, while React profiling supported a non-trivial memoization improvement for product searching.

---

# 20. Remaining Technical Opportunities

Caching substantially improves response time, but it does not remove the underlying database cost on a cache miss.

The largest future backend optimization opportunity is the stock calculation used by:

```text
GET /inventory/products
```

The current implementation executes two aggregation queries per SKU.

A future optimization could compute stock for all products using grouped aggregate queries or a database-level query/view rather than approximately two additional queries for every product.

That would reduce the uncached response time itself.

Other possible future improvements include:

- Redis for shared multi-instance caching
- cache hit/miss metrics
- structured cache telemetry
- filtered cache keys when inventory filtering is added
- automatic cache size limits
- database query optimization
- additional profiling of incident summary endpoints
- bundle-size analysis for frontend chunks

---

# 21. Final Result

The project now demonstrates an evidence-based performance optimization process:

```text
Profile
   ↓
Increase dataset realism
   ↓
Measure baseline
   ↓
Identify expensive + repeated + stable reads
   ↓
Design TTL and invalidation rules
   ↓
Implement caching
   ↓
Verify expiry and invalidation
   ↓
Measure improvement
   ↓
Optimize frontend loading
   ↓
Profile React rendering
   ↓
Apply justified memoization
   ↓
Run regression tests
```

The implementation improves performance while preserving correctness and explicitly documents the tradeoff between cache freshness and response speed.