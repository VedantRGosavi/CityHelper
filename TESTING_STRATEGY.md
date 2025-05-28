# TESTING_STRATEGY.md
CityHelper – Quality Assurance & Testing Playbook  
_Last updated: 2025-05-28_

---

## 1. Objectives
1. Detect defects early and continuously.
2. Provide quantitative confidence for every release gate (MVP ⇒ Production).
3. Enforce non-functional Service Level Objectives (performance, security, accessibility, usability).
4. Automate everything; manual testing is exploratory only.

---

## 2. Testing Pyramid & Scope

```
          E2E / UI (Playwright)
        ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^
     Integration / Contract / API
       ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^
         Unit (pytest, vitest)
```

*The base (fast, isolated) comprises the majority of tests; expensive layers run selectively.*

---

## 3. Test Types & Standards

| Layer | Goal | Tools / Frameworks | Frequency | Pass Criteria |
|-------|------|-------------------|-----------|---------------|
| **Unit** | Validate smallest testable parts in isolation (functions, components) | `pytest`, `pytest-asyncio`, `vitest`, React Testing Library | Every commit | Coverage ≥ 85 % backend, ≥ 80 % frontend; zero failures |
| **Contract (API)** | Ensure REST contract stays intact; fuzz schemas | `schemathesis` against `/openapi.json` | PR & nightly | 100 % endpoints exercised; no unexpected 5xx |
| **Integration** | Test interaction across modules & external services | `pytest` + Testcontainers (Postgres, Redis) | PR | Critical paths (auth, SR create, 311 adapter) pass |
| **Component Integration (FE)** | Validate shadcn composites, store interactions | Storybook + RTL visual snapshots | PR | Chromatic diff ≤ 0.1 % |
| **End-to-End (E2E)** | Validate user flows in browser | `Playwright` headless & cloud grid | Staging deploy, prod smoke | All critical flows green (< 2 min suite) |
| **Performance / Load** | Verify API & UI meet latency/throughput SLOs | `k6` scripted scenarios, `@k6/browser` | Nightly, pre-release | P95 latency ≤ targets at 200 RPS |
| **Stress / Soak** | Observe behaviour under extreme / long-running load | `k6`, container metrics | Release candidate | No resource leaks, graceful degradation |
| **Security (Static)** | Spot code & dependency vulns | `Bandit`, `Ruff`, `Snyk Open Source` | PR | 0 high-sev issues |
| **Security (Dynamic)** | Active scanning of running app | OWASP ZAP Baseline, `docker-zap` | Nightly, before prod | 0 high-sev alerts |
| **Accessibility** | WCAG 2.1 AA compliance | `axe-playwright`, Storybook a11y addon | PR | Violations = 0 |
| **Chaos / Resilience** | Validate fault-tolerance | `chaos-docker`, Toxiproxy network faults | Monthly | System recovers, alerts fire |
| **Backup / DR Test** | Verify restore procedures | RDS restore + smoke | Quarterly | ≤ 15 min RTO, ≤ 5 min RPO |
| **Regression / Smoke** | Quick health check of core features | Selected Playwright tags `@smoke` | On every deploy | 100 % pass |

---

## 4. Environments & Data

| Env | Purpose | Data Policy | Test Idempotency |
|-----|---------|------------|------------------|
| `local` | Dev & fast feedback | Docker Compose with synthetic seed | Reset via `make reset-db` |
| `ci` | Automated pipelines | Ephemeral containers per job | Destroy after run |
| `staging` | Integrated QA | Scrubbed prod snapshot (PII masked) | Refresh nightly |
| `perf` | Dedicated load bench | Anonymised large dataset | Tear-down post test |
| `prod` | Live | Real data | Read-only probes except smoke |

### Data Management
* Factory fixtures in `api/tests/fixtures/`, generated via `Faker`.
* Anonymisation script `scripts/scrub_db.py` removes PII before snapshots.
* Playwright uses unique e-mails with timestamp seed to avoid collisions.

---

## 5. Continuous Integration Gates

| Pipeline Step | Blocking | Description |
|---------------|----------|-------------|
| **Lint & Format** | ✅ | Ruff, Black, ESLint, Prettier |
| **Unit Tests & Coverage** | ✅ | Fails if below thresholds |
| **Contract & Integration** | ✅ | Must pass |
| **SCA / Bandit / Snyk** | ✅ | No high severity |
| **Docker Build** | ✅ | Image must build cleanly |
| **E2E Preview** | ❌ (warn) | PR comment with results |
| **Performance Budget** | ✅ on `main` | k6 P95 regressions >10 % blocks |

---

## 6. Test Implementation Guidelines

### 6.1 Backend (Python)

```python
@pytest.mark.asyncio
async def test_create_request_returns_201(client, example_payload):
    res = await client.post("/service-requests", json=example_payload)
    assert res.status_code == 201
    data = res.json()
    assert UUID(data["id"])
```

* Use `pytest-httpx` to stub outbound calls (311, Geoclient).  
* Each test creates its own DB schema via `Testcontainers(PostgresContainer)`.  
* Faker for dynamic values.

### 6.2 Frontend (React)

```tsx
it('renders status badge', () => {
  render(<StatusBadge status="OPEN" />)
  expect(screen.getByRole('status')).toHaveTextContent('OPEN')
})
```

* RTL queries by **role / label** (a11y first).  
* Snapshots limited to visual components (Storybook StoryShots).  
* Do not test implementation detail (no `instance.state`).

### 6.3 Playwright Flows

1. **Citizen Submit Request**
   * login/guest
   * fill form, select location, submit
   * assert toast & list update

2. **Admin Resolve Request**
   * staff login
   * filter OPEN, change status → CLOSED
   * verify API call & UI update

Tag critical scenarios `@smoke`.

---

## 7. Performance Testing Profiles

| Profile | RPS | Duration | Notes |
|---------|-----|----------|-------|
| **Baseline** | 50 | 5 min | CI comparison |
| **Load** | 200 | 15 min | Expected peak |
| **Stress** | Step 50→500 | until fail | Identify bottleneck |
| **Soak** | 100 | 4 h | Memory / leak detection |

Metrics collected: latency (P50, P95), error %, CPU, memory, PG connections.

---

## 8. Security Testing Details

1. **Static**  
   * Bandit policy config `bandit.yaml`.  
   * Snyk monitors GH repo; PR comments highlight vulnerable transitive deps.

2. **Dynamic**  
   * OWASP ZAP baseline scan container points to staging URL.  
   * Auth script loads bearer token for logged-in context.

3. **Secrets Detection**  
   * GitHub Secret Scanning, TruffleHog pre-commit hook.

4. **Dependency Pinning**  
   * Renovate automates PRs; merging blocked until tests pass.

---

## 9. Accessibility & UX

* `axe-playwright` run in same suite, producing JSON report (`/reports/a11y`).  
* Contrast, keyboard nav, ARIA role coverage.  
* Manual screen reader spot checks at each milestone.

---

## 10. Reporting & Analytics

* CI publishes HTML coverage (`codecov.io`) & Allure test reports.
* k6 outputs to InfluxDB, visualised in Grafana dashboard `k6-perf`.
* Slack `#cityhelper-ci` channel receives:
  * ✅ / ❌ status emoji
  * Coverage delta
  * Performance regression summary (<3 lines)

---

## 11. Roles & Responsibilities

| Role | Responsibility |
|------|----------------|
| Developers | Write & maintain unit/integration tests. |
| QA Engineer | Author E2E, performance, security scripts; gatekeeper for staging & prod. |
| DevOps | Maintain CI infrastructure, test data pipelines, perf environment. |
| Product Owner | Approve test acceptance criteria for stories. |
| Security Lead | Review security findings, coordinate fixes. |

---

## 12. Schedule & Milestones Alignment

| Milestone | Minimal Test Coverage |
|-----------|----------------------|
| **M1 (24 h MVP)** | Unit (core), smoke E2E, lint |
| **M2 (Stable)** | Full unit, integration, contract, E2E; static security |
| **M3 (Beta)** | Performance baseline, ZAP dynamic scan, a11y |
| **M4 (GA)** | Stress/soak, chaos, DR drill |
| **M5 (Multicity)** | Multitenant integration scenarios, regression suite expanded |

---

## 13. Continuous Improvement

* Weekly **flaky test triage** – dashboard auto-labels unstable tests.  
* Mutation testing (stryker-python, StrykerJS) quarterly to assess test quality.  
* Adopt **contract-first** TDD for new APIs (schemathesis powered).  
* Pay down test tech-debt in each sprint (≤10 % capacity).

---

_End of Testing Strategy_
