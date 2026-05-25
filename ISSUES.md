# Known Limitations And Roadmap

This document tracks current intentional behavior and public roadmap items for
`typeorm-d1`.

## Current Limitations

### TypeORM Transaction Rollback Is Not Real Rollback

Cloudflare D1 does not expose an interactive transaction API to Workers code.
D1 does expose atomic `batch()` execution for prepared statements known up
front, but TypeORM repository transactions are interactive: TypeORM expects to
run statements one at a time and receive generated ids, errors, relation state,
and read results immediately.

Current behavior:

- `startTransaction()` marks a query runner as transaction-active.
- Queries execute immediately.
- `commitTransaction()` clears local transaction state.
- `rollbackTransaction()` clears local transaction state but cannot undo writes.
- Nested transactions are rejected.

Use `executeD1Batch()` or `D1QueryRunner.executeBatch()` for D1 atomic batches.
Use application-level validation, idempotency keys, or compensating writes when
repository operations need failure recovery.

Related code:

- `src/driver/d1/d1-query-runner.ts`
- `src/factory/execute-d1-batch.ts`

### Limited SQLite Schema Mutations

D1 is SQLite based, so not every TypeORM schema operation can be applied with a
direct `ALTER TABLE`.

Unsupported query-runner operations currently throw `D1ValidationError` with a
hint to use migrations:

- Drop column
- Change column
- Rename column
- Add/drop foreign key on an existing table
- Add/drop primary key on an existing table

For production schema changes, prefer explicit migrations that create a new
table, copy data, validate data, and swap table names when needed.

### D1 Sessions Are Typed But Not Wrapped

The exported D1 types include optional session APIs from Cloudflare Workers
types. The driver does not currently expose a high-level TypeORM integration for
D1 session bookmarks or read-replica consistency controls.

### Edge Runtime Compatibility Requires Ongoing Verification

The package avoids adding Node-only runtime dependencies to driver code and
publishes ESM/CJS outputs with TypeORM externalized. Full Worker bundling should
remain part of release verification before broad compatibility claims are made.

## Roadmap

- Add Worker-bundler smoke coverage for a minimal Cloudflare Worker entrypoint.
- Evaluate a small D1 session API surface if users need bookmark control.
- Improve schema metadata parsing for more complex SQLite table definitions.
- Add docs snippets as compile-checked examples.

## Resolved History

- Query logging and query broadcaster events are now implemented.
- View introspection now returns `View` metadata instead of silently hiding
  existing SQLite/D1 views.
- Explicit D1 batch execution is available through public APIs.
- Miniflare test setup uses the current v4 D1 API instead of deprecated beta
  bindings.
- The package build is importable from both CommonJS and ESM entrypoints.
