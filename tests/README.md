# TypeORM D1 Driver - Test Suite

This directory contains the comprehensive test suite for the TypeORM D1 driver.

## Test Structure

```
tests/
├── setup.ts                 # Test setup and database initialization
├── fixtures/                # Test fixtures and helpers
│   ├── entities.ts          # Test entity definitions
│   └── database.ts          # Database setup utilities
├── integration/             # Integration tests
│   ├── connection.test.ts   # Connection and DataSource tests
│   ├── schema.test.ts       # Schema synchronization tests
│   ├── crud.test.ts         # CRUD operation tests
│   ├── querybuilder.test.ts # QueryBuilder tests
│   ├── transactions.test.ts # Transaction tests
│   └── relations.test.ts    # Relation tests
└── README.md               # This file
```

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm test:watch
```

### Run Tests with Coverage

```bash
npm test:coverage
```

### Run Tests with UI

```bash
npm test:ui
```

### Run Specific Test File

```bash
npm test -- tests/integration/crud.test.ts
```

## Test Environment

Tests use **Miniflare** to create a local D1 database instance for testing. This allows us to test the driver without requiring a Cloudflare Worker environment.

### Test Database

The test suite creates an in-memory D1 database using Miniflare. Each test suite cleans up the database after execution to ensure test isolation.

## Test Coverage

### Connection Tests
- DataSource creation and initialization
- Connection lifecycle
- Connection options validation
- Error handling

### Schema Tests
- Table creation
- Column type mapping
- Constraints (primary keys, unique, foreign keys)
- Indexes
- Schema modifications (with SQLite limitations)

### CRUD Tests
- Create (Insert) operations
- Read (Select) operations
- Update operations
- Delete operations
- Bulk operations

### QueryBuilder Tests
- Basic queries
- Where conditions
- Sorting and pagination
- Aggregations
- Updates and deletes via QueryBuilder

### Transaction Tests
- Transaction lifecycle
- Commit and rollback
- Multiple operations in transactions
- Error handling in transactions
- D1 batch API usage

### Relation Tests
- OneToMany / ManyToOne relations
- ManyToMany relations
- OneToOne relations
- Relation loading (eager/lazy)
- Cascade operations

## Test Entities

The test suite uses several test entities:

- **User**: Basic entity for CRUD and relation tests
- **Post**: Entity with OneToMany relation to User
- **Tag**: Entity with ManyToMany relation to Post
- **Profile**: Entity with OneToOne relation to User
- **TestColumns**: Entity for testing various column types
- **TestConstraints**: Entity for testing constraints

## Writing New Tests

### Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { YourEntity } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

describe("Your Test Suite", () => {
  let dataSource: DataSource;
  let repository: any;

  beforeAll(async () => {
    dataSource = await createTestDataSource([YourEntity]);
    await dataSource.initialize();
    repository = dataSource.getRepository(YourEntity);
  });

  afterAll(async () => {
    await cleanupDataSource(dataSource);
    await cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await repository.delete({});
  });

  it("should test something", async () => {
    // Your test code
  });
});
```

### Best Practices

1. **Clean up after tests**: Always clean up test data in `beforeEach` or `afterEach`
2. **Use test fixtures**: Use entities from `fixtures/entities.ts` for consistent testing
3. **Test isolation**: Each test should be independent and not rely on other tests
4. **Error handling**: Test both success and error cases
5. **Edge cases**: Test boundary conditions and edge cases

## Known Limitations

### SQLite Limitations

- **DROP COLUMN**: Not supported. Tests verify that this throws an error.
- **ALTER COLUMN**: Limited support. Tests verify that this throws an error.
- **ADD FOREIGN KEY**: Not supported on existing tables. Tests verify this behavior.

### D1 Limitations

- **Transactions**: Supported via batch API, not traditional transactions.
- **Nested Transactions**: Not supported.
- **Connection Pooling**: Not applicable (stateless).

## Debugging Tests

### Enable Logging

Set `logging: true` in test data source:

```typescript
dataSource = await createTestDataSourceWithOptions([User], { logging: true });
```

### View Database State

You can query the database directly in tests:

```typescript
const db = await getTestDatabase();
const result = await db.prepare("SELECT * FROM users").all();
console.log(result.results);
```

### Debug Specific Test

Use `it.only` to run only a specific test:

```typescript
it.only("should test something", async () => {
  // Your test code
});
```

## CI/CD Integration

Tests are designed to run in CI/CD environments. The test suite:

- Uses Miniflare for local D1 database
- Doesn't require external dependencies
- Cleans up after each test
- Provides coverage reports

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add tests to the appropriate test file
3. Update this README if adding new test categories
4. Ensure tests pass before submitting
5. Add documentation for new test patterns

