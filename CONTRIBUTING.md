# Contributing

## Setup

```bash
npm ci
npm run build
npm test
```

Use Node.js 20 or 22 for local development.

## Pull Requests

- Keep changes focused.
- Add tests for behavior changes.
- Update README or ISSUES when public behavior or limitations change.
- Run `npm run verify` before opening a pull request.

## Testing Guidance

- Integration tests use Miniflare 4 and a local D1 database.
- Use repository/query-builder tests for TypeORM behavior.
- Use explicit batch tests for D1 `batch()` behavior.
- Do not add tests that claim rollback discards writes through TypeORM
  transactions; that is intentionally unsupported.

## Release Hygiene

- Do not commit `dist/` or `coverage/`.
- Do not commit generated test declarations or local Miniflare state.
- Check package contents with `npm run verify:package`.
