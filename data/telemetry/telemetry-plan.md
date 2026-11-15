# TrackFlow Telemetry Plan

**Status:** Design only — no instrumentation code in this phase  
**Location:** `docs/telemetry/telemetry-plan.md`  
**Companion schema:** `docs/telemetry/event-schemas.json`  
**Schema format:** JSON Schema draft-07  
**Scope:** Existing TrackFlow inventory FastAPI backend, authentication, Supabase business data, backoffice UI, and internal processes.

## 1. Purpose

TrackFlow's production system performs operational work today, but much of that work is a black box. This plan answers the management RFI by defining what telemetry should be captured before instrumentation begins. It covers business/inventory signals, authentication and security, operator behavior, validation failures, performance, application errors, internal process health, and telemetry quality itself.

The plan follows one rule for every event:

> **We capture `[event_type]` because we need to know `[hypothesis]`, which allows us to make the decision `[decision]`.**

If an event cannot support a plausible decision, it should not be emitted.

## 2. Company constraints carried into telemetry

The following TrackFlow rules are treated as design constraints:

- Inventory is the core operational domain.
- Warehouses are `los_angeles` and `zaragoza`.
- Product categories are `fashion`, `electronics`, and `cosmetics`.
- Every SKU belongs to exactly one B2B client; telemetry must not combine stock from different clients under the same `product_id`.
- Stock is never modified directly. Stock changes only through inbound or outbound orders and are traceable to an authenticated user.
- Inventory telemetry excludes end-consumer recipient information and carrier information. Those belong to the last-mile domain.
- Mandatory inventory metrics must support future aggregation by warehouse, client, and country.
- `country` is derived from warehouse (`los_angeles` → `US`, `zaragoza` → `ES`) and is included on mandatory inventory events to make later executive aggregation explicit and stable.

## 3. Inventory flow and instrumentation map

A normal operator flow is:

```text
Login
  ↓
Backoffice section viewed
  ↓
Inbound or outbound workflow started
  ↓
Form/data entry
  ↓
Request validation + domain validation
  ├── failure → validation/rejection telemetry
  ↓
Business rule checks
  ├── direct stock edit → rejected + telemetry
  ├── insufficient stock → outbound rejected + telemetry
  ↓
DB transaction commits
  ├── inbound → inbound_order_created
  └── outbound → outbound_order_created
                    ↓
              stock recalculated
                    ├── below minimum → stock_threshold_triggered
                    └── later audit mismatch → inventory_discrepancy_detected
  ↓
workflow_completed
```

This creates well over the minimum five instrumentation points while preserving the rule that successful business events are emitted only after the authoritative transaction succeeds.

## 4. Event envelope

Every event MUST contain the same top-level envelope:

```json
{
  "eventId": "9cb9e8d9-6f93-4f4a-9f1a-68de17a4ea52",
  "timestamp": "2026-10-28T20:45:00Z",
  "sessionId": "opaque-session-id-or-null",
  "userId": "tinydb-user-uuid-or-null",
  "event_type": "outbound_order_created",
  "schemaVersion": "1.0",
  "requestId": "request-correlation-id-or-null",
  "properties": {}
}
```

### Envelope rules

| Field | Required | Rule |
|---|---:|---|
| `eventId` | Yes | Globally unique; UUID recommended. Deduplication key for downstream processing. |
| `timestamp` | Yes | UTC ISO 8601 event-occurrence time. |
| `sessionId` | Yes | Opaque identifier; value may be `null` for internal processes without a user session. |
| `userId` | Yes | TinyDB user UUID only; value may be `null` before authentication or for process events. Never emit email, display name, or credentials. |
| `event_type` | Yes | Stable lowercase `entity_action` taxonomy. |
| `schemaVersion` | Yes | Version of this telemetry contract, initially `1.0`. |
| `requestId` | Yes | Correlation identifier joining frontend, backend, and logs; may be `null` only for events with no request context. |
| `properties` | Yes | Event-specific allowlisted object; unknown keys are rejected. |

### Correlation rules

- The frontend should generate or propagate a `requestId` for a user action that causes a backend request.
- The backend should include the same `requestId` in telemetry and application logs.
- A `sessionId` groups a user's backoffice activity without exposing identity.
- `userId` is the authenticated TinyDB UUID, not an email or name.
- Derived batch events such as `workflow_abandoned` should preserve the originating `sessionId` when available.

## 5. Event catalogue

There are **28 designed events**: 5 mandatory TrackFlow metrics plus 23 identified opportunities.

| Event | Class | Category | Why we capture it / decision | Source | Delivery |
|---|---|---|---|---|---|
| `inbound_order_created` | mandatory | business_inventory | We need to know we need to know incoming inventory volume and processing patterns by client and warehouse; this allows us to plan warehouse capacity and staffing and compare inbound volume across locations. | FastAPI backend after the inbound-order transaction commits successfully | **batch** |
| `outbound_order_created` | mandatory | business_inventory | We need to know we need to know how many outbound orders are processed, at what volume, by client and warehouse; this allows us to detect throughput bottlenecks and adjust warehouse capacity before SLA performance degrades. | FastAPI backend after the outbound-order transaction commits successfully | **batch** |
| `stock_threshold_triggered` | mandatory | business_inventory | We need to know we need to know which SKUs and clients are repeatedly at risk of stockout and when threshold alerts occur most; this allows us to alert the client/commercial team and tune replenishment thresholds or replenishment timing. | Inventory service immediately after recalculating stock following an inbound/outbound transaction or approved inventory check | **stream** |
| `direct_stock_edit_rejected` | mandatory | security_control | We need to know we need to know whether users or integrations are attempting to bypass the required order-based stock traceability rule; this allows us to reinforce training, tighten permissions, investigate misuse, or correct integrations at affected warehouses. | FastAPI domain/service layer at the rejection point | **stream** |
| `inventory_discrepancy_detected` | mandatory | business_inventory | We need to know we need to know which SKUs, clients, and warehouses experience the most stock discrepancies; this allows us to prioritize audits, investigate process failures, and improve controls for high-discrepancy SKUs or locations. | Inventory audit/count workflow after comparing physical and system quantities | **stream** |
| `inventory_validation_failed` | identified opportunity | validation_error | We need to know we need to know which products, fields, and rules generate the most validation failures; this allows us to fix confusing UI, improve training, adjust validation messaging, and identify bad integrations. | FastAPI validation/domain layer before persistence | **batch** |
| `outbound_order_rejected` | identified opportunity | business_inventory | We need to know we need to know how often outbound work is blocked and why; this allows us to improve replenishment, operator guidance, and client planning for frequently blocked SKUs. | FastAPI outbound-order service at business-rule rejection | **stream** |
| `product_created` | identified opportunity | business_inventory | We need to know we need to know how the catalog grows by client, category, and warehouse; this allows us to plan onboarding/support effort and monitor catalog growth or unusual creation spikes. | FastAPI product service after successful commit | **batch** |
| `product_updated` | identified opportunity | business_inventory | We need to know we need to know which product attributes change frequently and where configuration churn occurs; this allows us to identify unstable data definitions, training needs, or fields that require stronger controls. | FastAPI product service after successful update | **batch** |
| `login_succeeded` | identified opportunity | authentication | We need to know we need to know active usage levels and successful access patterns; this allows us to measure adoption, identify peak access periods, and capacity-plan authentication services. | FastAPI authentication service after credentials are validated | **batch** |
| `login_failed` | identified opportunity | authentication | We need to know we need to know the volume, timing, and reason categories of failed authentication attempts; this allows us to detect credential issues or attacks and improve account-support or security controls. | FastAPI authentication service on failed authentication | **stream** |
| `session_expired` | identified opportunity | authentication | We need to know we need to know whether session lifetime is disrupting operator workflows; this allows us to adjust session policy or improve reauthentication UX if expiry frequently interrupts active work. | Authentication middleware/backend when token expiry is detected | **batch** |
| `authorization_denied` | identified opportunity | security_control | We need to know we need to know where role permissions conflict with real operator behavior or are being intentionally bypassed; this allows us to correct role design, train users, or investigate suspicious access patterns. | FastAPI authorization dependency/policy layer | **stream** |
| `section_viewed` | identified opportunity | navigation | We need to know we need to know which sections operators actually use and how usage differs by role; this allows us to prioritize UX investment, training, and performance work on high-value sections. | Backoffice frontend after route view is rendered | **batch** |
| `workflow_started` | identified opportunity | workflow_behavior | We need to know we need a reliable denominator for measuring workflow completion and abandonment; this allows us to identify workflows requiring UX simplification, training, or performance fixes. | Backoffice frontend at entry into a tracked workflow | **batch** |
| `workflow_completed` | identified opportunity | workflow_behavior | We need to know we need to know completion rate and time-to-complete for operational flows; this allows us to measure workflow efficiency and compare changes after UX or process improvements. | Backoffice frontend after confirmed backend success | **batch** |
| `workflow_abandoned` | identified opportunity | workflow_behavior | We need to know we need to know which flows operators abandon and at which stage; this allows us to remove friction, improve validation/help text, or investigate performance issues at high-drop-off steps. | Frontend/session analytics processor using start/progress/completion signals | **batch** |
| `api_latency_recorded` | identified opportunity | performance | We need to know we need to know which API operations are slow and whether latency changes by route or status class; this allows us to prioritize performance optimization and set/monitor service-level objectives. | FastAPI middleware/observability layer | **stream** |
| `api_error_recorded` | identified opportunity | technical_error | We need to know we need to know which routes and error classes are failing most; this allows us to triage incidents and prioritize reliability fixes. | FastAPI exception/error middleware | **stream** |
| `frontend_error_recorded` | identified opportunity | technical_error | We need to know we need to know which backoffice pages fail in the browser and whether releases introduce regressions; this allows us to prioritize frontend fixes and roll back or patch regressions. | Backoffice global error boundary/client telemetry handler | **stream** |
| `page_load_recorded` | identified opportunity | performance | We need to know we need to know which operator pages are slow to become usable; this allows us to optimize frontend bundles/data loading and prioritize slow high-usage sections. | Backoffice performance instrumentation | **batch** |
| `database_operation_slow` | identified opportunity | performance | We need to know we need to know which logical database operations are degrading backend performance; this allows us to add indexes, rewrite queries, or adjust data-access patterns. | Backend data-access layer/DB instrumentation | **stream** |
| `background_process_failed` | identified opportunity | technical_error | We need to know we need to know whether unattended processes fail silently; this allows us to alert engineering and restore or retry critical processing. | Background process runner/worker | **stream** |
| `integration_call_failed` | identified opportunity | technical_error | We need to know we need to know whether external/internal dependencies are causing operator-visible failures; this allows us to switch fallback behavior, escalate dependency incidents, or improve retry/circuit-breaker policy. | Backend integration client wrapper | **stream** |
| `rate_limit_triggered` | identified opportunity | security_control | We need to know we need to know whether automation, misuse, or legitimate operator behavior is exceeding safe request rates; this allows us to tune limits, investigate abuse, or optimize chatty clients. | API gateway/middleware/rate limiter | **stream** |
| `request_validation_failed` | identified opportunity | validation_error | We need to know we need to know which API contracts clients violate most often; this allows us to improve frontend/API clients, documentation, and compatibility handling. | FastAPI request validation exception handler | **batch** |
| `telemetry_schema_rejected` | identified opportunity | telemetry_quality | We need to know we need to know whether instrumentation changes are producing invalid or drifting events; this allows us to block bad deployments, fix producers, and preserve trust in analytics. | Telemetry producer validation layer or ingestion gateway | **stream** |
| `telemetry_delivery_failed` | identified opportunity | telemetry_quality | We need to know we need to know whether observability data itself is being lost; this allows us to repair the pipeline, adjust buffering/retry policy, and quantify telemetry gaps. | Telemetry transport/client | **stream** |

## 6. Detailed event definitions

### `inbound_order_created`

- **Classification:** mandatory
- **Category:** business_inventory
- **Description:** Emitted after an authenticated user successfully registers an inbound order that adds stock.
- **Golden-rule statement:** We capture `inbound_order_created` because we need to know incoming inventory volume and processing patterns by client and warehouse, which allows us to plan warehouse capacity and staffing and compare inbound volume across locations.
- **Producer / trigger:** FastAPI backend after the inbound-order transaction commits successfully
- **Delivery:** **batch** — Capacity planning and trend analysis do not require second-level reaction; hourly/daily aggregation is sufficient.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse where stock was received. Allowed: los_angeles, zaragoza. | no |
| `client_id` | string | Yes | B2B client that owns the SKU. | pseudonymous business identifier |
| `product_id` | string | Yes | SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |
| `quantity` | integer | Yes | Quantity received; must be > 0. | no |
| `inbound_order_id` | string | Yes | Identifier of the created inbound order. | pseudonymous business identifier |
| `country` | string | Yes | Derived warehouse country: US or ES, retained for future aggregation. | no |

### `outbound_order_created`

- **Classification:** mandatory
- **Category:** business_inventory
- **Description:** Emitted after picking/dispatch is successfully registered and stock is reduced through an outbound order.
- **Golden-rule statement:** We capture `outbound_order_created` because we need to know how many outbound orders are processed, at what volume, by client and warehouse, which allows us to detect throughput bottlenecks and adjust warehouse capacity before SLA performance degrades.
- **Producer / trigger:** FastAPI backend after the outbound-order transaction commits successfully
- **Delivery:** **batch** — Operational throughput is primarily managed from periodic trend aggregates; raw events remain available for drill-down.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse fulfilling the order: los_angeles or zaragoza. | no |
| `client_id` | string | Yes | B2B client that owns the SKU. | pseudonymous business identifier |
| `product_id` | string | Yes | SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |
| `quantity` | integer | Yes | Quantity dispatched; must be > 0. | no |
| `outbound_order_id` | string | Yes | Identifier of the created outbound order. | pseudonymous business identifier |
| `country` | string | Yes | Derived warehouse country: US or ES. | no |

### `stock_threshold_triggered`

- **Classification:** mandatory
- **Category:** business_inventory
- **Description:** Emitted when a SKU's available stock falls below the configured minimum threshold for that client.
- **Golden-rule statement:** We capture `stock_threshold_triggered` because we need to know which SKUs and clients are repeatedly at risk of stockout and when threshold alerts occur most, which allows us to alert the client/commercial team and tune replenishment thresholds or replenishment timing.
- **Producer / trigger:** Inventory service immediately after recalculating stock following an inbound/outbound transaction or approved inventory check
- **Delivery:** **stream** — A threshold breach can require immediate operational or client action to avoid stockout.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse where the threshold was breached. | no |
| `client_id` | string | Yes | B2B client owning the SKU. | pseudonymous business identifier |
| `product_id` | string | Yes | SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |
| `quantity` | integer | Yes | Current calculated stock when the threshold fires. | no |
| `threshold_quantity` | integer | Yes | Configured minimum stock threshold. | no |
| `country` | string | Yes | Derived warehouse country: US or ES. | no |

### `direct_stock_edit_rejected`

- **Classification:** mandatory
- **Category:** security_control
- **Description:** Emitted whenever a user or process attempts to modify stock directly and the business rule rejects the operation.
- **Golden-rule statement:** We capture `direct_stock_edit_rejected` because we need to know whether users or integrations are attempting to bypass the required order-based stock traceability rule, which allows us to reinforce training, tighten permissions, investigate misuse, or correct integrations at affected warehouses.
- **Producer / trigger:** FastAPI domain/service layer at the rejection point
- **Delivery:** **stream** — Repeated bypass attempts can represent an immediate control, training, or security issue.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse associated with the targeted stock record. | no |
| `client_id` | string | Yes | B2B client owning the SKU. | pseudonymous business identifier |
| `product_id` | string | Yes | SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |
| `quantity` | integer | Yes | Requested direct stock delta or attempted value. | no |
| `attempted_operation` | string | Yes | Type of forbidden edit attempted, e.g. set/increment/decrement. | no |
| `actor_role` | string | No | Application role of the authenticated actor. | low sensitivity |
| `country` | string | Yes | Derived warehouse country: US or ES. | no |

### `inventory_discrepancy_detected`

- **Classification:** mandatory
- **Category:** business_inventory
- **Description:** Emitted when a physical count or audit differs from system-calculated stock.
- **Golden-rule statement:** We capture `inventory_discrepancy_detected` because we need to know which SKUs, clients, and warehouses experience the most stock discrepancies, which allows us to prioritize audits, investigate process failures, and improve controls for high-discrepancy SKUs or locations.
- **Producer / trigger:** Inventory audit/count workflow after comparing physical and system quantities
- **Delivery:** **stream** — Large discrepancies can require prompt containment or audit action even though historical analysis is also valuable.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse where the discrepancy was found. | no |
| `client_id` | string | Yes | B2B client owning the SKU. | pseudonymous business identifier |
| `product_id` | string | Yes | SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |
| `quantity` | integer | Yes | System-calculated quantity at detection time. | no |
| `physical_quantity` | integer | Yes | Counted physical quantity. | no |
| `difference_quantity` | integer | Yes | physical_quantity - quantity. | no |
| `audit_id` | string | No | Audit/count workflow identifier. | pseudonymous business identifier |
| `country` | string | Yes | Derived warehouse country: US or ES. | no |

### `inventory_validation_failed`

- **Classification:** identified opportunity
- **Category:** validation_error
- **Description:** Emitted when an inventory product/order request fails business or input validation.
- **Golden-rule statement:** We capture `inventory_validation_failed` because we need to know which products, fields, and rules generate the most validation failures, which allows us to fix confusing UI, improve training, adjust validation messaging, and identify bad integrations.
- **Producer / trigger:** FastAPI validation/domain layer before persistence
- **Delivery:** **batch** — Aggregate error patterns are more useful than immediate alerting for ordinary validation failures.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `entity_type` | string | Yes | product, inbound_order, or outbound_order. | no |
| `entity_id` | string | No | Existing entity identifier when available. | pseudonymous business identifier |
| `product_id` | string | No | SKU/product related to the failure, when applicable. | pseudonymous business identifier |
| `warehouse` | string | No | Associated warehouse when known. | no |
| `validation_code` | string | Yes | Stable machine-readable validation code. | no |
| `field_name` | string | No | Field associated with the failure. | no |
| `error_class` | string | Yes | High-level validation category; never raw stack trace. | no |

### `outbound_order_rejected`

- **Classification:** identified opportunity
- **Category:** business_inventory
- **Description:** Emitted when an outbound order is rejected, for example because requested quantity exceeds available stock.
- **Golden-rule statement:** We capture `outbound_order_rejected` because we need to know how often outbound work is blocked and why, which allows us to improve replenishment, operator guidance, and client planning for frequently blocked SKUs.
- **Producer / trigger:** FastAPI outbound-order service at business-rule rejection
- **Delivery:** **stream** — Repeated or high-impact rejections can block warehouse operations and may need immediate attention.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse attempting fulfillment. | no |
| `client_id` | string | Yes | B2B client owning the SKU. | pseudonymous business identifier |
| `product_id` | string | Yes | SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |
| `quantity` | integer | Yes | Requested outbound quantity. | no |
| `available_stock` | integer | No | Calculated available stock when relevant. | no |
| `rejection_code` | string | Yes | Stable reason such as insufficient_stock. | no |

### `product_created`

- **Classification:** identified opportunity
- **Category:** business_inventory
- **Description:** Emitted after a new client SKU is created successfully.
- **Golden-rule statement:** We capture `product_created` because we need to know how the catalog grows by client, category, and warehouse, which allows us to plan onboarding/support effort and monitor catalog growth or unusual creation spikes.
- **Producer / trigger:** FastAPI product service after successful commit
- **Delivery:** **batch** — Catalog growth is normally reviewed as a trend rather than acted on within seconds.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse associated with the SKU. | no |
| `client_id` | string | Yes | B2B client owner. | pseudonymous business identifier |
| `product_id` | string | Yes | Created SKU/product identifier. | pseudonymous business identifier |
| `product_category` | string | Yes | fashion, electronics, or cosmetics. | no |

### `product_updated`

- **Classification:** identified opportunity
- **Category:** business_inventory
- **Description:** Emitted after permitted product metadata changes are saved; stock quantity changes are excluded.
- **Golden-rule statement:** We capture `product_updated` because we need to know which product attributes change frequently and where configuration churn occurs, which allows us to identify unstable data definitions, training needs, or fields that require stronger controls.
- **Producer / trigger:** FastAPI product service after successful update
- **Delivery:** **batch** — Metadata-change patterns are useful for audit and trend analysis but rarely need immediate action.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `warehouse` | string | Yes | Warehouse associated with the SKU. | no |
| `client_id` | string | Yes | B2B client owner. | pseudonymous business identifier |
| `product_id` | string | Yes | Updated SKU/product identifier. | pseudonymous business identifier |
| `changed_fields` | array | Yes | Allowlisted field names changed; values are not copied into telemetry. | no |

### `login_succeeded`

- **Classification:** identified opportunity
- **Category:** authentication
- **Description:** Emitted when authentication succeeds.
- **Golden-rule statement:** We capture `login_succeeded` because we need to know active usage levels and successful access patterns, which allows us to measure adoption, identify peak access periods, and capacity-plan authentication services.
- **Producer / trigger:** FastAPI authentication service after credentials are validated
- **Delivery:** **batch** — Normal successful-login trends do not need real-time processing.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `auth_method` | string | Yes | Authentication method, e.g. password. | no |
| `actor_role` | string | No | Role assigned to the authenticated user. | low sensitivity |

### `login_failed`

- **Classification:** identified opportunity
- **Category:** authentication
- **Description:** Emitted on an unsuccessful login without recording passwords or raw credentials.
- **Golden-rule statement:** We capture `login_failed` because we need to know the volume, timing, and reason categories of failed authentication attempts, which allows us to detect credential issues or attacks and improve account-support or security controls.
- **Producer / trigger:** FastAPI authentication service on failed authentication
- **Delivery:** **stream** — Spikes or repeated failures can indicate an active security problem.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `failure_code` | string | Yes | Stable reason category such as invalid_credentials, inactive_user, rate_limited. | no |
| `auth_method` | string | Yes | Authentication method attempted. | no |
| `user_key_hash` | string | No | One-way keyed hash of normalized account identifier for safe repeat-attempt correlation. | sanitised sensitive identifier |

### `session_expired`

- **Classification:** identified opportunity
- **Category:** authentication
- **Description:** Emitted when a request or client action encounters an expired authenticated session/token.
- **Golden-rule statement:** We capture `session_expired` because we need to know whether session lifetime is disrupting operator workflows, which allows us to adjust session policy or improve reauthentication UX if expiry frequently interrupts active work.
- **Producer / trigger:** Authentication middleware/backend when token expiry is detected
- **Delivery:** **batch** — Session-policy tuning is based on aggregate patterns rather than individual expiry events.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `route_group` | string | No | High-level route/feature area active at expiry. | no |
| `session_age_seconds` | integer | No | Approximate session age when expiry was detected. | no |

### `authorization_denied`

- **Classification:** identified opportunity
- **Category:** security_control
- **Description:** Emitted when an authenticated user attempts an action outside their permissions.
- **Golden-rule statement:** We capture `authorization_denied` because we need to know where role permissions conflict with real operator behavior or are being intentionally bypassed, which allows us to correct role design, train users, or investigate suspicious access patterns.
- **Producer / trigger:** FastAPI authorization dependency/policy layer
- **Delivery:** **stream** — Bursts of denied privileged actions can be security-relevant and merit prompt review.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `route_group` | string | Yes | High-level protected area. | no |
| `action` | string | Yes | Requested action such as create/update/read. | no |
| `required_role` | string | No | Role/policy required for the action. | low sensitivity |
| `actor_role` | string | No | Actor's effective role. | low sensitivity |

### `section_viewed`

- **Classification:** identified opportunity
- **Category:** navigation
- **Description:** Emitted when an operator successfully lands on a major backoffice section.
- **Golden-rule statement:** We capture `section_viewed` because we need to know which sections operators actually use and how usage differs by role, which allows us to prioritize UX investment, training, and performance work on high-value sections.
- **Producer / trigger:** Backoffice frontend after route view is rendered
- **Delivery:** **batch** — Navigation popularity is a product-analytics question suited to periodic aggregation.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `section_name` | string | Yes | Stable section identifier such as products, inbound, outbound, history, summary. | no |
| `previous_section` | string | No | Previous allowlisted section identifier. | no |
| `actor_role` | string | No | Role of the current user. | low sensitivity |

### `workflow_started`

- **Classification:** identified opportunity
- **Category:** workflow_behavior
- **Description:** Emitted when an operator starts a defined multi-step workflow such as inbound or outbound order registration.
- **Golden-rule statement:** We capture `workflow_started` because we need a reliable denominator for measuring workflow completion and abandonment, which allows us to identify workflows requiring UX simplification, training, or performance fixes.
- **Producer / trigger:** Backoffice frontend at entry into a tracked workflow
- **Delivery:** **batch** — Completion funnels are evaluated through aggregated session-level analysis.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `workflow_name` | string | Yes | Stable workflow identifier. | no |
| `warehouse` | string | No | Warehouse selected/associated, if already known. | no |

### `workflow_completed`

- **Classification:** identified opportunity
- **Category:** workflow_behavior
- **Description:** Emitted when a tracked workflow reaches its intended successful outcome.
- **Golden-rule statement:** We capture `workflow_completed` because we need to know completion rate and time-to-complete for operational flows, which allows us to measure workflow efficiency and compare changes after UX or process improvements.
- **Producer / trigger:** Backoffice frontend after confirmed backend success
- **Delivery:** **batch** — Funnel and efficiency analysis can be processed periodically.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `workflow_name` | string | Yes | Stable workflow identifier. | no |
| `duration_ms` | integer | Yes | Elapsed time from workflow_started to completion. | no |
| `warehouse` | string | No | Warehouse associated with the completed workflow. | no |

### `workflow_abandoned`

- **Classification:** identified opportunity
- **Category:** workflow_behavior
- **Description:** Derived/emitted when a workflow starts but does not complete within a documented inactivity window.
- **Golden-rule statement:** We capture `workflow_abandoned` because we need to know which flows operators abandon and at which stage, which allows us to remove friction, improve validation/help text, or investigate performance issues at high-drop-off steps.
- **Producer / trigger:** Frontend/session analytics processor using start/progress/completion signals
- **Delivery:** **batch** — Abandonment is best determined after an inactivity window, so it is naturally a derived batch event.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `workflow_name` | string | Yes | Stable workflow identifier. | no |
| `last_step` | string | No | Allowlisted last completed step identifier. | no |
| `elapsed_ms` | integer | No | Approximate time from start until abandonment window closed. | no |

### `api_latency_recorded`

- **Classification:** identified opportunity
- **Category:** performance
- **Description:** Emitted as an aggregated/sampled measurement of API request latency.
- **Golden-rule statement:** We capture `api_latency_recorded` because we need to know which API operations are slow and whether latency changes by route or status class, which allows us to prioritize performance optimization and set/monitor service-level objectives.
- **Producer / trigger:** FastAPI middleware/observability layer
- **Delivery:** **stream** — Severe latency degradation may need rapid operational detection; raw high-volume samples are throttled.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `route_template` | string | Yes | Normalized route template, never raw URL with identifiers. | no |
| `http_method` | string | Yes | HTTP method. | no |
| `status_class` | string | Yes | 2xx/3xx/4xx/5xx rather than exact response body. | no |
| `duration_ms` | number | Yes | Request duration in milliseconds. | no |

### `api_error_recorded`

- **Classification:** identified opportunity
- **Category:** technical_error
- **Description:** Emitted when a backend request returns an unexpected 5xx or classified internal failure.
- **Golden-rule statement:** We capture `api_error_recorded` because we need to know which routes and error classes are failing most, which allows us to triage incidents and prioritize reliability fixes.
- **Producer / trigger:** FastAPI exception/error middleware
- **Delivery:** **stream** — Backend failure spikes require rapid operational response.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `route_template` | string | Yes | Normalized route template. | no |
| `http_method` | string | Yes | HTTP method. | no |
| `error_class` | string | Yes | Sanitised stable exception/error category; no stack trace or message dump. | no |
| `status_code` | integer | Yes | HTTP status code, typically 5xx. | no |

### `frontend_error_recorded`

- **Classification:** identified opportunity
- **Category:** technical_error
- **Description:** Emitted for uncaught frontend errors using a sanitised fingerprint instead of full message/context dumps.
- **Golden-rule statement:** We capture `frontend_error_recorded` because we need to know which backoffice pages fail in the browser and whether releases introduce regressions, which allows us to prioritize frontend fixes and roll back or patch regressions.
- **Producer / trigger:** Backoffice global error boundary/client telemetry handler
- **Delivery:** **stream** — A new spike after deployment can immediately impact operators.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `section_name` | string | Yes | Backoffice section where the error occurred. | no |
| `error_fingerprint` | string | Yes | Stable sanitised hash/category for grouping equivalent errors. | no |
| `app_version` | string | No | Frontend build/release identifier. | no |

### `page_load_recorded`

- **Classification:** identified opportunity
- **Category:** performance
- **Description:** Emitted as sampled page-load performance telemetry for major backoffice routes.
- **Golden-rule statement:** We capture `page_load_recorded` because we need to know which operator pages are slow to become usable, which allows us to optimize frontend bundles/data loading and prioritize slow high-usage sections.
- **Producer / trigger:** Backoffice performance instrumentation
- **Delivery:** **batch** — User-experience performance trends can be aggregated periodically; high-frequency data is sampled.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `section_name` | string | Yes | Major backoffice section. | no |
| `load_ms` | number | Yes | Time until the defined usable/render milestone. | no |
| `app_version` | string | No | Frontend build/release identifier. | no |

### `database_operation_slow`

- **Classification:** identified opportunity
- **Category:** performance
- **Description:** Emitted when a Supabase/Postgres operation exceeds a defined slow-query threshold.
- **Golden-rule statement:** We capture `database_operation_slow` because we need to know which logical database operations are degrading backend performance, which allows us to add indexes, rewrite queries, or adjust data-access patterns.
- **Producer / trigger:** Backend data-access layer/DB instrumentation
- **Delivery:** **stream** — Sustained slow database operations can degrade the production system and need prompt detection.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `operation_name` | string | Yes | Logical allowlisted operation name, not raw SQL. | no |
| `duration_ms` | number | Yes | Database operation duration. | no |
| `table_group` | string | No | High-level table/entity group. | no |

### `background_process_failed`

- **Classification:** identified opportunity
- **Category:** technical_error
- **Description:** Emitted when an internal scheduled/background process fails.
- **Golden-rule statement:** We capture `background_process_failed` because we need to know whether unattended processes fail silently, which allows us to alert engineering and restore or retry critical processing.
- **Producer / trigger:** Background process runner/worker
- **Delivery:** **stream** — Silent process failure can create stale or missing operational data and needs rapid attention.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `process_name` | string | Yes | Allowlisted background process identifier. | no |
| `error_class` | string | Yes | Sanitised stable failure category. | no |
| `attempt_number` | integer | No | Retry attempt number. | no |

### `integration_call_failed`

- **Classification:** identified opportunity
- **Category:** technical_error
- **Description:** Emitted when a dependency/integration call used by the application fails or times out.
- **Golden-rule statement:** We capture `integration_call_failed` because we need to know whether external/internal dependencies are causing operator-visible failures, which allows us to switch fallback behavior, escalate dependency incidents, or improve retry/circuit-breaker policy.
- **Producer / trigger:** Backend integration client wrapper
- **Delivery:** **stream** — Dependency failures can cascade into production outages and require immediate detection.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `integration_name` | string | Yes | Allowlisted dependency name. | no |
| `operation_name` | string | Yes | Allowlisted logical operation. | no |
| `failure_code` | string | Yes | Stable timeout/unavailable/auth/etc. category. | no |
| `duration_ms` | number | No | Elapsed time before failure. | no |

### `rate_limit_triggered`

- **Classification:** identified opportunity
- **Category:** security_control
- **Description:** Emitted when application rate limiting blocks or delays a request.
- **Golden-rule statement:** We capture `rate_limit_triggered` because we need to know whether automation, misuse, or legitimate operator behavior is exceeding safe request rates, which allows us to tune limits, investigate abuse, or optimize chatty clients.
- **Producer / trigger:** API gateway/middleware/rate limiter
- **Delivery:** **stream** — A spike can signal abuse or a broken client and needs prompt attention.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `route_group` | string | Yes | High-level protected area. | no |
| `limit_policy` | string | Yes | Stable policy identifier. | no |
| `actor_key_hash` | string | No | Keyed hash for repeat-actor correlation without emitting raw identity. | sanitised sensitive identifier |

### `request_validation_failed`

- **Classification:** identified opportunity
- **Category:** validation_error
- **Description:** Emitted for malformed or schema-invalid API requests outside domain-specific inventory validation.
- **Golden-rule statement:** We capture `request_validation_failed` because we need to know which API contracts clients violate most often, which allows us to improve frontend/API clients, documentation, and compatibility handling.
- **Producer / trigger:** FastAPI request validation exception handler
- **Delivery:** **batch** — Contract misuse is normally diagnosed from aggregate patterns rather than individual immediate alerts.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `route_template` | string | Yes | Normalized route template. | no |
| `http_method` | string | Yes | HTTP method. | no |
| `field_name` | string | No | Top-level failing field when safe to record. | no |
| `validation_code` | string | Yes | Stable validation category. | no |

### `telemetry_schema_rejected`

- **Classification:** identified opportunity
- **Category:** telemetry_quality
- **Description:** Emitted to a separate operational counter/log when an attempted telemetry event fails schema validation.
- **Golden-rule statement:** We capture `telemetry_schema_rejected` because we need to know whether instrumentation changes are producing invalid or drifting events, which allows us to block bad deployments, fix producers, and preserve trust in analytics.
- **Producer / trigger:** Telemetry producer validation layer or ingestion gateway
- **Delivery:** **stream** — Schema drift can silently corrupt downstream analytics if not detected quickly.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `rejected_event_type` | string | Yes | Event type that failed validation. | no |
| `schema_version` | string | Yes | Schema version producer attempted to use. | no |
| `validation_code` | string | Yes | Stable schema-validation failure category. | no |

### `telemetry_delivery_failed`

- **Classification:** identified opportunity
- **Category:** telemetry_quality
- **Description:** Emitted/counted when telemetry cannot be delivered after configured retries.
- **Golden-rule statement:** We capture `telemetry_delivery_failed` because we need to know whether observability data itself is being lost, which allows us to repair the pipeline, adjust buffering/retry policy, and quantify telemetry gaps.
- **Producer / trigger:** Telemetry transport/client
- **Delivery:** **stream** — Sustained telemetry loss makes monitoring blind and should be surfaced quickly.
- **Property allowlist:** only the keys below may be emitted.

| Property | Type | Required | Purpose | Sensitive/PII handling |
|---|---|---:|---|---|
| `event_type_failed` | string | Yes | Type of event that could not be delivered. | no |
| `failure_code` | string | Yes | Stable transport/storage failure category. | no |
| `retry_count` | integer | Yes | Number of attempted deliveries. | no |


## 7. Batch vs. stream strategy

The classification is based on the decision latency, not implementation preference.

### Stream

Use stream/near-real-time processing where delayed awareness can materially worsen security, operational continuity, stock availability, or system reliability. This includes threshold breaches, direct-stock-edit rejections, serious discrepancies, authorization/login anomalies, backend/frontend failures, slow database behavior, dependency failures, rate limiting, and telemetry-pipeline failures.

A stream event may still also be persisted for historical batch analysis.

### Batch

Use periodic processing when the primary question is trend, comparison, adoption, capacity planning, funnel analysis, or UX improvement. Examples include order volumes, successful login trends, section popularity, product catalog growth, validation patterns, page-load trends, and workflow conversion.

Recommended first cadence:
- operational aggregates: every 5–15 minutes where useful;
- management/warehouse trend aggregates: hourly and daily;
- executive comparisons: daily with retained weekly/monthly rollups.

## 8. Throttle, debounce, and sampling strategy

High-frequency telemetry can create cost and noise. The following rules apply:

1. **`api_latency_recorded`** — do not emit every healthy request indefinitely. Sample normal requests (for example 5–10%), but keep 100% of requests above the slow threshold and 100% of 5xx-correlated latency records.
2. **`page_load_recorded`** — sample normal page loads by session/section. Preserve 100% of extremely slow loads above an agreed threshold.
3. **Repeated `frontend_error_recorded` events** — deduplicate identical `error_fingerprint + section_name + app_version` combinations within a short window (for example 60 seconds) while maintaining a count.
4. **`login_failed`, `authorization_denied`, `direct_stock_edit_rejected`, `rate_limit_triggered`** — do not drop unique security/control events. Aggregation is allowed downstream, but source events should be retained according to security retention policy.
5. **Navigation (`section_viewed`)** — debounce rapid route churn and do not emit duplicate views for the same section if the route re-renders without a meaningful navigation.
6. Throttling must never alter authoritative business data. It affects telemetry emission only.

Exact percentages and thresholds should be configuration values, not hard-coded constants, so operations can tune them after observing real traffic.

## 9. Privacy, security, and data minimization

### Never capture

- passwords, password hashes, reset tokens, JWTs, API keys, cookies, authorization headers;
- full request/response bodies by default;
- end-consumer names, addresses, phone numbers, email addresses, delivery recipient data;
- carrier/last-mile recipient details in inventory events;
- raw SQL statements containing values;
- stack traces or exception messages that may contain user/business data;
- free-text form contents unless a future event is explicitly reviewed and allowlisted.

### Allowed identity strategy

- `userId`: internal TinyDB UUID only.
- Failed-login correlation may use `user_key_hash`: a server-side keyed one-way hash of a normalized account identifier. Raw email/username is never emitted.
- `client_id`, `product_id`, and order IDs are business identifiers and should be treated as pseudonymous internal data.
- IP address is intentionally excluded from this first plan. If security later requires network-level detection, add a separately reviewed coarse/geohashed or otherwise minimized representation rather than emitting raw IP by default.

## 10. Risks and exclusions

### Considered but discarded

| Candidate | Decision | Reason |
|---|---|---|
| `password_entered` | Exclude | No valid telemetry need justifies capturing credential material. |
| `request_body_recorded` | Exclude | High privacy/data-leak risk and unnecessary storage cost. Use explicit allowlisted fields instead. |
| `response_body_recorded` | Exclude | Same risk; status class/error class is sufficient for most operational questions. |
| `recipient_viewed` / recipient details in inventory events | Exclude | Outside inventory scope and explicitly belongs to last-mile domain. |
| `raw_sql_recorded` | Exclude | Can leak identifiers/data and creates high cardinality. Record logical `operation_name` instead. |
| `mouse_move_recorded` | Exclude | Extremely high volume with weak decision value for this backoffice. |
| `keystroke_recorded` | Exclude | Privacy/security risk and no justified business decision. |
| full frontend console/log capture | Exclude | Can leak sensitive values; use sanitised fingerprints/categories. |
| exact raw URL telemetry | Exclude | Can contain IDs/query strings; use normalized `route_template` or allowlisted `section_name`. |
| every successful DB query | Exclude initially | Cost/noise too high. Capture slow logical operations and rely on database-native metrics for the rest. |

### Main implementation risks

- **Duplicate events:** retries can cause double-counting. Use unique `eventId` and idempotent ingestion/deduplication.
- **Events emitted before transaction success:** would report business events that never happened. Emit success events after commit.
- **Schema drift:** producers must validate against `event-schemas.json`; schema changes require versioning and review.
- **High-cardinality fields:** avoid arbitrary error messages, raw URLs, SQL, free text, and dynamic keys.
- **PII leakage:** property allowlists and `additionalProperties: false` are mandatory controls, not optional documentation.
- **Clock skew:** timestamp should be generated by the authoritative producer where possible and stored in UTC.
- **Telemetry outage affecting production:** telemetry must fail safely; ordinary telemetry delivery failure must not roll back valid inventory operations. Buffer/retry out of band.
- **Cost growth:** sampling and aggregation apply to high-volume performance/navigation data, never to the five mandatory business/control events unless a future approved policy says otherwise.

## 11. Implementation contract for tomorrow's instrumentation work

1. Create a telemetry producer/helper shared by backend modules and a frontend client wrapper.
2. Validate every event against `event-schemas.json` before transport in development/test; production may use equivalent compiled validation for performance.
3. Add/propagate `requestId` across frontend → FastAPI → logs.
4. Generate `eventId` once per logical event and preserve it across retries.
5. Emit successful inventory events only after the database transaction commits.
6. Use only property keys explicitly defined for that `event_type`.
7. Sanitize/hide sensitive data before telemetry construction, not after ingestion.
8. Route stream events to the near-real-time path and batch events to durable storage/periodic aggregation.
9. Add automated tests for the five mandatory events first, then each additional event.
10. Monitor `telemetry_schema_rejected` and `telemetry_delivery_failed` so the telemetry system does not become another black box.

## 12. Acceptance checklist

- [x] Mandatory TrackFlow metrics included exactly: `inbound_order_created`, `outbound_order_created`, `stock_threshold_triggered`, `direct_stock_edit_rejected`, `inventory_discrepancy_detected`.
- [x] Inventory flow mapped with more than five instrumentation points.
- [x] Catalogue covers inventory, authentication, security, navigation, workflow abandonment, validation, backend/frontend errors, API performance, database performance, background processes, integrations, and telemetry quality.
- [x] Every event has a hypothesis and a concrete decision.
- [x] Every event is classified as `mandatory` or `identified opportunity`.
- [x] Standard event envelope defined with all required fields.
- [x] All mandatory events plus more than eight additional events are fully schema-defined.
- [x] Every event has an explicit property allowlist.
- [x] Sensitive/PII handling documented.
- [x] Stream vs. batch strategy justified by decision latency.
- [x] Throttle/debounce/sampling strategy documented.
- [x] Risks and exclusions documented.
- [x] `event-schemas.json` is valid JSON Schema draft-07.

## 13. Git delivery workflow

After review and approval:

```bash
git add docs/telemetry/telemetry-plan.md docs/telemetry/event-schemas.json
git commit -m "docs: add TrackFlow telemetry plan and event schemas"
git push
```

Open the PR for review. **Once the PR is approved, merge it into `main` before starting the next feature branch.** The next implementation branch must start from the approved telemetry design to avoid stale code and merge conflicts.
