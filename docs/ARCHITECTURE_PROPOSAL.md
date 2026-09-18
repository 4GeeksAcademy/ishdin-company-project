# TrackFlow Backend Architecture Proposal

**File:** `docs/ARCHITECTURE_PROPOSAL.md`  
**Project:** TrackFlow  
**Purpose:** Propose and justify a backend architecture for the TrackFlow transversal project.  
**Scope:** Architecture and organization only. This document intentionally contains no functional FastAPI implementation.

---

## 1. Executive Summary

TrackFlow is a last-mile delivery and warehouse management company operating in the United States and Spain. It runs warehouses in Los Angeles and Zaragoza, works with multiple carriers, manages returns, supports B2B brands and B2C recipients, and currently relies on fragmented systems such as two different warehouse solutions, a legacy ERP, point-to-point scripts, and databases in different cloud providers.

For this project, the recommended backend architecture is:

> **Layered Architecture with Hexagonal (Ports-and-Adapters) principles**

This architecture is the best fit because TrackFlow's most important rules—inventory accuracy, order processing, carrier selection, shipment tracking, returns, and client reporting—should remain independent from technologies that can change, such as a particular database, carrier API, warehouse system, AI provider, or frontend framework.

The proposal uses FastAPI as the API framework, groups routers by business domain, keeps business rules out of the HTTP layer, isolates external systems behind ports/interfaces, and keeps frontend and backend as separate systems that communicate only through versioned APIs.

---

## 2. TrackFlow Characteristics That Drive the Architecture

The architecture decision is based on TrackFlow's real operating conditions rather than a generic preference.

### 2.1 Two countries and two warehouse systems

TrackFlow has warehouses in Los Angeles and Zaragoza. The warehouses currently use different systems and do not have a single real-time inventory view.

This means the backend should not be tightly coupled to one warehouse technology. TrackFlow needs a stable business layer that can read from or write to different warehouse adapters.

### 2.2 Inventory accuracy is a core business responsibility

Every product movement matters. Receiving, picking, shipping, returning, and adjusting stock must be traceable because stock discrepancies can directly affect client contracts.

Therefore, inventory rules should live in a dedicated domain layer rather than inside route handlers or database code.

### 2.3 Multiple external carrier integrations

TrackFlow works with eight carriers across the United States and Spain. Carrier assignment, tracking, and performance measurement must work across different external APIs.

A Ports-and-Adapters approach allows each carrier integration to be implemented as an adapter without changing the core shipment or carrier-selection logic.

### 2.4 Legacy and fragmented technology

TrackFlow currently has:

- two warehouse management approaches,
- a legacy ERP,
- undocumented point-to-point Python scripts,
- databases in two cloud providers,
- no centralized telemetry.

This makes separation especially important. Replacing one external system should not require rewriting unrelated business logic.

### 2.5 AI and automation are expected to grow

TrackFlow plans to use AI for:

- return-condition classification from images,
- semantic/RAG-based customer support,
- intelligent carrier recommendations,
- natural-language executive assistance,
- automated reports and technical documentation.

AI providers and models can change over time. They should therefore be treated as external adapters rather than embedded directly inside core business rules.

### 2.6 Real-time and always-on operational needs

Inventory, tracking, dashboards, alerts, and customer support must be available continuously. The architecture should support reliable APIs, monitoring, and future event-driven integrations without forcing every feature into one tightly coupled module.

---

## 3. Architecture Decision

### Selected Architecture

**Layered Architecture with Hexagonal / Ports-and-Adapters principles**

The proposed backend is divided into clear responsibility layers:

```text
Client Applications
(Web, Mobile, Warehouse UI, Public Tracking Portal)
                         |
                         v
                 Presentation / API Layer
                       FastAPI
                         |
                         v
                  Application Layer
               Use Cases / Workflows
                         |
                         v
                    Domain Layer
             Core TrackFlow Business Rules
                         |
                    Ports / Interfaces
              /           |           \
             v            v            v
        Database      Carrier APIs    WMS / ERP / AI
        Adapter         Adapters         Adapters
```

### Why this is suitable for TrackFlow

The architecture keeps the **business core stable** while allowing the outside technologies to change.

Examples:

- TrackFlow can add a ninth carrier without rewriting inventory logic.
- Zaragoza can replace its current warehouse solution without rewriting shipment rules.
- The legacy ERP can later be replaced behind a new adapter.
- The AI model used for return inspection can change without changing the returns domain.
- PostgreSQL or another persistence technology can be changed with limited impact on domain rules.

---

## 4. Why MVC Is Not the Primary Choice

MVC separates an application into Model, View, and Controller. It is useful for many traditional web applications, especially applications centered around pages, forms, and CRUD operations.

TrackFlow, however, is integration-heavy and domain-heavy. Its backend must coordinate inventory, warehouses, orders, shipments, carriers, returns, client reporting, AI services, and legacy systems.

Using MVC as the main architectural pattern could encourage too much responsibility to accumulate in controllers or models, for example:

```text
Inventory Controller
    -> database
    -> WMS
    -> carrier API
    -> notification
    -> ERP
```

That would make the system harder to test and harder to change.

MVC concepts may still appear at the presentation level, but MVC is not the best overall backend architecture for TrackFlow.

---

## 5. Why Serverless Is Not the Primary Choice

Serverless is useful when code should run in response to a specific event or schedule.

TrackFlow could use serverless functions for selected tasks such as:

- generating a Monday report,
- processing an uploaded return image,
- sending a notification after a delivery event,
- running scheduled health checks,
- processing a file uploaded by a client.

However, TrackFlow's main backend contains long-lived business capabilities such as inventory, orders, shipments, returns, and carrier integrations. Designing the entire system as many independent functions would increase coordination and observability complexity.

Therefore:

> **Serverless can be a deployment option for selected supporting workloads, but it should not be the primary architecture for the TrackFlow backend.**

---

## 6. Proposed Backend Folder and Module Structure

The backend should use both **layer separation** and **business-domain separation**.

```text
backend/
|
|-- app/
|   |
|   |-- main.py
|   |
|   |-- api/
|   |   |-- dependencies.py
|   |   |-- schemas/
|   |   |   |-- inventory.py
|   |   |   |-- orders.py
|   |   |   |-- shipments.py
|   |   |   |-- carriers.py
|   |   |   |-- returns.py
|   |   |   |-- support.py
|   |   |   |-- clients.py
|   |   |   `-- analytics.py
|   |   |
|   |   `-- v1/
|   |       `-- routers/
|   |           |-- inventory.py
|   |           |-- warehouses.py
|   |           |-- orders.py
|   |           |-- shipments.py
|   |           |-- carriers.py
|   |           |-- returns.py
|   |           |-- support.py
|   |           |-- clients.py
|   |           `-- analytics.py
|   |
|   |-- application/
|   |   |-- inventory/
|   |   |-- orders/
|   |   |-- shipments/
|   |   |-- carriers/
|   |   |-- returns/
|   |   |-- support/
|   |   |-- clients/
|   |   `-- analytics/
|   |
|   |-- domain/
|   |   |-- inventory/
|   |   |   |-- entities.py
|   |   |   |-- services.py
|   |   |   `-- ports.py
|   |   |-- orders/
|   |   |-- shipments/
|   |   |-- carriers/
|   |   |-- returns/
|   |   |-- support/
|   |   `-- clients/
|   |
|   |-- infrastructure/
|   |   |-- persistence/
|   |   |   |-- database.py
|   |   |   |-- models/
|   |   |   `-- repositories/
|   |   |
|   |   |-- integrations/
|   |   |   |-- wms/
|   |   |   |   |-- los_angeles/
|   |   |   |   `-- zaragoza/
|   |   |   |-- carriers/
|   |   |   |-- erp/
|   |   |   |-- messaging/
|   |   |   `-- ai/
|   |   |
|   |   `-- observability/
|   |       |-- logging.py
|   |       |-- metrics.py
|   |       `-- monitoring.py
|   |
|   `-- core/
|       |-- settings.py
|       |-- security.py
|       |-- exceptions.py
|       `-- logging.py
|
|-- tests/
|   |-- unit/
|   |-- integration/
|   `-- api/
|
`-- pyproject.toml
```

---

## 7. Folder Responsibilities

### `app/main.py`

The FastAPI application entry point.

Its responsibilities should stay small:

- create the FastAPI application,
- register routers,
- register middleware,
- connect global exception handlers,
- initialize application startup/shutdown behavior.

Business rules should not be written here.

### `app/api/`

The HTTP boundary of the system.

It contains:

- FastAPI routers,
- request schemas,
- response schemas,
- API-specific dependencies.

The API layer should translate HTTP requests into application use cases and translate results into HTTP responses.

It should **not** contain inventory calculations, carrier-selection algorithms, return approval rules, or database queries.

### `app/application/`

This layer coordinates business use cases.

Examples:

- receive inventory,
- reserve inventory for an order,
- create a shipment,
- request a carrier recommendation,
- process a return,
- create a support ticket,
- generate a client report.

The application layer answers the question:

> "What business workflow should happen?"

It can call domain objects and ports, but should not depend directly on FastAPI or a specific external vendor SDK.

### `app/domain/`

This is the core TrackFlow business layer.

Examples of domain concepts:

- Product / SKU
- Warehouse
- Inventory
- Stock movement
- Order
- Shipment
- Carrier
- Return
- Client

This layer contains important rules such as:

- stock cannot become invalid because of a duplicate operation,
- a stock movement must be traceable,
- a return must satisfy the applicable approval policy,
- shipment and carrier decisions follow business constraints.

The domain layer should have the fewest external dependencies.

### `ports.py`

Ports define what the TrackFlow business needs without specifying which technology will provide it.

Conceptual examples:

- `InventoryRepository`
- `ShipmentRepository`
- `CarrierTrackingPort`
- `WarehouseSystemPort`
- `ERPPort`
- `ReturnInspectionPort`
- `NotificationPort`

A port describes a capability. An adapter implements that capability.

### `app/infrastructure/`

This layer contains technical implementations.

Examples:

- PostgreSQL repository implementations,
- carrier API clients,
- Los Angeles WMS adapter,
- Zaragoza warehouse-system adapter,
- legacy ERP integration,
- AI-provider integration,
- message broker integration,
- telemetry/logging implementation.

This is where technology-specific code belongs.

### `app/core/`

Cross-cutting application configuration.

Examples:

- environment settings,
- authentication/security helpers,
- common exception definitions,
- logging configuration.

This folder should remain small. It should not become a place for unrelated business logic.

---

## 8. Domain Separation Criteria

Modules should be separated by **business capability**, not merely by database table.

For example, TrackFlow should not organize the entire backend like this:

```text
controllers/
models/
services/
utils/
```

with hundreds of unrelated files mixed together.

Instead, the important business capabilities should remain recognizable:

```text
inventory
orders
shipments
carriers
returns
support
clients
analytics
```

This helps a developer answer questions such as:

> "Where do I change return approval behavior?"

The answer should clearly be the **returns domain**, rather than searching through a generic services folder.

### Proposed TrackFlow domains

| Domain | Main Responsibility |
|---|---|
| Inventory | Current stock, availability, reservations, stock movements |
| Warehouses | Warehouse locations and warehouse-specific operations |
| Orders | Order ingestion and order lifecycle |
| Shipments | Shipment creation and delivery lifecycle |
| Carriers | Carrier capabilities, selection, tracking, performance |
| Returns | Return authorization, collection, inspection and disposition |
| Support | B2B/B2C tickets, knowledge retrieval, escalation |
| Clients | Brand clients, contracts, profiles and client-facing reports |
| Analytics | Operational and executive read models/KPIs |

---

## 9. FastAPI Endpoint and Router Organization

FastAPI routers should be grouped by the same business domains used by the backend.

A versioned API prefix is recommended:

```text
/api/v1
```

This makes future API evolution easier.

### 9.1 Inventory Router

**Prefix:** `/api/v1/inventory`

Possible responsibilities:

- read stock by SKU,
- read stock by warehouse,
- receive stock,
- reserve/release stock,
- record stock movement,
- record an authorized stock adjustment,
- view movement history.

Example route shapes:

```text
GET  /api/v1/inventory/stock
GET  /api/v1/inventory/stock/{sku}
GET  /api/v1/inventory/movements
POST /api/v1/inventory/receipts
POST /api/v1/inventory/reservations
POST /api/v1/inventory/adjustments
```

### 9.2 Warehouses Router

**Prefix:** `/api/v1/warehouses`

Responsibilities:

- list warehouses,
- retrieve a warehouse,
- retrieve warehouse operational status,
- expose warehouse-specific inventory summaries.

### 9.3 Orders Router

**Prefix:** `/api/v1/orders`

Responsibilities:

- ingest orders,
- list/search orders,
- retrieve order details,
- update valid order workflow states.

TrackFlow's future automated email-order ingestion should call the same application use cases rather than create a separate set of business rules.

### 9.4 Shipments Router

**Prefix:** `/api/v1/shipments`

Responsibilities:

- create shipment records,
- retrieve shipment status,
- connect an order to a shipment,
- expose shipment timeline/events.

### 9.5 Carriers Router

**Prefix:** `/api/v1/carriers`

Responsibilities:

- list supported carriers,
- request a carrier recommendation,
- retrieve normalized tracking data,
- expose carrier performance metrics.

Possible route shapes:

```text
GET  /api/v1/carriers
POST /api/v1/carriers/recommendations
GET  /api/v1/carriers/tracking/{tracking_number}
GET  /api/v1/carriers/performance
```

The public parcel-tracking experience can use a separate public-facing endpoint or API gateway policy while still calling the same shipment/tracking application services.

### 9.6 Returns Router

**Prefix:** `/api/v1/returns`

Responsibilities:

- create return requests,
- evaluate approval rules,
- create collection requests,
- retrieve return status,
- submit an inspection,
- retrieve return analytics.

An AI image-condition classifier should be accessed through a port from the returns application/domain logic rather than called directly from the FastAPI router.

### 9.7 Support Router

**Prefix:** `/api/v1/support`

Responsibilities:

- create and update tickets,
- retrieve ticket history,
- search approved knowledge,
- request automated first-line assistance,
- escalate to a human agent.

### 9.8 Clients Router

**Prefix:** `/api/v1/clients`

Responsibilities:

- retrieve client profiles,
- retrieve client logistics summaries,
- request/generate reports,
- expose renewal-related information when permitted.

### 9.9 Analytics Router

**Prefix:** `/api/v1/analytics`

Responsibilities:

- warehouse KPIs,
- carrier KPIs,
- returns KPIs,
- CX metrics,
- executive country comparison,
- dashboard read models.

This router should mainly expose aggregated read data. It should not become a place where every domain's business logic is implemented.

### 9.10 Health and Operations Endpoints

Operational health endpoints can remain separate from business API versioning, for example:

```text
GET /health
GET /ready
```

These are for monitoring and deployment health rather than TrackFlow business operations.

---

## 10. Router Grouping Rules

The following rules should be followed consistently.

### Rule 1: Group by domain, not HTTP verb

Good:

```text
inventory.py
orders.py
returns.py
carriers.py
```

Avoid:

```text
get_routes.py
post_routes.py
delete_routes.py
```

### Rule 2: Routers should stay thin

A router should normally:

1. receive HTTP input,
2. validate it,
3. call an application use case,
4. return a response.

A router should not contain large business workflows.

### Rule 3: Do not call vendor systems directly from routers

Avoid:

```text
carrier router -> FedEx SDK directly
```

Prefer:

```text
carrier router
      -> application service
      -> carrier tracking port
      -> FedEx adapter
```

### Rule 4: Keep API schemas separate from database models

A database model represents persistence.

A Pydantic request/response schema represents the API contract.

They may contain similar fields, but they have different responsibilities and should not be treated as the same object.

---

## 11. Research: How FastAPI Projects Are Commonly Structured

FastAPI does not require one fixed folder structure. Its official documentation shows how larger applications can be split into multiple files using:

- `main.py`,
- `dependencies.py`,
- a `routers/` package,
- multiple `APIRouter` objects,
- `include_router()` to compose routers into the application.

TrackFlow follows that standard idea but extends it with application, domain, and infrastructure layers because TrackFlow has significantly more business and integration complexity than the small example in the FastAPI documentation.

### How FastAPI conventions influence this proposal

#### `main.py` remains a composition point

FastAPI's bigger-application guidance encourages routers to be included in the main application rather than defining every endpoint in one file.

TrackFlow therefore uses `main.py` primarily to assemble the API.

#### `APIRouter` is used per business domain

FastAPI's `APIRouter` supports splitting related path operations into separate modules.

TrackFlow maps this to business domains such as inventory, orders, carriers, and returns.

#### Request and response models use Pydantic

FastAPI supports typed request/response models and can validate/filter API output according to declared response models.

TrackFlow therefore keeps explicit API schemas separate from persistence models and domain entities.

#### Configuration comes from environment variables

FastAPI documentation recommends external configuration for values such as database URLs and secrets.

TrackFlow will therefore keep environment-specific configuration outside source code.

Examples of configuration values:

```text
DATABASE_URL
ALLOWED_ORIGINS
ERP_BASE_URL
ERP_API_KEY
WMS_US_BASE_URL
WMS_ES_BASE_URL
CARRIER_*_API_KEY
AI_PROVIDER_API_KEY
LOG_LEVEL
```

Secrets should never be committed to the repository.

---

## 12. Frontend and Backend as Separate Systems

TrackFlow's frontend and backend should be treated as separate applications even if they live in the same Git repository.

### Recommended repository strategy for this project: Monorepo

For the transversal project, a monorepo is recommended because it keeps project documentation, frontend, and backend changes together while the team is still relatively small.

Example:

```text
trackflow/
|
|-- frontend/
|
|-- backend/
|
|-- docs/
|   `-- ARCHITECTURE_PROPOSAL.md
|
`-- README.md
```

The applications must still remain operationally independent:

- frontend should not import Python backend code,
- backend should not depend on frontend source files,
- communication occurs through HTTP APIs,
- each application should have its own dependencies and environment configuration.

If TrackFlow later has large independent teams or independent release cycles, the applications could be split into separate repositories without changing the API boundary.

---

## 13. Frontend-to-Backend API Communication

The frontend should communicate with TrackFlow through the documented API rather than directly accessing databases or external carrier systems.

```text
Frontend
    |
    | HTTPS / JSON
    v
FastAPI
    |
    v
Application / Domain
    |
    v
Infrastructure / External Systems
```

Benefits:

- one place enforces TrackFlow business rules,
- credentials stay on the server,
- carrier integrations are hidden from the browser,
- frontend changes do not require database access,
- backend changes can remain compatible through API versioning.

---

## 14. Environment Variables

Frontend and backend will normally have different configuration values.

### Backend environment examples

```text
DATABASE_URL
ALLOWED_ORIGINS
ERP_BASE_URL
WMS_US_BASE_URL
WMS_ES_BASE_URL
CARRIER_API_KEYS
AI_PROVIDER_API_KEY
```

### Frontend environment example

```text
API_BASE_URL
```

The actual variable name can be adapted to the frontend framework.

Development, staging, and production should each have their own values.

For example:

```text
Development API: http://localhost:8000/api/v1
Production API:  https://api.trackflow.example/api/v1
```

URLs and credentials should not be hard-coded into application logic.

---

## 15. CORS Considerations

When a browser frontend and FastAPI backend run on different origins, the backend must explicitly allow the frontend origin through CORS configuration.

For example:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

These are different origins because the ports differ.

FastAPI provides `CORSMiddleware` for this purpose.

For TrackFlow:

- development should allow only known development frontend origins,
- staging should allow only staging frontend origins,
- production should allow only approved production origins,
- a wildcard (`*`) should not be used as the default production approach, especially when authentication credentials or authorization headers are involved.

The allowed origins should come from environment configuration.

---

## 16. Dependency Direction

The dependency direction should point toward the business core.

```text
API
 |
 v
Application
 |
 v
Domain

Infrastructure ---> implements Domain/Application ports
```

The domain should not import:

- FastAPI,
- SQLAlchemy or a specific database library,
- a carrier SDK,
- a specific AI SDK,
- a WMS vendor SDK.

This protects the most valuable TrackFlow rules from infrastructure changes.

---

## 17. Example TrackFlow Request Flow

### Example: Unified carrier tracking

```text
1. Frontend requests parcel status.
        |
        v
2. FastAPI carriers/tracking router receives the request.
        |
        v
3. Application service requests normalized tracking information.
        |
        v
4. CarrierTrackingPort is called.
        |
        v
5. Correct carrier adapter calls UPS/FedEx/DHL/MRW/SEUR/etc.
        |
        v
6. Adapter converts vendor-specific data into TrackFlow's common format.
        |
        v
7. Application returns normalized tracking result.
        |
        v
8. FastAPI returns a consistent response to the frontend.
```

The frontend does not need to understand eight different carrier APIs.

### Example: Return condition inspection

```text
1. Operative submits return inspection and product image.
        |
        v
2. Returns router calls the return-inspection use case.
        |
        v
3. Application/domain applies return rules.
        |
        v
4. ReturnInspectionPort sends the image to the configured AI adapter.
        |
        v
5. AI adapter returns a normalized condition assessment.
        |
        v
6. TrackFlow records the assessment and business decision.
```

A future AI model can be swapped without redesigning the entire returns API.

---

## 18. Future Event-Driven Extension

Event-driven communication is not being selected as the main architecture from the assignment's three choices, but it can complement the layered/hexagonal design.

Examples of meaningful TrackFlow business events:

```text
InventoryReceived
InventoryAdjusted
OrderCreated
ShipmentDispatched
ShipmentDelivered
ReturnApproved
ReturnInspected
LowStockDetected
```

A future message broker could allow notifications, dashboards, analytics, and automation to react to these events without placing all secondary work inside the original HTTP request.

The domain/application layers should remain the owners of business decisions, while event publishing is implemented through ports/adapters.

---

## 19. Testing Strategy Implied by the Architecture

### Unit tests

Test domain rules without requiring:

- FastAPI,
- a real database,
- carrier APIs,
- ERP,
- AI services.

Examples:

- inventory movement calculations,
- return approval rules,
- carrier-selection rules.

### Integration tests

Test adapters and infrastructure boundaries:

- repository + database,
- carrier client adapters,
- WMS integrations,
- ERP integration.

### API tests

Test:

- request validation,
- HTTP status codes,
- authentication/authorization,
- response schemas,
- router-to-application integration.

This separation makes failures easier to diagnose.

---

## 20. Risks and Points of Attention

### Risk 1: Business logic leaks into FastAPI routers

If developers place inventory calculations, return policies, or carrier rules directly inside route functions, the architecture will slowly become controller-heavy.

**Impact:**

- difficult unit testing,
- duplicated logic,
- harder reuse from scheduled jobs or future event consumers,
- stronger coupling to FastAPI.

**Mitigation:**

Keep routers thin and require business workflows to go through application use cases/domain services.

---

### Risk 2: External vendor code leaks into the domain

If the domain imports UPS, FedEx, ERP, WMS, or AI-provider SDKs directly, TrackFlow becomes tightly coupled to those vendors.

**Impact:**

- vendor replacement becomes expensive,
- tests require external libraries/services,
- domain logic becomes polluted with vendor-specific formats.

**Mitigation:**

Define TrackFlow-owned ports/interfaces and implement vendor-specific adapters in the infrastructure layer.

---

### Risk 3: API schemas and database models become the same thing

Reusing database models directly as public API contracts can expose internal fields and make database changes break frontend clients.

**Mitigation:**

Use explicit Pydantic request/response schemas and map them to domain/persistence objects.

---

### Risk 4: A generic `utils/` or `services/` folder becomes a dumping ground

As the project grows, developers may put unrelated logic into broad generic folders.

**Impact:**

- unclear ownership,
- duplicated helpers,
- difficult navigation,
- accidental coupling between domains.

**Mitigation:**

Prefer domain-owned modules and keep shared/core modules small and genuinely cross-cutting.

---

### Risk 5: Inconsistent inventory updates across systems

TrackFlow's inventory accuracy is contractually important. If a database update succeeds but a connected system or integration update fails, systems can disagree about stock.

**Mitigation:**

- define one authoritative inventory workflow,
- record auditable stock movements,
- use idempotency for retryable operations,
- design integrations for retry/failure handling,
- consider transactional outbox/event-processing patterns when asynchronous integration is introduced.

---

### Risk 6: Overengineering the first version

Hexagonal architecture can become unnecessarily complicated if every tiny function is turned into an interface or abstract class.

**Mitigation:**

Create ports only at meaningful boundaries—database repositories, WMS, carriers, ERP, messaging, notifications, and AI/external services. Keep simple internal code simple.

---

### Risk 7: Incorrect CORS or environment configuration

If frontend and backend environments are not configured consistently, requests may fail or security rules may become too permissive.

**Mitigation:**

- store allowed origins in environment-specific configuration,
- explicitly list trusted origins,
- document local/staging/production API base URLs,
- never commit secrets.

---

## 21. Architectural Guardrails for the Team

The team should follow these rules:

1. **Routers do HTTP work, not business work.**
2. **Application services coordinate use cases.**
3. **Domain modules own core TrackFlow rules.**
4. **Infrastructure implements technical details.**
5. **External vendors are accessed through ports/adapters.**
6. **Pydantic API schemas are separate from database models.**
7. **Configuration and secrets come from the environment.**
8. **Routers are grouped by business domain.**
9. **Frontend communicates with backend only through documented APIs.**
10. **New features should be placed in the domain that owns the business responsibility.**

---

## 22. Final Recommendation

TrackFlow should use **Layered Architecture with Hexagonal / Ports-and-Adapters principles** as the primary backend architectural pattern.

This choice is specifically justified by TrackFlow's situation:

- two countries,
- different warehouse systems,
- no unified inventory view,
- eight carrier integrations,
- a legacy ERP,
- fragmented databases and scripts,
- real-time operational requirements,
- returns workflows,
- B2B and B2C support,
- future AI integrations,
- a need for centralized dashboards and monitoring.

The architecture keeps the stable part—TrackFlow's logistics business rules—separate from the unstable part—vendors, frameworks, databases, external APIs, and AI technologies.

FastAPI fits this design well because its `APIRouter` structure supports domain-based API modules, Pydantic supports explicit request/response contracts, and environment-based settings and CORS middleware support clean separation between frontend and backend applications.

For the current transversal project, a **monorepo with independently organized `frontend/` and `backend/` applications plus a shared `docs/` directory** provides a practical balance between simplicity and separation.

---

## 23. Research Sources

### TrackFlow project context

- 4Geeks Academy, **TrackFlow Company Briefing**  
  https://github.com/4GeeksAcademy/ai-engineering-syllabus/blob/main/content/contexts/00-general-contexts/CONTEXT-trackflow-briefing.en.md

### FastAPI project organization

- FastAPI, **Bigger Applications - Multiple Files**  
  https://fastapi.tiangolo.com/tutorial/bigger-applications/

  Used to inform the decision to keep `main.py` small, split routes into domain-specific modules, and compose the application with `APIRouter` and `include_router()`.

### FastAPI response models

- FastAPI, **Response Model - Return Type**  
  https://fastapi.tiangolo.com/tutorial/response-model/

  Used to support explicit request/response API contracts and the separation of API schemas from persistence models.

### FastAPI settings and environment variables

- FastAPI, **Settings and Environment Variables**  
  https://fastapi.tiangolo.com/advanced/settings/

  Used to support external configuration for database URLs, service endpoints, secrets, allowed origins, and environment-specific values.

### FastAPI CORS

- FastAPI, **CORS (Cross-Origin Resource Sharing)**  
  https://fastapi.tiangolo.com/tutorial/cors/

  Used to document frontend/backend separation when the applications run on different origins and to justify explicit allowed-origin configuration.

---

## 24. Short Architecture Summary

```text
                   TRACKFLOW CLIENTS
        Web / Mobile / Warehouse / Tracking
                          |
                          v
                     FastAPI API
                 Domain-based Routers
                          |
                          v
                  Application Use Cases
                          |
                          v
                 TrackFlow Domain Core
           Inventory / Orders / Shipments /
          Carriers / Returns / Support / Clients
                          |
                    Ports / Interfaces
             /            |             \
            v             v              v
       Persistence     External APIs     AI / WMS / ERP
        Adapters          Adapters          Adapters
```

**Primary architecture:** Layered + Hexagonal / Ports-and-Adapters  
**API framework:** FastAPI  
**API organization:** Domain-based `APIRouter` modules  
**Repository recommendation:** Monorepo with separate frontend and backend applications  
**Configuration:** Environment-based  
**Frontend/backend communication:** Versioned HTTP/JSON APIs  
**CORS:** Explicit environment-specific allowed origins  
**Main design goal:** Keep TrackFlow business rules independent from infrastructure and external vendors.
