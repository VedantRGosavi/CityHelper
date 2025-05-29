# SCALING_STRATEGY.md  
CityHelper – End-to-End Scaling Blueprint  
_Last updated: 2025-05-28_

---

## 0 | Goals

1. Seamlessly handle **10× traffic** increases without user-visible degradation.  
2. Onboard **new cities in < 2 hours** with isolated performance & data.  
3. Minimise **ops toil** via automation and self-healing infrastructure.  
4. Maintain **cost efficiency**—pay only for actual load.

---

## 1 | Scaling Dimensions

| Dimension          | Target                                |
|--------------------|---------------------------------------|
| **User traffic**   | 1 k RPS (MVP) → 10 k RPS (Year-1)     |
| **Data volume**    | 5 M SRs/yr/city, 50 cities (≈250 M)   |
| **Geography**      | Multi-region (US-East, US-West, EU)   |
| **Ops team**       | 5 engineers now → 20 across squads    |

---

## 2 | Application & API Layer

### 2.1 Stateless, Containerised Services
* **FastAPI** containers run in **AWS ECS Fargate**; no local disk state.  
* Horizontal Auto-Scaling:  
  * CPU > 60 % OR P95 latency > 200 ms → +1 task (cool-down 2 min)  
  * Max tasks per service = 50 (soft limit; raise via quota)

### 2.2 API Performance Optimisations
| Technique | Implementation | Benefit |
|-----------|----------------|---------|
| Async I/O | `asyncpg`, `httpx.AsyncClient` | frees worker threads |
| Uvicorn workers | `--workers 4 --worker-class uvicorn.workers.UvicornWorker` per task | CPU saturation threshold up |
| HTTP/2 ALB | ALB listeners upgraded | header compression, multiplexing |
| Compression | `brotli` at ALB | -60 % payload size |
| Pagination & field selection | JSON:API sparse fieldsets | avoids over-fetch |

### 2.3 Edge Caching & CDN
* **Vercel Edge Network** (MVP) → **CloudFront** (prod).  
* Cache-control: `public,max-age=60,stale-while-revalidate=30` on `GET /service-requests` with bbox.  
* Graph-shaped queries (future GraphQL) cached with **APQ** + persisted queries.

---

## 3 | Database & Storage Scaling

### 3.1 Baseline Architecture
* **PostgreSQL 16** (RDS Multi-AZ) + **PostGIS**.  
* City-partitioned tables (list partitions on `city_id`) for hot-spot reduction.

### 3.2 Vertical & Read Scaling
1. **Vertical**: gp3 → io2, increase vCPU / RAM.  
2. **Read Replicas** (Aurora or RDS) for heavy analytics & map heat-map queries.  
   * Application routing via `asyncpg` read/write splitter (L4 proxy or Citus router).

### 3.3 Horizontal Sharding Roadmap
| Phase | Trigger | Approach |
|-------|---------|----------|
| P0 | ≤100 GB | single primary + replicas |
| P1 | >100 GB / 5 k TPS | **Citus** columnar shards by `city_id` (easy M-N) |
| P2 | >1 TB | **Hyperscale (Citus)** + pg_bouncer on each worker; or migrate to **CockroachDB** if strongly needed |

### 3.4 Partition Maintenance
* Auto-create partitions per new `city_id`.  
* **pg_partman** scheduled jobs to detach / archive old partitions (>5 y).  
* VACUUM & ANALYZE run per partition to reduce bloat.

### 3.5 Caching Layers
| Cache | Scope | TTL | Invalidated By |
|-------|-------|-----|----------------|
| **Redis** | API results (hot SR lists) | 30 s | events on Stream |
| **Redis** | Geoclient geo results | 24 h | address update event |
| **CDN** | Static assets, map tiles | 1 y | filename hash |

---

## 4 | Message & Job Processing

* **Redis Streams** (MVP) → **Kafka** (≥5 k events/s).  
* Consumer groups per microservice; lag monitoring in Prometheus.  
* Idempotent event handlers with `event_id` de-dup.  
* **Celery** workers autoscale via Kubernetes HPA when moved off Fargate.

---

## 5 | Infrastructure & Networking

### 5.1 Multi-Region Blueprint
| Layer | Strategy |
|-------|----------|
| CDN | CloudFront global POPs |
| API | Active/active in two AWS regions, Route 53 latency routing |
| DB | Aurora Postgres Global Database (read-only secondary), async replication |
| Redis | AWS MemoryDB (planned) with global datastore |

Failover: Route 53 health check flips traffic; RPO ≤ 5 min, RTO ≤ 10 min.

### 5.2 Infrastructure as Code
* **Terraform** modules parametised by `region` & `city_slug`.  
* Landing-zone template: VPC, subnets, ALB, ECS, RDS, ElastiCache.  
* GitHub Actions pipelines deploy via `terraform apply -auto-approve` after plan approval in pull request.

### 5.3 Cost Controls
* **Auto-shut preview** stacks after 14 days.  
* Spot instances for non-prod ECS tasks (60 % savings).  
* Storage autoscaling caps.

---

## 6 | Multi-Tenancy & Geographic Expansion

### 6.1 Logical Isolation (Current)
* Shared schema with `city_id` discriminator.  
* Row-Level Security (Postgres) prevents cross-city reads.  
* Kubernetes namespace per city for background workers.

### 6.2 Physical Isolation (Option B)
* Separate DB cluster per region or high-value city for compliance.  
* Adopt **schema-per-tenant** if partition contention arises.

### 6.3 Onboarding Workflow
1. Run `scripts/add_city.py --slug bos`.  
2. Terraform module `city-cluster` applies using new `city_id`.  
3. CI pipeline seeds defaults & verifies health in < 15 min.  
4. DNS `bos.cityhelper.ai` + SSL auto-provisioned via ACM.

---

## 7 | Operational Scaling

### 7.1 Observability at Scale
* **Prometheus + Thanos** aggregate metrics across clusters.  
* **Grafana** multi-tenant dashboards via folders per city.  
* **OpenTelemetry** traces sampled 10 % → Tempo.

### 7.2 SRE Practices
| Practice | Description |
|----------|-------------|
| SLOs | 99.9 % availability, P95 latency 200 ms |
| Error Budgets | Feature rollouts freeze if budget exhausted |
| Chaos Testing | monthly experiments with AWS Fault Injection Simulator |
| Incident Response | PagerDuty triage, retros within 24 h |

### 7.3 Release Engineering
* **Blue/green** for API; **canary 5 %** for risky changes.  
* Feature flags via **Unleash** allow gradual enable per city.

---

## 8 | Growth Modelling & Capacity Planning

| Year | MAUs | Peak RPS | DB Size | Strategy |
|------|------|----------|---------|----------|
| 0 (MVP) | 10 k | 1 k | 30 GB | Single RDS m6g.large |
| 1 | 100 k | 5 k | 300 GB | RDS m6g.xlarge + 1 replica, Redis cluster |
| 2 | 1 M | 10 k | 1 TB | Aurora Global DB, Citus shards, Kafka |

Quarterly **capacity review**: actual metrics vs projection; update Terraform sizes.

---

## 9 | Security & Compliance at Scale

* Secrets rotation automated via AWS Secrets Manager (30-day).  
* TLS termination at ALB with auto-renew ACM.  
* City-specific compliance (e.g., GDPR in EU) handled via per-region data residency clusters.

---

## 10 | Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Single-region outage | Total downtime | Multi-region active/active |
| Hot city skew (e.g., NYC >> others) | Partition hotspot | City-level shard to dedicated node |
| Explosive data growth | Cost / performance | Archival pipeline → S3/Glacier; materialised views |
| Thundering herd on status page | Cache stampede | Redis semaphore & request coalescing |

---

## 11 | Future Enhancements

* Adopt **pgvector** for semantic search & dedup across cities.  
* Edge functions (CloudFront Functions) for auth token validation at the edge.  
* Server-Side Rendering (SSR) via Next.js to improve TTI at scale.  
* Explore **Rust + Axum** micro-services for high-CPU geospatial analytics.

---

## 12 | Summary

The CityHelper platform is architected for **elastic horizontal scaling**, city-centric data partitioning, and operational automation. By combining proven cloud primitives (ECS, Aurora, CloudFront) with disciplined SRE practices and cost controls, we can confidently support rapid user and geographic growth while meeting stringent performance and availability objectives.

