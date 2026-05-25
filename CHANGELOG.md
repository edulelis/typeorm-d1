# Changelog

## Unreleased

- Add dual CommonJS/ESM package output with a strict package export map.
- Add package verification for CJS import, ESM import, built DataSource smoke,
  and npm tarball contents.
- Add explicit D1 atomic batch APIs: `executeD1Batch()` and
  `D1QueryRunner.executeBatch()`.
- Clarify that TypeORM transaction methods are compatibility shims and rollback
  does not undo writes.
- Add TypeORM query logging and query broadcaster support.
- Add real SQLite/D1 view introspection.
- Update tests to Miniflare 4 D1 APIs.
- Remove checked-in coverage, generated test declarations, and debug scripts.
- Rewrite README, ISSUES, and test documentation for public use.
- Add AGENTS, CONTRIBUTING, SECURITY, and LICENSE documents.
