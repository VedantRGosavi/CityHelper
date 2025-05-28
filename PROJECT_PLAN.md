# PROJECT_PLAN.md  
CityHelper – Rapid MVP & Scalable Foundation  
Version 1.0 • 2025-05-28  

---

## 1 | Project Overview
CityHelper delivers a web-first platform for citizens to report issues, view city data, and for staff to manage resources—starting with NYC, designed for multi-city rollout. Primary objective: **public MVP in 24 h**, with production-hardening and scalability improvements in the following 3 weeks.

---

## 2 | Schedule at-a-Glance

| Phase | Duration | Start | End | Key Milestone |
|-------|----------|-------|-----|---------------|
| 0. Kick-off & Charter | 2 h | T0 | T0+2h | Team aligned, repo scaffolded |
| 1. Environment & CI/CD | 6 h | T0+2h | T0+8h | Green pipeline, infra live |
| 2. Sprint-0 MVP Build | 16 h | T0+8h | T0+24h | MVP deployed **(M1)** |
| 3. Hardening & QA | 5 d | T0+24h | T0+6d | Stable build, test pass **(M2)** |
| 4. Beta & UAT (NYC) | 5 d | T0+6d | T0+11d | City stakeholder sign-off **(M3)** |
| 5. Production Launch | 1 d | T0+11d | T0+12d | Public release **(M4)** |
| 6. Post-launch Scaling | 10 d | T0+12d | T0+22d | Multicity ready **(M5)** |

*Total calendar: 22 days (incl. MVP in first 24 h).*

---

## 3 | Milestones & Exit Criteria

| ID | Milestone | Exit Criteria |
|----|-----------|---------------|
| M1 | 24 h MVP | React SPA (submit/view request), FastAPI endpoints, Postgres schema, NYC 311 proxy, deployed on Vercel/Railway; basic auth; unit tests ≥60 %, CI green |
| M2 | Stable Build | ≥80 % unit coverage, E2E smoke suite pass, load test 200 RPS, OWASP scan no high findings, 99.9 % uptime in staging 24 h |
| M3 | NYC Beta Approval | City staff portal functional, data sync jobs run nightly, SLA dashboards, stakeholder sign-off |
| M4 | GA Launch | Production infra live, runbook complete, on-call rotation set, rollback tested |
| M5 | Multicity Readiness | Dynamic `city_id` config, onboarding script documented/tested, performance tests 1 k RPS, infra costs <$1 k/mo baseline |

---

## 4 | Work Breakdown Structure (WBS)

| # | Task | Owner | Est (h) | Dep |
|---|------|-------|---------|-----|
| 1.1 | Kick-off meeting, roles & tools | PM | 0.5 | — |
| 1.2 | Repo import & branch strategy | DevOps | 0.5 | 1.1 |
| 2.1 | IaC skeleton (Terraform) | DevOps | 2 | 1.2 |
| 2.2 | Vercel & Railway projects | DevOps | 1 | 2.1 |
| 2.3 | GitHub Actions pipeline | DevOps | 3 | 2.1 |
| 3.1 | FastAPI scaffolding + health route | BE | 1 | 2.2 |
| 3.2 | Postgres schema (SQLModel) | BE | 2 | 3.1 |
| 3.3 | 311 adapter stub | BE | 2 | 3.2 |
| 3.4 | Core APIs: `/service-requests` CRUD | BE | 3 | 3.2 |
| 3.5 | Unit tests & OpenAPI review | BE | 2 | 3.4 |
| 3.6 | React project scaffold (Vite, Tailwind, shadcn) | FE | 1.5 | 2.2 |
| 3.7 | Auth screens & JWT flow | FE | 2 | 3.6 |
| 3.8 | Submit request form w/ map lookup | FE | 3 | 3.7, 3.4 |
| 3.9 | Request list & detail pages | FE | 2 | 3.8 |
| 3.10 | Cypress/Playwright smoke tests | QA | 2 | 3.9 |
| 4.1 | Security hardening (OWASP headers, rate-limit) | BE | 4 | 3.5 |
| 4.2 | Load test (k6) & tuning | QA | 4 | 3.5 |
| 4.3 | API monitoring dashboards | DevOps | 3 | 4.2 |
| 4.4 | Staff portal (table + filters) | FE | 6 | 3.9 |
| 4.5 | Nightly ETL job (Open Data) | BE | 6 | 3.5 |
| 5.1 | NYC stakeholder demo & feedback | PM | 2 | 4.4 |
| 5.2 | Bug triage & fixes sprint | Team | 20 | 5.1 |
| 6.1 | Multicity config refactor | BE | 8 | 5.2 |
| 6.2 | City onboarding CLI | BE | 6 | 6.1 |
| 6.3 | Docs: runbook & onboarding guide | DevOps | 4 | 6.2 |

*Critical Path:* 2.1 → 2.2 → 3.1 → 3.2 → 3.4 → 3.8 → 3.9 → 3.10 → M1

---

## 5 | Resource Allocation Matrix

| Role | Name (placeholder) | Phase 0 | 1 | 2 | 3 | 4 | 5 | Total h |
|------|-------------------|---------|---|---|---|---|---|---------|
| Project Manager | Alice | 2 | 1 | 2 | 4 | 6 | 4 | 19 |
| Backend Engineer | Bob | – | 6 | 10 | 8 | 6 | 12 | 42 |
| Frontend Engineer | Carol | – | 5 | 8 | 10 | 8 | 6 | 37 |
| DevOps | Dave | 4 | 6 | 2 | 6 | 4 | 4 | 26 |
| QA Engineer | Eve | – | – | 2 | 12 | 8 | 4 | 26 |
| UX/UI Designer | Frank | – | 2 | 4 | 4 | 2 | 2 | 14 |
| **Total h** |  | **6** | **20** | **28** | **44** | **34** | **32** | **164** |

---

## 6 | Risk Log & Mitigation

| ID | Risk | P(1-5) | I(1-5) | Score | Mitigation |
|----|------|--------|--------|-------|------------|
| R1 | 311 API quota exhaustion | 4 | 4 | 16 | Cache requests, exponential back-off, mock fallback |
| R2 | 24 h MVP slip | 3 | 5 | 15 | Freeze scope to MUST tasks, hourly stand-ups |
| R3 | Postgres scaling >1 k RPS | 2 | 4 | 8 | Read replica, Citus shard upgrade path |
| R4 | Security vulnerability discovered post-launch | 3 | 4 | 12 | Automated SCA, ZAP in CI, bug bounty |
| R5 | Team member unavailable | 2 | 4 | 8 | Pair programming, shared context docs |
| R6 | Data privacy breach (PII) | 2 | 5 | 10 | Field-level encryption, strict RBAC, DLP scans |
| R7 | Cost overrun on hosting | 3 | 3 | 9 | Budget alerts, auto-scaling caps |
| R8 | Multicity schema inflexibility | 2 | 4 | 8 | Early abstraction, integration tests for new city |
| R9 | Regulatory compliance change | 1 | 4 | 4 | Monitor NYC policy feed; modular policy layer |
| R10 | Performance regressions on new features | 3 | 3 | 9 | k6 baseline in CI; performance budget gating |

---

## 7 | Tools & Communication

| Domain | Tool | Notes |
|--------|------|-------|
| Code & PRs | GitHub | branch `main` protected |
| CI/CD | GitHub Actions | build-test-deploy |
| Project Tracking | GitHub Projects (Kanban) | Milestones M1–M5 |
| Docs & Diagrams | Markdown + Excalidraw | in `/docs` |
| Chat | Slack `#cityhelper` | stand-up at 10:00 ET |
| Video | Google Meet | daily demo (5 min) |
| Monitoring | Grafana Cloud | alerts to PagerDuty |
| Incident Mgmt | PagerDuty | Sev 1 < 30 min |

---

## 8 | Acceptance & Quality Gates

| Gate | Responsible | Required Artifacts |
|------|-------------|--------------------|
| MVP (M1) | PM + Tech Lead | CI badge green, live URL, test report |
| Stable (M2) | QA Lead | Test coverage, load test charts, security report |
| Beta Approval (M3) | NYC Stakeholder | Demo replay, checklist sign-off |
| GA (M4) | Steering Committee | Runbook, uptime evidence, rollback test |
| Multicity Ready (M5) | Product | Onboarding doc, second-city smoke test |

---

## 9 | Glossary of Dates (based on T0 = 2025-05-28 09:00 ET)

| Code | Absolute Date |
|------|---------------|
| T0 | Wed 28-May-2025 09:00 |
| T0+24h | Thu 29-May-2025 09:00 |
| T0+6d | Tue 03-Jun-2025 |
| T0+12d | Mon 09-Jun-2025 |
| T0+22d | Thu 19-Jun-2025 |

---

_End of Project Plan_
