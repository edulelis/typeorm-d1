# Test Suite

The project uses Jest for unit and integration tests. Miniflare 4 provides the
local Cloudflare D1 database used by integration tests.

## Commands

```bash
npm test
npm test -- tests/integration/crud.test.ts
npm run test:coverage
npm run verify
```

`npm run verify` also builds the public package and runs package import/content
smoke checks.

## Structure

```text
tests/
  setup.ts                  Miniflare D1 setup and cleanup helpers
  fixtures/
    database.ts             DataSource helpers
    entities.ts             Shared TypeORM test entities
  integration/              D1-backed behavior tests
  unit/                     Focused utility/driver tests
```

## D1 Setup

Tests create a Miniflare instance with:

```typescript
new Miniflare({
  modules: true,
  script: `export default { fetch() { return new Response("OK"); } }`,
  d1Databases: { TEST_DB: "test-db" },
});
```

The D1 binding is loaded with:

```typescript
await mf.getD1Database("TEST_DB");
```

Do not reintroduce deprecated `__D1_BETA__` bindings.

## Test Expectations

- Repository/query-builder behavior belongs in integration tests.
- Pure SQL generation, guards, and error mapping can use unit tests.
- Public API changes need source tests and, when package output is affected,
  package smoke coverage through `scripts/verify-package.cjs`.
- README behavior claims should have matching tests.
- Transaction tests must state the compatibility-shim behavior clearly:
  rollback does not undo writes.
- D1 atomic batch behavior belongs in explicit batch tests, not TypeORM
  transaction tests.
- Schema tests should assert real SQLite metadata when claiming constraints,
  for example `PRAGMA foreign_key_list`.

## Cleanup

Use `cleanupDatabase()` between tests that create schema or data. The cleanup
helper skips SQLite and Miniflare internal tables.

Generated files such as `coverage/`, `dist/`, and test `.d.ts` files should not
be committed.
