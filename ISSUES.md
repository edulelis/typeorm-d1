# Known Issues and Limitations

This document tracks known issues, limitations, and unresolved problems with the TypeORM D1 driver implementation.

## Critical Limitations

### 1. Transaction Rollback Not Supported
**Status**: Known Limitation - Cannot be fixed due to D1 architecture

**Description**: 
D1 (Cloudflare's SQLite-based database) does not support true transaction rollback. Once a query is executed within a transaction, it is immediately committed to the database. This is a fundamental limitation of D1's architecture.

**Impact**:
- `rollbackTransaction()` will clean up transaction state but cannot undo already-executed queries
- Tests expecting rollback to prevent data persistence will fail
- Applications relying on rollback for data consistency need alternative error handling strategies

**Workaround**:
- Use application-level validation before executing transactions
- Implement idempotency keys for write operations
- Use compensating transactions (reverse operations) instead of rollback
- Validate data before committing transactions

**Related Code**:
- `src/D1QueryRunner.ts` - `rollbackTransaction()` method
- `src/D1QueryRunner.ts` - `query()` method executes queries immediately even in transactions

**References**:
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- D1 batch API limitations

---

## High Priority Issues

### 2. Unique Constraint Enforcement
**Status**: Fixed (Added UNIQUE to column definition)

**Description**: 
Unique constraints were not being enforced because UNIQUE was not added to the column definition in CREATE TABLE statements. TypeORM creates unique indexes separately, but for SQLite/D1, adding UNIQUE directly to the column definition ensures better enforcement.

**Fix Applied**:
- Modified `buildCreateColumnSql()` in `D1QueryRunner.ts` to add `UNIQUE` constraint to column definition when `column.isUnique` is true

---

## Medium Priority Issues

### 3. Test ID Expectations
**Status**: Fixed

**Description**: 
Some tests were hardcoding expected IDs (e.g., `id: 1`) which fails when IDs don't start at 1 or when tests run in different order.

**Fix Applied**:
- Updated tests to use dynamic IDs from saved entities instead of hardcoded values

---

## Low Priority Issues

### 4. Relations Test DataSource Creation
**Status**: Fixed

**Description**: 
A test was creating a new DataSource in the middle of execution, causing metadata conflicts.

**Fix Applied**:
- Updated test to use existing DataSource instead of creating a new one

---

## Future Improvements

### 5. Better Error Messages
**Status**: Fixed

**Description**: 
Error messages from D1 could be more descriptive and include context about the failed operation.

**Fix Applied**:
- Enhanced `checkD1Error()` method in `D1QueryRunner.ts` to include query context in error messages
- Mapped common D1 error patterns to TypeORM-compatible error codes (SQLITE_CONSTRAINT_UNIQUE, SQLITE_CONSTRAINT_NOTNULL, etc.)
- Error messages now include the SQL query that failed (truncated to 200 chars for readability)

### 6. Connection Pooling Documentation
**Status**: Fixed (Documented in README)

**Description**: 
D1 doesn't use traditional connection pooling, but this should be better documented.

**Fix Applied**:
- Added documentation in README.md about D1's stateless connection model
- Explained that D1 uses a stateless connection model (no connection pooling)
- Updated driver to create new query runners for each request to avoid transaction state conflicts

### 7. Migration Idempotency
**Status**: Fixed (Tests Added)

**Description**: 
Migrations should be idempotent - running the same migration twice should not fail.

**Fix Applied**:
- Added comprehensive tests for migration idempotency in `tests/integration/migrations.test.ts`
- TypeORM's synchronize uses `IF NOT EXISTS` for table creation, ensuring idempotency
- Tests verify that running synchronize multiple times doesn't fail

---

## Testing Gaps

### Missing Test Cases

1. **SQL Injection Tests**: ✅ Added in `tests/integration/security.test.ts`
2. **Concurrency Tests**: ✅ Added in `tests/integration/concurrency.test.ts`
3. **Large Data Tests**: ✅ Added in `tests/integration/large-data.test.ts`
4. **Migration Idempotency**: ✅ Added in `tests/integration/migrations.test.ts`
5. **Schema Mismatch Detection**: ✅ Added in `tests/integration/schema-mismatch.test.ts`

---

## Additional Fixes Applied

### 8. Transaction State Management
**Status**: Fixed

**Description**: 
Concurrent transactions were interfering with each other because query runners were being reused.

**Fix Applied**:
- Modified `createQueryRunner()` in `D1Driver.ts` to always create a new query runner instance
- This prevents transaction state conflicts in concurrent scenarios
- Updated `startTransaction()` to properly throw errors when a transaction is already active

### 9. Timestamp Type Support
**Status**: Fixed

**Description**: 
TypeORM's validator was rejecting "timestamp" type as not supported by SQLite.

**Fix Applied**:
- Added "timestamp" to `supportedDataTypes` in `D1Driver.ts` constructor
- Timestamp is mapped to TEXT in SQLite (handled in `normalizeType()`)

### 10. Test Cleanup and Isolation
**Status**: Fixed

**Description**: 
Tests were not properly cleaning up between runs, causing state conflicts.

**Fix Applied**:
- Added proper cleanup in `beforeEach` hooks for schema tests
- Fixed test expectations to handle SQLite's flexible type system
- Updated tests to include all related entities to avoid metadata errors

### 11. Table Creation Idempotency
**Status**: Fixed

**Description**: 
TypeORM's synchronize was failing when trying to create tables that already exist, even with IF NOT EXISTS.

**Fix Applied**:
- Modified `buildCreateTableSql()` to always use `IF NOT EXISTS` regardless of the `ifNotExist` parameter
- This ensures idempotent table creation for D1/SQLite
- Prevents errors when synchronize runs multiple times

### 12. D1 Exception Handling
**Status**: Fixed

**Description**: 
D1 throws exceptions directly (not just in result.error), which weren't being caught properly.

**Fix Applied**:
- Added `wrapD1Exception()` method to catch and wrap D1 exceptions
- Improved error message extraction from Miniflare's SqliteError format
- Better error code mapping for TypeORM compatibility

## Notes

- All issues are tracked here for transparency
- Issues marked as "Known Limitation" cannot be fixed due to D1 architecture
- Workarounds are provided where possible
- Regular updates will be made as issues are resolved or new ones are discovered

