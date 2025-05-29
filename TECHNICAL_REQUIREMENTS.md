# CityHelper – Technical Requirements

Version: 0.9 • Date: 2025-05-28  
Owner: Platform Engineering

---

## 1. Introduction
This document enumerates **functional** and **non-functional** requirements for the CityHelper MVP-1 release (NYC). It is the contract between Product, Engineering, QA and Security, and will be used by Code agents as the single source of truth during implementation and verification.

---

## 2. Glossary
| Term | Definition |
|------|------------|
| 311 API | Public NYC 311 service-request API |
| Geoclient | NYC Department of City Planning geocoding API |
| SPA | Single Page Application |
| SLA | Service Level Agreement |
| RPO / RTO | Recovery Point / Time Objective |

---

## 3. Scope
Initial release targets **public web access** for NYC citizens and **internal admin** users. The system must be city-agnostic for future onboarding.

---

## 4. Functional Requirements

### 4.1 Citizen Portal
| ID | Requirement | Priority |
|----|-------------|----------|
| F-CIT-01 | Users can submit a new service request (pothole, noise, etc.) with description, category, photo, and location (address lookup or map pin). | Must |
| F-CIT-02 | Submission auto-creates record in local DB **and** forwards to NYC 311 API; return 311 tracking number. | Must |
| F-CIT-03 | Users can view status of their requests (Open, In Progress, Closed) with real-time updates (polling or WebSocket). | Must |
| F-CIT-04 | Users can search city assets/events within map viewport and filter by type. | Should |
| F-CIT-05 | Anonymous usage allowed; optional account creation with email/password or social login. | Should |

### 4.2 Admin & City Staff
| ID | Requirement | Priority |
|----|-------------|----------|
| F-ADM-01 | Authenticated staff can view, filter, sort, and export all service requests. | Must |
| F-ADM-02 | Admin can create/update city asset records (parks, vehicles, sensors). | Must |
| F-ADM-03 | Role-based access control: `admin`, `analyst`, `viewer`. | Must |
| F-ADM-04 | Admin dashboard shows live metrics (# open tickets, avg resolution time, heatmap). | Should |

### 4.3 Data Synchronisation & ETL
| ID | Requirement | Priority |
|----|-------------|----------|
| F-ETL-01 | Nightly cron pulls selected NYC Open Data datasets and upserts local tables. | Must |
| F-ETL-02 | Geocoding calls to Geoclient cached for 24 h; expire earlier if underlying data changed. | Must |

### 4.4 Notifications
| ID | Requirement | Priority |
|----|-------------|----------|
| F-NOT-01 | Upon request creation, send confirmation email/SMS (Twilio placeholder) if contact info provided. | Should |
| F-NOT-02 | Send status-change push via WebSocket to connected clients. | Should |

### 4.5 Multicity Support
| ID | Requirement | Priority |
|----|-------------|----------|
| F-MC-01 | Request/asset records include `city_id`; all API endpoints scoped by city. | Must |
| F-MC-02 | City-specific API credentials stored per-city in secure table. | Must |

---

## 5. Non-Functional Requirements

### 5.1 Performance & Capacity
| Metric | Target |
|--------|--------|
| P95 API read latency | ≤ 200 ms |
| P95 API write latency | ≤ 400 ms |
| Homepage TTI (3G, mid-tier phone) | ≤ 3 s |
| Concurrent active users (MVP) | 1 000 |
| Horizontal scalability | 10 × with no code change |

### 5.2 Availability & Resilience
| Aspect | Requirement |
|--------|-------------|
| Uptime | ≥ 99.9 % monthly |
| RPO | ≤ 5 min |
| RTO | ≤ 15 min |
| Degraded mode | If external APIs fail, queue retries; citizen sees “Pending external” status |

### 5.3 Security & Compliance
| Area | Requirement |
|------|-------------|
| Transport | All traffic TLS 1.2+ |
| Auth | OAuth 2.1 (password & device code), JWTs in http-only SameSite cookies |
| RBAC | Enforced via Casbin policies |
| Data at rest | AES-256 column encryption for PII (`email`, `phone`) |
| OWASP | Mitigations for Top-10 (CSRF, XSS, SQLi, IDOR, etc.) |
| Audit | Append-only log for privileged actions; 1-year retention |
| Privacy | GDPR-style deletion: user can request removal of personal data |

### 5.4 Accessibility
WCAG 2.1 AA compliance for all user-facing screens.

### 5.5 Observability
| Item | Requirement |
|------|-------------|
| Metrics | Request rate, latency, error %, CPU, memory exported via Prometheus |
| Tracing | OpenTelemetry spans across frontend & backend |
| Log structure | JSON lines, 30 d retention, PII redaction middleware |

### 5.6 Internationalisation
System text externalised via i18n; support at least `en`, scaffold for future locales.

---

## 6. External Integration Points

| Integration | Protocol | Auth | Rate Limits |
|-------------|----------|------|-------------|
| NYC 311 API | REST JSON | API Key header | 10 RPS |
| Geoclient | REST JSON | `app_id`, `app_key` | 100 000 / day |
| NYC Open Data (Socrata) | REST/CSV | App token optional | 1 GB / day |
| NYC Benefits Screening | REST JSON | OAuth client creds | TBD |
| Email (SendGrid) | HTTP API | Bearer | 600/min |
| SMS (Twilio) | HTTP API | Basic | 1 TPS (trial) |

---

## 7. Technical Specifications

### 7.1 Tech Stack
| Tier | Technology | Version |
|------|------------|---------|
| Frontend | React 18, Vite, TypeScript 5, shadcn/ui (Tailwind 3) |
| Backend | FastAPI 0.111, Python 3.12 |
| ORM | SQLModel 0.0.16 |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Message Broker | Redis 7 Streams |
| Containerisation | Docker 26, OCI |
| CI/CD | GitHub Actions, Vercel (frontend), Railway (API+DB) |
| IaC | Terraform 1.7 |

### 7.2 API Conventions
* Base path `/api/v1/`
* JSON:API style (camelCase)  
* Pagination: `page[size]`, `page[number]`  
* Errors: RFC 7807 Problem+JSON

### 7.3 Data Validation & Schema
* Pydantic v2 models with type-checked fields  
* Zod schemas mirrored in frontend  
* Latitude/longitude stored as `GEOGRAPHY(Point,4326)`

### 7.4 Authentication & Sessions
1. User login → `/auth/token` returns access (15 min) + refresh (14 d) JWT.  
2. Http-only cookie `cityhelper_refresh` rotates via `/auth/refresh`.  
3. CSRF token double submit for state-changing endpoints.

---

## 8. Environmental Requirements
| Env | Purpose | Notes |
|-----|---------|-------|
| `local` | Dev on Docker Compose; hot reload | uses MailHog & Loki |
| `staging` | QA & UAT, seeded w/ anonymised prod snapshot | behind basic auth |
| `prod` | Public | multi-AZ, blue/green deploys |

---

## 9. Quality & Testing

| Level | Tooling | Coverage Target |
|-------|---------|-----------------|
| Unit | pytest, React Testing Library | 80 % lines |
| API Contract | Schemathesis | 100 % endpoints |
| E2E | Playwright Cloud | Critical flows |
| Performance | k6 scripts (login, submit, dashboard) | Pass perf SLOs |
| Security | Snyk, Bandit, OWASP ZAP CI | Zero high-sev |

---

## 10. Deployment & Release

1. **Merge to `main`** triggers build, tests, container publish.  
2. If tests green → auto-deploy to staging; manual promotion to prod.  
3. Semantic versioning `MAJOR.MINOR.PATCH`.  
4. Rollback via GitHub Actions workflow: select previous container tag.

---

## 11. Open Issues & Future Work
| Ref | Description |
|-----|-------------|
| NF-PERF-01 | Stress test Broker at 5 k events/s |
| F-CIT-06 | Multilingual content for Spanish users |
| SEC-02 | Evaluate WebAuthn passwordless login |

---

## 12. Approval
| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Tech Lead | | | |
| Security | | | |

---
