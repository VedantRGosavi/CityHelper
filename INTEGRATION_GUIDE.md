# INTEGRATION_GUIDE.md
CityHelper – External Integrations Handbook  
_Last updated: 2025-05-28_

---

## 1. Purpose
This guide explains **how CityHelper communicates with third-party services**, the contracts involved, and the operational rules (auth, quotas, fall-backs). It is required reading for any developer touching the `app.integrations` package or onboarding a **new city**.

---

## 2. Glossary
| Term | Meaning |
|------|---------|
| Adapter | Internal module that wraps an external API and normalises payloads into DTOs. |
| NYC 311 | New York City’s public service-request API. |
| Geoclient | NYC Department of City Planning geocoding service. |
| SODA | Socrata Open Data API used by NYC data portal. |
| PSK | Pre-shared key (HMAC secret) for outbound webhooks. |

---

## 3. Integration Patterns

### 3.1 Adapter Lifecycle
```
request → validator → adapter.call() → normaliser → DTO → service layer
                            ↑
                       retries / circuit-breaker
```

* All adapters live under `app/integrations/<provider>/`.
* They expose **async** methods returning Pydantic DTOs.
* Each call is wrapped in:
  * `tenacity` retry with **decorrelated jitter** (max 5 attempts, back-off 2^n).
  * `async_timeout` (default 10 s).
  * **Circuit-breaker** (`aiobreaker`): opens on 50 % failures / 20 calls.

### 3.2 Fault Tolerance Hierarchy
1. **Retry** idempotent requests (GET, PUT).
2. **Queue** state-changing calls (POST) via Redis Stream for async worker.
3. **Graceful degradation** – surface “Pending external” status to UI.
4. **Alert** on PagerDuty if breaker open >5 min.

---

## 4. NYC-Specific Integrations

### 4.1 NYC 311 Public API

| Item | Value |
|------|-------|
| Base URL | `https://api.nyc.gov/311/v1/` |
| Auth | `X-Api-Key: <key>` header |
| Rate Limit | 10 requests/sec, 100 000/day |
| Formats | JSON (UTF-8) |
| Sandbox | None – use low volume + `test=true` param |

#### 4.1.1 Submit Service Request

```
POST /service-requests
Headers
  X-Api-Key: *******
Payload
{
  "caller": { "firstName":"Jane","lastName":"Doe","phone":"2125551234" },
  "incidentAddress":"123 Broadway, New York, NY",
  "descriptor":"Pothole on the road",
  "incidentZip":"10007",
  "agencyCode":"DOT",
  "latitude":40.7128,
  "longitude":-74.0060
}
```

_Response 201_

```json
{
  "trackingNumber":"NYC311-2025-0423-1234",
  "status":"Open"
}
```

Mapping to internal DTO (`ServiceRequestDTO`):

| 311 field | Internal field |
|-----------|----------------|
| `trackingNumber` | `external_id` |
| `status` | `external_status` |
| `agencyCode` | `agency` |

#### 4.1.2 Status Check

```
GET /service-requests/{trackingNumber}
→ 200 JSON
```

Adapter runs **hourly** cron, respecting 300 ms delay between calls.

#### 4.1.3 Error Handling

| HTTP | Meaning | Retry? |
|------|---------|--------|
| 400  | Validation – our bug | ✖ abort |
| 401/403 | Key invalid / quota | ✖ alert ops |
| 429  | Burst throttled | ✓ exponential back-off |
| 5xx  | Upstream issue | ✓ retry up to 5 min |

---

### 4.2 Geoclient API

| Item | Value |
|------|-------|
| Base URL | `https://maps.nyc.gov/geoclient/v1` |
| Auth | Query params `app_id`, `app_key` |
| Limit | 100 000 calls/day (per key) |
| Cache | Redis ±24 h keyed by full address string |

_Example_

```
GET /search.json?q=123+Broadway&app_id=...&app_key=...
```

Adapter extracts `latitude`, `longitude`, `boroCode`, etc.  
Errors 4xx → fall back to Mapbox Geocoding (paid) if configured.

---

### 4.3 NYC Open Data (SODA)

| Endpoint | Purpose |
|----------|---------|
| `/resource/erm2-nwe9.json` | 311 historical dataset |
| `/resource/fhrw-4uyv.json` | Food establishment inspections |

* Auth optional; we request an **application token** to lift anonymous throttling (1000 rows/sec).  
* ETL worker chunks 10 000 rows with `$limit/$offset`.  
* Incremental import uses `$where=created_date > 'YYYY-MM-DD'`.  
* `202` status means job accepted – poll `Job-Id` header until done.

---

### 4.4 NYC Benefits Platform Screening API

| Base URL | `https://screeningapi.cityofnewyork.us/v1/` |
| Auth | OAuth2 Client Credentials (`client_id`, `client_secret`) |
| Scope | `screeningapi.client` |
| Token Endpoint | `POST /oauth/token` |
| TTL | 1 h (refresh 5 min before expiry) |

Flow:

1. `get_token()` caches JWT in Redis.
2. `POST /screen` with household payload.
3. Receive eligibility list – mapped to `BenefitEligibilityDTO`.

---

## 5. Cross-City Extensibility

All city-specific credentials & mappings stored in **`integrations` table** (`provider`,`credentials`,`quota_*`).  
Adding a new city:

```
python scripts/add_city.py --slug bos --name "Boston"
# prompts for 311 key etc.
```

Adapter classes inherit `Base311Adapter` and override `field_map`.

---

## 6. Supporting External Services

| Service | Purpose | Auth | Limit | SDK |
|---------|---------|------|-------|-----|
| **SendGrid** | Email notifications | Bearer Token | 100/day (free) | `@sendgrid/mail` |
| **Twilio** | SMS | Basic (Account SID + Token) | 1 msg/s (trial) | `twilio==9.0` |
| **Mapbox Tiles** | Map backgrounds | `access_token` query | 200k tiles/mo | `react-leaflet` plugin |
| **OpenWeather** _(future)_ | Weather overlays | `appid` query | 1 k calls/day | REST |

Implementations located under `app/integrations/extras/`.

---

## 7. Authentication & Authorisation Integration

### 7.1 OAuth2 Provider Options

| Provider | Use Case | Notes |
|----------|----------|-------|
| Auth0 | Password, social, enterprise SSO | Recommended |
| Azure AD | City staff SSO | Supports OIDC; map AAD groups → roles |
| Custom (FastAPI) | MVP no-cost | JWT issued by `/auth/token` |

The API expects **JWT RS256**. Public keys rotated via JWKS URL (`/.well-known/jwks.json`).  
Failed token → `401 unauthenticated`. Missing scope → `403 forbidden`.

### 7.2 Role Mapping

Roles resolved by **Casbin** RBAC model:

```
p, admin, *, (GET|POST|PATCH|DELETE)
p, staff, /service-requests, (GET|PATCH)
p, citizen, /service-requests, (GET|POST)
```

---

## 8. Rate Limiting & Quota Management

* **Per-user**: 60 req/min (SlowAPI).  
* **Per-IP (anon)**: 30 req/min.  
* **Per-adapter**: track `quota_used` in DB; if `quota_used ≥ quota_daily` → breaker opens.

Headers returned:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1717003200
```

---

## 9. Error Handling Strategy

| Layer | Code | Description | Recovery |
|-------|------|-------------|----------|
| Adapter | `upstream_error` | 5xx from external | Retry with back-off; alert if threshold |
| Adapter | `upstream_rejected` | 4xx validation | Log + DLQ for review |
| Service | `validation_error` | Bad payload | 400 to client |
| Service | `rate_limited` | Per-user/IP quota | 429 + Retry-After |
| Gateway | `maintenance` | Planned downtime | 503 |

Dead-Letter Queue (Redis list `dlq:<provider>`) stores failed payloads with trace-id. Cron job replays after 1 h or exports to S3 for manual triage.

---

## 10. Monitoring & Observability

* **Metrics**  
  * `adapter_calls_total{provider,status}`  
  * `adapter_latency_seconds_bucket{provider}`  
  * `quota_remaining{provider}` – Prometheus gauge.
* **Logs**  
  * Structured JSON, field `integration.provider`.  
  * Failure logs include `trace_id`, `error_code`, `payload_excerpt`.
* **Tracing**  
  * OpenTelemetry spans (`cityhelper.integrations.<provider>`) with `peer.ip`, `http.status_code`.
* **Alerts**  
  * Quota ≤10 % → PagerDuty level 2.  
  * Circuit-breaker open >5 min → level 1.  
  * 311 status poller lag >3 h → level 2.

---

## 11. Testing Integrations

| Environment | Strategy |
|-------------|----------|
| **local** | Mock services using `wiremock` Docker image (`docker-compose.integration.yml`). |
| **CI** | Replay recorded cassettes (VCRpy) for unit tests; integration suite runs against *real* sandbox keys in **private GitHub secrets** nightly. |
| **staging** | Real API keys but low volume datasets (`test=true`). |
| **prod** | Full volume; fail-open design for non-critical services (e.g., weather). |

---

## 12. Troubleshooting Cheatsheet

| Symptom | Probable Cause | Fix |
|---------|----------------|-----|
| `HTTP 403` from 311 | Key suspended / wrong IP | Validate key in NYC developer portal; rotate via `/integrations` endpoint |
| Geoclient `429` | Daily quota exhausted | Switch to secondary key; throttle geocoding |
| “Pending external” stuck >24 h | Status poller failure | Check Celery worker logs, ensure cron running |
| JWT “kid not found” | Key rotation mismatch | Refresh JWKS cache, verify `OAUTH_JWKS_URL` |

---

## 13. Future Integrations

| Candidate | Description | Status |
|-----------|-------------|--------|
| **OneMap Singapore** | Example for Asia expansion | POC Q3 |
| **Los Angeles 311** | Next city rollout | In queue |
| **ArcGIS** | Advanced geospatial overlays | Research |
| **Slack Webhooks** | Staff team alerts | Backlog |

---

_End of Integration Guide_
