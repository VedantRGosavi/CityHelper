# DATABASE_SCHEMA.md
CityHelper – Relational Data Model (PostgreSQL 16 + PostGIS 3.4)  
_Last updated: 2025-05-28_

---

## 1. Philosophy & Conventions
* **Multi-city first:** every domain table is **partition-keyed by `city_id`** (UUID).
* **Immutable IDs:** use v7 UUIDs for ordered inserts (`uuid_generate_v7()` extension).
* **Soft-deletion:** `deleted_at TIMESTAMPTZ NULL` on user-modifiable tables.
* **Auditability:** trigger-based history tables for critical entities.
* **Time zone:** all `timestamp` columns are `TIMESTAMPTZ` in UTC.
* **Naming:** `snake_case`, singular table names, PK `id`, FK `<table>_id`.

---

## 2. Entity Relationship Overview
```
cities ──┬─< citizens
         ├─< service_requests >─┬─ citizens
         │                      └─ attachments
         ├─< assets
         ├─< events
         └─< integrations
users ──< user_roles >─ roles
```
*Arrow `<` means “many”; `>` means “belongs to”.*

---

## 3. Table Definitions

### 3.1 `cities`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid PK | `PRIMARY KEY` | partition key |
| slug | text | `UNIQUE, NOT NULL` | e.g. `nyc` |
| name | text | `NOT NULL` | "New York City" |
| timezone | text | default `'America/New_York'` |
| created_at | timestamptz | default `now()` |

### 3.2 `citizens`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| city_id | uuid FK→cities(id) `ON DELETE CASCADE` |
| email | citext | `UNIQUE NULLABLE` |
| phone | text | `CHECK (phone ~ '^\+\d{8,15}$')` |
| name | text |
| password_hash | text | NULL if SSO/guest |
| created_at / updated_at | timestamptz |

Indexes  
```sql
CREATE INDEX idx_citizens_city_email ON citizens(city_id, email);
```

### 3.3 `service_requests`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| city_id | uuid FK→cities |
| external_id | text | 311 tracking #; `UNIQUE NULL` |
| citizen_id | uuid FK→citizens(id) `ON DELETE SET NULL` |
| category | text | `CHECK (category IN ('POTHOLE','NOISE',...))` |
| description | text |
| location | geography(Point,4326) | `NOT NULL` |
| status | text | `CHECK (status IN ('OPEN','IN_PROGRESS','CLOSED'))` |
| priority | smallint | default 0 |
| created_at / updated_at | timestamptz |
| closed_at | timestamptz NULL |
| deleted_at | timestamptz NULL |

Indexes  
```sql
CREATE INDEX idx_requests_geo ON service_requests USING GIST (location);
CREATE INDEX idx_requests_status ON service_requests(city_id, status);
CREATE INDEX idx_requests_extid ON service_requests(external_id);
```

### 3.4 `attachments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| service_request_id | uuid FK→service_requests(id) `ON DELETE CASCADE` |
| file_url | text | `NOT NULL` |
| mime_type | text |
| uploaded_at | timestamptz |

### 3.5 `assets`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| city_id | uuid FK→cities |
| type | text | e.g. `PARK`, `VEHICLE`, `SENSOR` |
| name | text |
| location | geography(Point,4326) |
| metadata | jsonb |
| created_at / updated_at | timestamptz |

Indexes  
```sql
CREATE INDEX idx_assets_geo ON assets USING GIST (location);
CREATE INDEX idx_assets_type ON assets(city_id, type);
```

### 3.6 `events`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| city_id | uuid FK→cities |
| title | text |
| description | text |
| starts_at | timestamptz |
| ends_at | timestamptz |
| location | geography(Point,4326) NULL |
| source | text | `NYC_CALENDAR`, `MANUAL` |
| created_at | timestamptz |

Index  
```sql
CREATE INDEX idx_events_timerange ON events(city_id, tstzrange(starts_at, ends_at));
```

### 3.7 `integrations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| city_id | uuid FK→cities |
| provider | text | `NYC311`, `GEOCLIENT`, … |
| credentials | jsonb | encrypted column (pgcrypto) |
| quota_daily | int |
| quota_used | int default 0 |
| rotated_at | timestamptz |
| created_at | timestamptz |

Unique  
```sql
UNIQUE(city_id, provider)
```

### 3.8 Auth & RBAC

#### `users`
Internal staff/admin accounts (separate from citizens).

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK |
| email | citext `UNIQUE, NOT NULL` |
| password_hash | text |
| full_name | text |
| disabled | bool default false |
| created_at |

#### `roles`
`id`, `slug` (`admin`, `staff`, `viewer`), `description`.

#### `user_roles`
| user_id FK→users | role_id FK→roles | `PRIMARY KEY (user_id, role_id)` |

### 3.9 Event Sourcing (optional)

`service_request_events` append-only table captures state transitions for audit.

---

## 4. Referential Integrity Matrix
| From → To | On Delete |
|-----------|-----------|
| citizens.city_id → cities.id | CASCADE |
| service_requests.city_id → cities.id | CASCADE |
| service_requests.citizen_id → citizens.id | SET NULL |
| attachments.service_request_id → service_requests.id | CASCADE |
| assets.city_id → cities.id | CASCADE |
| events.city_id → cities.id | CASCADE |
| integrations.city_id → cities.id | CASCADE |
| user_roles.user_id → users.id | CASCADE |
| user_roles.role_id → roles.id | RESTRICT |

---

## 5. Partitioning & Scaling

* **City-level partitioning** (list partitions) on heavy-traffic tables:  
  `service_requests`, `assets`, `events`.  
  Example:  
  ```sql
  CREATE TABLE service_requests_nyc PARTITION OF service_requests
      FOR VALUES IN ('8a1b...nyc-uuid');
  ```
* Future: hash-partition per 10-day interval on `created_at` for requests.

---

## 6. Data Migrations & Versioning

### 6.1 Tooling
* **Alembic** with `sqlmodel` helpers.
* Naming convention: `XXXX_action_object` (e.g. `202505281200_add_postgis`).

### 6.2 Zero-Downtime Principles
1. **Additive first**: new columns nullable/default → deploy code → backfill → set NOT NULL.
2. **Double-write**: for column type changes, write to `old` + `new`, switch reads, drop.
3. **Online index creation**: `CREATE INDEX CONCURRENTLY`.
4. **Rolling deploy**: staged release; DB migrates before API rollout.

### 6.3 Seed & Reference Data
* `cities` seeded via Alembic migration for NYC.
* `roles` (`admin`, `staff`, `viewer`) seeded.
* Fixtures for unit tests loaded via `pytest-postgres`.

---

## 7. Backup & Recovery

| Layer | Strategy |
|-------|----------|
| Base backups | RDS snapshot every 6 h, retain 7 days |
| WAL shipping | 5-min PITR window |
| Verification | Nightly pg_dump → restore in staging; checksum comparison |
| Encryption | AES-256 at rest (RDS default) |

---

## 8. Index Summary

| Table | Index | Purpose |
|-------|-------|---------|
| service_requests | `GIST(location)` | fast spatial queries |
| service_requests | `(city_id,status)` | dashboard filters |
| citizens | `(city_id,email)` | login look-up |
| assets | `GIST(location)` | proximity search |
| events | `tstzrange(starts_at,ends_at)` | time range queries |

---

## 9. Future Enhancements
* **Citus** or **Timescale** for horizontal sharding if >10 M requests/year.
* **Materialised views** for heatmap aggregations (`service_requests_heatmap_mv`).
* **Row-level security** to sandbox partner organisations.
* **pgvector** extension for spatial/semantic similarity on unstructured reports.

---
