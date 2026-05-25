# Agent Guide

## Project Purpose

`typeorm-d1` is a TypeORM DataSource adapter for Cloudflare D1. It connects
TypeORM's SQLite-compatible driver surface to a D1 binding supplied by a
Cloudflare Worker or Miniflare test.

## Non-Negotiable Invariants

- Do not claim true TypeORM rollback support. Repository queries execute
  immediately, and `rollbackTransaction()` only clears local state.
- Do not fake repository transactions by hiding D1 `batch()` behind TypeORM
  transaction APIs. D1 batches require all statements up front.
- Use explicit `executeD1Batch()` / `D1QueryRunner.executeBatch()` for atomic D1
  batches.
- Do not add Node-only runtime dependencies to driver code.
- Keep TypeORM as a peer dependency. Do not move it back to runtime
  dependencies.
- Keep built package entrypoints importable from both CommonJS and ESM.
- README claims must match tests.

## Important Areas

- Driver and query execution: `src/driver/d1/d1-query-runner.ts`
- Driver registration: `src/utils/driver-registry.ts`
- Public factory API: `src/factory/`
- Public types: `src/types/`
- Test setup: `tests/setup.ts`
- Public docs: `README.md`, `ISSUES.md`, `tests/README.md`

## Commands

```bash
npm ci
npm run build
npm test
npm run test:coverage
npm run verify
```

Use `npm run verify` before considering package/build/public API changes done.

## Testing Rules

- Add integration tests for repository, query builder, schema, migration, D1,
  and logging behavior.
- Add unit tests for small pure helpers and error paths.
- Add package smoke coverage when exports, build output, package metadata, or
  dependency shape changes.
- Keep docs examples aligned with tested behavior.
- For schema constraints, assert actual SQLite metadata such as
  `PRAGMA foreign_key_list`, not only column names.

## Packaging Rules

- Run `npm pack --dry-run --json` or `npm run verify:package` before release.
- Do not commit `dist/`, `coverage/`, generated test declarations, debug
  scripts, local Miniflare state, or `.wrangler/`.
- Published files should be limited by the `files` allowlist in `package.json`.

## D1 Behavior Reminders

- D1 `batch()` is atomic for a list of prepared statements.
- TypeORM transactions here are compatibility shims unless a future design
  explicitly changes that.
- Views can exist in SQLite/D1-compatible local testing and should not be
  silently hidden.
- D1 sessions are typed but not currently wrapped by a high-level TypeORM API.

## Documentation Rules

- Keep limitations explicit and easy to find.
- Update `ISSUES.md` when a limitation is intentional.
- Update `CHANGELOG.md` when public behavior, package shape, or docs promises
  change.
