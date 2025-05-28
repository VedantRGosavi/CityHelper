# SECURITY.md  
CityHelper – Security Program & Guidelines  
_Last updated: 2025-05-28_

---

## 1. Security Vision
CityHelper’s mission is to deliver trusted, resilient city-service software. Our security strategy is **defence-in-depth**: layered controls across code, infrastructure, data, and people, aligned with industry best practice (OWASP, NIST 800-53) and compliance ambitions (SOC 2, GDPR).

---

## 2. Threat Model (High-level)
| Asset | Threat | Mitigation |
|-------|--------|------------|
| Citizen PII (name, email, phone) | Exfiltration, unauthorized access | AES-256 column encryption, RBAC, row-level security |
| Service Request Data | Tampering, DOS | Input validation, immutability audit log, rate limiting |
| API Tokens / Secrets | Leakage, misuse | AWS Secrets Manager, GitHub secret scanning, short-lived keys |
| Availability of API | DOS, region outage | Autoscaling, WAF rate limits, multi-AZ & future multi-region |
| Admin Functions | Privilege escalation | Casbin policies, MFA requirement, audit log |

---

## 3. Authentication

| Aspect | Implementation |
|--------|----------------|
| Protocol | **OAuth 2.1** with PKCE where applicable |
| Token | **JWT RS256** (short-lived access 15 min, refresh 14 days) |
| Storage | Access token in memory, refresh token as `HttpOnly; Secure; SameSite=Strict` cookie |
| Passwords | Argon2id, 15 hashing iterations, pepper in AWS Secrets Manager |
| MFA | Mandatory for internal staff (TOTP); citizen MFA via email/SMS optional |
| Device Code Flow | Supported for kiosks & TV dashboards |
| Roadmap | WebAuthn/passkey support H2 2025 |

---

## 4. Authorization

| Layer | Control |
|-------|---------|
| API | **Casbin** RBAC with roles `citizen`, `staff`, `admin` mapped to OAuth scopes |
| Database | Row-Level Security on `city_id`; separate service accounts for read/write |
| UI | Feature gating via Unleash flags linked to roles |
| Principle | Least privilege, deny by default |

---

## 5. Data Protection

### 5.1 In Transit
* TLS 1.2+ enforced edge-to-origin (ALB) and service-to-service.
* HSTS `max-age=31536000; includeSubDomains; preload`.
* TLS certificates managed via AWS ACM; auto-renew.

### 5.2 At Rest
| Data | Storage | Encryption |
|------|---------|------------|
| Postgres | AWS RDS | AES-256 (AWS KMS) |
| S3 assets | S3 | SSE-KMS |
| Redis | Encrypted in-transit & at-rest (TLS, AES) |
| CI artefacts | GHCR | repo secrets encryption |

* PII columns (`citizens.email`, `phone`) encrypted with `pgcrypto`.  

### 5.3 Key & Secret Management
* AWS Secrets Manager per environment (`cityhelper/<env>/<name>`).
* Rotation:
  * JWT signing key ⟶ 90 days.
  * NYC API keys ⟶ as required by provider or 180 days.
* Terraform state encrypted in S3 (SSE-AES256) + DynamoDB lock.

---

## 6. API Security

1. **Input Validation & Sanitisation**  
   * Backend: Pydantic v2 validators.  
   * Frontend: Zod schemas prior to network send.
2. **Rate Limiting**  
   * SlowAPI (Redis) – per-user 60 req/min, per-IP 30 req/min anonymous.  
3. **Error Handling**  
   * RFC 7807 Problem+JSON; no stack traces leaked.  
4. **CSRF**  
   * Double-submit CSRF token for state-changing requests; SameSite cookies.  
5. **CORS**  
   * Allowed origins list from env; wildcard prohibited in prod.  
6. **Security Headers**  
   * `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin`, CSP (script-hash whitelisting).  
7. **Request Logging**  
   * Structured JSON, redaction of sensitive headers (`Authorization`, `Cookie`) before shipping.

---

## 7. Secure Coding Practices

| Practice | Tooling / Policy |
|----------|------------------|
| **Static Analysis** | Python – Ruff, Bandit; TypeScript – ESLint. Runs on every PR. |
| **Dependency Scanning** | Snyk Open Source & Dependabot; high-sev CVEs patched <72 h. |
| **Secrets Detection** | GitHub Secret Scanning + pre-commit TruffleHog. |
| **Code Review** | 1 mandatory reviewer; reviewers checklist includes security cues. |
| **Style & Lint** | Black, Prettier ensure uniform, easily reviewable code. |
| **Branch Protections** | Tests, coverage, SAST, DAST gates on `main`. |
| **Documentation** | Security implications documented in ADRs. |

---

## 8. Vulnerability Management

| Stage | Activity | SLA |
|-------|----------|-----|
| **Detection** | SAST (PR), DAST (nightly ZAP), dependency scans (daily) | — |
| **Triage** | Security lead reviews within 24 h | 24 h |
| **Patching** | Critical (CVSS ≥9) patched & deployed | 48 h |
| Medium (CVSS 7–8.9) | 7 days |
| Low (CVSS <7) | 30 days |
| **Verification** | Regression tests + CVE re-scan | — |

### 8.1 Responsible Disclosure
* Reporters email `security@cityhelper.ai` or submit via HackerOne.  
* We aim to acknowledge within 72 h and fix per SLA above.  
* Hall of Fame & swag for unique valid reports.

---

## 9. Compliance & Governance

| Framework | Status | Controls Implemented |
|-----------|--------|----------------------|
| OWASP Top-10 | **Covered** via coding & testing practices |
| SOC 2 Type I | **Planned** Q4 2025; current controls align with Security, Availability, Confidentiality TSCs |
| GDPR / CCPA | Data subject rights (export, delete) supported; DPA available |
| NYC Cyber Command guidelines | Network segmentation, encryption, log retention conformance |
| CIS Benchmarks | Container & RDS hardening baselines applied |

---

## 10. Logging, Monitoring & Alerting

* **Audit Logs** – Append-only events for auth, role change, data exports; 1-year retention; tamper-evident hash chain.
* **Operational Logs** – JSON shipped to Loki; 30 day hot, 180 day cold.
* **Metrics** – Prometheus; alerts for auth failures, breaker state.
* **Tracing** – OpenTelemetry; spans include `enduser.id`, `city_id`.
* **Anomaly Detection** – Grafana Mimir alerts on unusual login patterns.

---

## 11. Infrastructure & Deployment Security

| Area | Control |
|------|---------|
| **IAM** | Least-privilege roles; separation of duties Dev ⬄ Ops; no long-lived root keys |
| **Network** | Private subnets for DB, Redis; SG deny all egress except required; WAF protects ALB |
| **Containers** | Alpine base, non-root user, read-only FS; Trivy image scan in CI |
| **IaC** | Terraform state versioned; `tflint` & `tfsec` in pipeline |
| **Backups** | Encrypted snapshots; access restricted to DB engineers; restore tests quarterly |

---

## 12. Third-Party & Integration Security

* **API Keys** stored encrypted, rotated via admin UI or automated job.
* **Circuit Breakers & Quotas** prevent being attack vector on external services.
* Outbound webhooks signed with HMAC (`X-CityHelper-Signature: sha256=`).
* Contracts reviewed and stored in vendor risk register.

---

## 13. Incident Response

| Stage | Activity |
|-------|----------|
| **Detection** | Auto alerts (PagerDuty); user reports |
| **Triage** | Severity classification (Sev 1—3) by on-call |
| **Containment** | Revoke keys, isolate containers, block IPs |
| **Eradication & Recovery** | Patch, redeploy, verify logs |
| **Postmortem** | Root-cause analysis within 24 h; action items tracked |
| **Comms** | Data breach notice to affected users within regulatory timelines |

---

## 14. Security Contacts

* **Security Lead**: security@cityhelper.ai  
* **PGP Key**: https://cityhelper.ai/security.asc  
* **Emergency Hotline**: +1-415-555-0123 (24 × 7)

---

## 15. Revision History

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2025-05-28 | 1.0 | Security Lead | Initial document |

---
