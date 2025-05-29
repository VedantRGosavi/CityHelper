# CityHelper ‑ System Architecture

## 1. Purpose & Scope
This document describes the **reference architecture** for the first public release (“MVP-1”) of CityHelper, initially targeting New York City (NYC) but designed for rapid replication to additional municipalities.  
It guides implementation teams (Code agents) and informs stakeholders of the technical approach, interfaces, data contracts, and operational characteristics.

---

## 2. Guiding Principles
1. **Web-first, mobile-friendly**: Ship usable product within 24 h; responsive React SPA instead of native store releases.  
2. **Modular services**: Clear separation of frontend, backend API, data, integrations.  
3. **API-first**: All functionality exposed through versioned REST (and future GraphQL) endpoints.  
4. **Scalable & city-agnostic**: Configuration, not code, to onboard new cities.  
5. **Secure by default**: TLS everywhere, OWASP compliance, least-privilege keys for external APIs.  
6. **Automated CI/CD**: Push-to-deploy with rollback, infrastructure as code.

---

## 3. High-Level Architecture

```
[ User Browser ]
       │ HTTPS
       ▼
[ React + shadcn UI SPA ]
       │ REST/WS
       ▼
[ API Gateway (FastAPI) ]──┬─►[ NYC Integrations Adapter ]
       │                   │
       │ ORM               │ ingest/transform
       ▼                   │
[ PostgreSQL + PostGIS ]   │
       │                   │
       └─►[ Message Broker ]◄─ asynchronous events
       │
[ Observability Stack ]
```

*Description*:  
1. **SPA** serves static assets via CDN; interacts with backend via JSON REST & WebSocket for real-time updates.  
2. **API Gateway** (FastAPI, Uvicorn/Gunicorn) hosts business services and authentication.  
3. **NYC Integrations Adapter** encapsulates external API calls (311, Geoclient, etc.), with caching and rate-limit handling.  
4. **PostgreSQL/PostGIS** persists core entities.  
5. **Message Broker** (Redis Streams for MVP) enables decoupled background jobs (notifications, ETL).  
6. **Observability Stack** (Prometheus, Grafana, Loki) captures metrics, logs, traces.

---

## 4. Component Breakdown

### 4.1 Frontend (Web)
| Concern | Implementation |
|---------|----------------|
| Framework | React 18 + Vite |
| UI Kit | `shadcn/ui` (Radix + Tailwind CSS) |
| State | TanStack Query + Zustand |
| Routing | React Router v6 |
| Form Handling | React-Hook-Form w/ Zod validation |
| Auth | JWT access/refresh stored in http-only cookies |
| Intl | `react-i18next` |

### 4.2 Backend API
| Layer | Details |
|-------|---------|
| Framework | FastAPI (ASGI), Python 3.12 |
| Packaging | Poetry |
| AuthN/Z | OAuth 2.1 password & device-code grant; role-based policies via **Casbin** |
| ORM | SQLModel (Pydantic v2 models + SQLAlchemy) |
| Background tasks | FastAPI‐Workers + Celery (future) |
| OpenAPI | Auto-generated `/docs`, versioned `/v1` |
| Rate limiting | SlowAPI (Redis backend) |

### 4.3 Data Layer
Entity highlights:

| Table | Purpose |
|-------|---------|
| `citizens` | optional authenticated user profiles |
| `service_requests` | unified schema for 311 + custom submissions |
| `assets` | city resources (parks, sensors, vehicles) |
| `events` | public events calendar |
| `integrations` | per-city API credentials & quotas |

Indices on geospatial columns for proximity queries.

### 4.4 Integrations Adapter
| External API | Usage | Auth |
|--------------|-------|------|
| NYC 311 Open API | Create & fetch service requests | API Key |
| Geoclient V1 | Geocoding, reverse geocoding | `app_id` + `app_key` |
| NYC Open Data (Socrata) | Bulk datasets (e.g., potholes) | Application token (optional) |
| NYC Benefits Screening | Eligibility wizard | Client credentials |

Adapter layer normalises disparate payloads into internal DTOs.

### 4.5 Messaging & Notifications
For MVP: Redis Streams; future Kafka.  
Events: `service_request.created`, `city_data.ingested`, `alert.sent`.

### 4.6 DevOps / Infrastructure
| Environment | Provider | Notes |
|-------------|----------|-------|
| Preview | Vercel (frontend) + Railway (backend/db) | PR-per-preview |
| Production | AWS (ECS Fargate) or Fly.io | Managed Postgres, S3 asset storage |
| IaC | Terraform | Separate state per env |
| CI/CD | GitHub Actions workflows → Vercel / Railway / Terraform Cloud |

---

## 5. Data Flow

1. **Citizen submits issue**  
   a. SPA form → `POST /v1/service-requests`  
   b. API validates, geocodes via Geoclient, persists to DB.  
   c. Adapter posts to NYC 311, stores 311 `tracking_number`.  
   d. Event emitted to Stream → worker sends confirmation email/SMS.

2. **Dashboard listing**  
   a. SPA queries `/v1/service-requests?bbox=` for map viewport.  
   b. API executes PostGIS spatial query, returns GeoJSON.

3. **Nightly dataset sync**  
   a. Cron worker calls NYC Open Data endpoints.  
   b. ETL transforms to internal models, upserts DB.  
   c. Emits `city_data.ingested` event → cache invalidation.

---

## 6. Technology Rationale

| Category | Selected | Rationale |
|----------|----------|-----------|
| Frontend | React + shadcn | fastest iteration, full component code ownership |
| Backend | FastAPI | type-safe, async, auto docs, high throughput |
| DB | PostgreSQL + PostGIS | ACID integrity, native geospatial, mature |
| Broker | Redis Streams | zero-config, inexpensive, upgrade path to Kafka |
| Hosting | Vercel / Railway | one-click deploy, free tiers for MVP |

---

## 7. Multicity Strategy

* `integrations` table parametrises API keys, endpoint URLs, field mappings per city.  
* City selection handled by subdomain (`nyc.cityhelper.ai`) or request header.  
* New city onboarding script generates config rows and seeds default datasets.  
* UI and API include `city_id` in all primary keys; sharding feasible via Citus if scale demands.

---

## 8. Security & Compliance

* HTTPS enforced, HSTS 12 mo.  
* OWASP Top-10 mitigations (CSRF via same-site cookies, input sanitisation).  
* PII encryption at rest (AES-256 column level).  
* SOC 2 ready: audit logging, RBAC, secrets management (AWS Secrets Manager).  
* Rate-limit external API keys; rotating keys stored in Vault.

---

## 9. Non-Functional Requirements

| Metric | Target |
|--------|--------|
| Availability | 99.9 % monthly |
| P95 API latency | < 200 ms (read), < 400 ms (write) |
| Initial load TTI | < 3 s on 3G mobile |
| Scalability | 1 → 1000 RPS without redesign |
| Data durability | RPO < 5 min, RTO < 15 min |

---

## 10. Deployment Topology

1. **Frontend**: Vercel Edge CDN → Static SPA + SSR API routes (future).  
2. **API**: Docker image → AWS ECS Fargate cluster (min 2 tasks across AZs).  
3. **Database**: AWS RDS Postgres (Multi-AZ), 1 read replica.  
4. **Cache & Broker**: AWS Elasticache Redis.  
5. **Observability**: Prometheus sidecars scrape ECS; Grafana Cloud dashboards.

---

## 11. Future Enhancements

| Idea | Benefit |
|------|---------|
| Native iOS/Android wrappers (Capacitor/React Native) | app-store presence |
| GraphQL gateway | flexible data retrieval for partners |
| ML-based prioritisation of service requests | faster SLA compliance |
| Real-time websockets with htmx/server-sent events | push notifications without polling |
| Multi-tenant SaaS admin portal | self-service onboarding for new cities |

---

## 12. Appendix – Key Links

* NYC 311 API docs: https://api.nyc.gov/311/  
* Geoclient API docs: https://maps.nyc.gov/geoclient/v1/doc  
* NYC Open Data portal: https://data.cityofnewyork.us/  

---

*Last updated: 2025-05-28*
