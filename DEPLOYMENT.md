# DEPLOYMENT.md
CityHelper – Deployment & Operations Guide  
_Last updated: 2025-05-28_

---

## 1. Overview

This document describes how to provision, configure, release, monitor, and maintain the CityHelper platform across **local development**, **staging**, and **production** environments.  
Two tiers of infrastructure are supported:

| Tier | Provider | Purpose |
|------|----------|---------|
| Rapid MVP | **Vercel** (frontend) + **Railway** (API, Postgres, Redis) | 1-click, low-ops, free/low-cost |
| Hardened Production | **AWS** (ECS Fargate, RDS, ElastiCache, S3) via Terraform | scalability, compliance, SRE workflows |

The same Docker images and IaC modules are used for both tiers; environment selection is driven by Terraform workspaces.

---

## 2. Prerequisites

| Item | Version |
|------|---------|
| Terraform | ≥ 1.7 |
| AWS CLI | ≥ 2.15 |
| Railway CLI | ≥ 3.0 |
| Vercel CLI | ≥ 31 |
| GitHub Actions Runner | Hosted |
| kubectl (future) | ≥ 1.30 (if migrating to EKS) |

---

## 3. Environment Matrix

| Variable            | Local           | Staging                        | Production                          |
|---------------------|-----------------|--------------------------------|-------------------------------------|
| `FRONTEND_URL`      | http://localhost:5173 | https://staging.cityhelper.ai | https://cityhelper.ai |
| `API_URL`           | http://localhost:8000 | https://staging-api.cityhelper.ai | https://api.cityhelper.ai |
| `DATABASE_URL`      | postgres://cityhelper:pw@localhost:5432/cityhelper | Railway Postgres URL                | RDS generated URL                   |
| `REDIS_URL`         | redis://localhost:6379 | Railway Redis URL                   | `rediss://` Elasticache endpoint    |
| `JWT_PUBLIC_KEY`    | loaded from `certs/`  | GitHub secret                   | AWS Secrets Manager                 |
| External API keys   | `.env` file (dev)     | Railway/Vercel secrets          | AWS Secrets Manager                 |

A complete `.env.sample` file is stored in the root for reference.

---

## 4. Infrastructure Provisioning

### 4.1 Rapid MVP (Vercel + Railway)

1. **Fork/clone** repository and sign in to Vercel & Railway.
2. **Vercel**  
   ```bash
   vercel link       # associate repo
   vercel env add FRONTEND_URL https://<vercel-domain>
   vercel env add API_URL https://staging-api.cityhelper.ai
   ```
3. **Railway**  
   ```bash
   railway init
   railway add postgresql
   railway add redis
   railway up        # deploy Dockerfile in /api
   railway variables set \
     DATABASE_URL=$(railway status | ... ) \
     REDIS_URL=$(railway status | ... )
   ```
4. **Domains**  
   * Point DNS `CNAME cityhelper.ai` → Vercel.
   * Add sub-domain `api.cityhelper.ai` → Railway HTTP proxy.

### 4.2 Production on AWS (Terraform)

Directory: `infra/terraform`

```
infra/
  ├── modules/
  │   ├── vpc/
  │   ├── ecs-fargate/
  │   ├── rds-postgres/
  │   ├── redis/
  │   └── s3-static/
  └── prod.tfvars
```

Workflow:

```bash
cd infra/terraform
terraform init
terraform workspace new prod
terraform apply -var-file=prod.tfvars
```

Resources created:

| Resource | Purpose |
|----------|---------|
| VPC (3 AZ) | network isolation |
| Application Load Balancer | TLS terminator for API |
| ECS Cluster (Fargate) | `cityhelper-api` service w/ auto scaling |
| RDS Postgres (Multi-AZ) | 100 GB gp3, PostGIS enabled |
| ElastiCache Redis | 1× cache.t3.micro |
| S3 + CloudFront | Serve built SPA assets |
| ACM Certificates | `*.cityhelper.ai` |
| IAM Roles | task execution, limited S3 & Secrets access |
| Secret Manager entries | JWT keys, 311 API keys |

---

## 5. Configuration & Secrets Management

| Environment | Mechanism |
|-------------|-----------|
| Local | `.env` file, **never committed** |
| GitHub Actions | Encrypted **Repository Secrets** |
| Railway/Vercel | Project-level protected variables |
| AWS Prod | **AWS Secrets Manager** (`cityhelper/<name>`) accessed via IAM task role |

Rotation strategy:

* **JWT signing key**: 90-day rotation; downtime-free via key cascading.
* **NYC API keys**: stored per-city in DB, rotated via admin endpoint.

---

## 6. CI/CD Pipeline (GitHub Actions)

Workflow files under `.github/workflows/`

| File | Stage | Summary |
|------|-------|---------|
| `ci.yml` | PR / push | Lint, type-check, test, build Docker images, upload coverage |
| `preview-deploy.yml` | PR | Deploy branch to Vercel & Railway preview envs |
| `staging-deploy.yml` | Merge to `main` | Terraform `staging` workspace apply, promote Vercel |
| `prod-promote.yml` | Manual (`workflow_dispatch`) | Tag release, apply `prod` Terraform, blue/green ECS update |

Blue/green:

1. New task set registered in ECS.
2. ALB target weight shifted 10 % → 100 %.
3. Automatic rollback if 5xx > 2 % in 10 min.

Tagging:

```
npm version patch      # bumps, creates git tag
git push --follow-tags
```

The backend image is tagged `ghcr.io/org/cityhelper-api:<git-sha>`.

---

## 7. Database Migrations

* Alembic migrations live in `api/alembic/`.
* **Rule**: migrations run **before** new API containers receive traffic.
* GitHub Action step:

```bash
docker run --rm \
  -e DATABASE_URL=$DATABASE_URL \
  ghcr.io/org/cityhelper-api:$GITHUB_SHA \
  alembic upgrade head
```

Zero-downtime guidelines defined in `DATABASE_SCHEMA.md §6.2`.

---

## 8. Observability & Monitoring

| Aspect | Tool | Endpoint / Setup |
|--------|------|------------------|
| Metrics | **Prometheus** sidecar scrapes `/metrics` (FastAPI + uvicorn) |
| Dashboards | **Grafana Cloud** (`cityhelper-production`) import `8797` template |
| Logs | **Loki** via Grafana Agent shipping container stdout (JSON) |
| Tracing | **OpenTelemetry** → Grafana Tempo |
| Alerts | Grafana Alerting rules; routed to **PagerDuty** with service `CityHelper-API` |

Health checks:

* `/health/live` – container alive (ECS healthCmd).  
* `/health/ready` – checks DB, Redis, external 311 ping.  

ALB uses `/health/ready` for target status.

---

## 9. Maintenance Procedures

### 9.1 Backups & Disaster Recovery

| Component | Method | Retention |
|-----------|--------|-----------|
| Postgres | automated RDS snapshots (6 h) & WAL | 7 days, cross-region weekly |
| Redis | daily RDB snapshot to S3 | 7 days |
| S3 assets | versioning + lifecycle to Glacier | 30 days |
| Terraform state | remote backend (S3 + DynamoDB lock) | indefinite |

Restore drill quarterly:

```
aws rds restore-db-instance-to-point-in-time --target-db-instance-identifier cityhelper-restore ...
terraform apply -var snapshot_id=<id>
```

### 9.2 Scaling

* **API**: ECS Service Auto Scaling: CPU > 60 % for 5 min → +1 task, max 10.
* **Database**: storage autoscaling, read replica at 70 % CPU.
* **Redis**: vertical upgrade via reserved-node swap.

### 9.3 Patch Management

| Frequency | Component | Action |
|-----------|-----------|--------|
| Weekly | Base Docker images | Dependabot PR auto-merge after CI green |
| Monthly | Terraform provider versions | `tflint` check |
| Quarterly | Ubuntu ECR AMIs | Rebuild images |

### 9.4 Scheduled Jobs

* Nightly (02:00 local city time) – Open Data ETL (`celery beat`) running in ECS scheduled task.
* Hourly – 311 request status poller.
* Every 5 min – Prometheus scrape, alert evaluation.

---

## 10. Rollback & Hotfix

1. `prod-promote.yml` keeps previous task set for 24 h.
2. To rollback:

```bash
aws ecs update-service --cluster cityhelper-prod \
  --service api --force-new-deployment \
  --task-definition <previous-task-def-arn>
```

3. Create `hotfix/*` branch, PR to `main`, tag `vX.Y.Z-hotfix`, run promote workflow.

---

## 11. Cost Controls

* AWS Budget alert at 80 % of monthly forecast.
* Idle Resource cleaner Lambda for old preview stacks (>14 days).
* Limit egress in security groups; Redis set to 256 MB memory.
* Vercel analytics disabled in prod (use Grafana).

---

## 12. Decommissioning

1. Remove DNS records.
2. `terraform destroy` in prod workspace.
3. Final RDS snapshot retained 30 days.
4. Revoke API keys with NYC portals.
5. Archive S3 logs to Glacier Deep Archive.

---

## 13. Troubleshooting Cheat-Sheet

| Symptom | Likely Cause | Action |
|---------|--------------|--------|
| `502 Bad Gateway` from ALB | Task not ready / healthcheck failing | Check `/health/ready`; ECS logs |
| High DB latency | Missing index | Examine `pg_stat_statements`, add index via migration |
| “Too many open files” in logs | ulimit in container | Increase ECS task ulimits to 65535 |
| 311 API 403 | Quota exhausted | Check `integrations.quota_used`; rotate key |

---

## 14. Contact & Escalation

| Tier | Time | Contact |
|------|------|---------|
| Sev 1 | 24/7 | PagerDuty on-call (rotating) |
| Sev 2 | 09-18 ET | `#cityhelper-ops` Slack |
| Changes | N/A | Change Advisory Board weekly |

---

Happy shipping! 🚀
