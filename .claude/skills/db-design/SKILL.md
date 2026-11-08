---
name: db-design
description: Use when designing relational schemas, constraints, migrations, indexes, or SQL data models for this repository.
---

- Normalize first (3NF), then denormalize intentionally; document trade-offs. Name tables/columns predictably; timestamps are UTC (`created_at`, `updated_at`).
- Keys/constraints: prefer non-sequential ids for multi-node (uuid/ulid) over auto-increment; explicit FKs with cascades; add unique and check constraints for invariants.
- Index strategy: index FKs and frequent predicates; evaluate partial/covering indexes; avoid over-indexing write-heavy tables.
- Migrations: idempotent and reversible; prefer additive changes; include rollback notes before destructive steps.
- Modeling patterns: use junction tables for many-to-many; avoid overloaded columns; prefer enum tables over ad hoc strings when values are stable.
- Data quality: use defaults for timestamps/ids; add NOT NULL where appropriate; validate at both DB and application layer.
- Performance: consider keyset pagination for large tables; partitioning only when justified; beware wide tables and unbounded text blobs in hot paths.
