# TypeORM Driver for Cloudflare D1

A custom TypeORM driver that enables using Cloudflare D1 (SQLite-based serverless database) with TypeORM's full API, including entities, repositories, and query builder.

## Features

- ✅ Full TypeORM API support (`createConnection`, `repository.save`, `findOne`, etc.)
- ✅ Works with Cloudflare Workers and Pages Functions
- ✅ Transaction support via D1 batch API
- ✅ Schema synchronization and migrations
- ✅ TypeScript support with full type definitions
- ✅ Edge runtime compatible (no Node.js dependencies)

## Installation

```bash
npm install typeorm-d1 typeorm
```

## Usage

### Basic Setup

**Option 1: Using the helper function (Recommended)**

```typescript
import { createD1DataSource } from "typeorm-d1";
import { User } from "./entity/User";

// In your Cloudflare Worker or Pages Function
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const dataSource = createD1DataSource({
      database: env.DB, // D1 database instance from Cloudflare
      entities: [User],
      synchronize: true, // Auto-create tables (use migrations in production)
    });

    await dataSource.initialize();
    
    // Use TypeORM as normal
    const userRepo = dataSource.getRepository(User);
    const users = await userRepo.find();
    
    return new Response(JSON.stringify(users), {
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**Option 2: Using DataSource directly (Advanced)**

```typescript
import { DataSource } from "typeorm";
import { D1Driver } from "typeorm-d1";
import { User } from "./entity/User";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Note: This approach requires manual driver registration
    // Option 1 (createD1DataSource) is recommended for most use cases
    const dataSource = new DataSource({
      type: "sqlite", // D1 is SQLite-based
      database: ":memory:", // Dummy path (not used with D1)
      driver: {
        database: env.DB, // D1 database instance
      },
      entities: [User],
      synchronize: true,
    } as any);

    await dataSource.initialize();
    // ... rest of the code
  }
};
```

### Entity Definition

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt: Date;
}
```

### Using Repositories

```typescript
// Create
const user = userRepo.create({ name: "John", email: "john@example.com" });
await userRepo.save(user);

// Read
const users = await userRepo.find();
const user = await userRepo.findOne({ where: { id: 1 } });

// Update
user.name = "Jane";
await userRepo.save(user);

// Delete
await userRepo.remove(user);
```

### Using Query Builder

```typescript
const users = await userRepo
  .createQueryBuilder("user")
  .where("user.email = :email", { email: "john@example.com" })
  .getMany();
```

### Transactions

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.startTransaction();

try {
  await queryRunner.manager.save(user1);
  await queryRunner.manager.save(user2);
  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  // Note: In D1, rollback only cleans up transaction state.
  // Queries executed before the error are already committed.
  // See ISSUES.md for details and workarounds.
} finally {
  await queryRunner.release();
}
```

**Important**: D1 does not support true transaction rollback. Queries are executed immediately even within transactions. The `rollbackTransaction()` method cleans up transaction state but cannot undo already-executed queries. For error handling, use application-level validation and compensating transactions instead of relying on rollback.

### Migrations

```typescript
import { createD1DataSource } from "typeorm-d1";

const dataSource = createD1DataSource({
  database: env.DB,
  entities: [User],
  migrations: ["migrations/*.ts"],
  migrationsTableName: "migrations",
});

await dataSource.initialize();
await dataSource.runMigrations();
```

## API Reference

### DataSource Options

```typescript
interface D1DataSourceOptions {
  type: "d1";
  driver: {
    database: D1Database; // Required: D1 database instance
  };
  entities: Function[]; // Your entity classes
  synchronize?: boolean; // Auto-create tables
  migrations?: string[]; // Migration file paths
  logging?: boolean; // Enable query logging
}
```

### D1Database Interface

The driver expects a D1 database instance that implements the following interface:

```typescript
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1ExecResult>;
}
```

This matches Cloudflare's D1 API exactly.

## Limitations

Due to SQLite/D1 constraints:

- **ALTER TABLE**: Limited support. Some operations (DROP COLUMN, RENAME COLUMN) require recreating the table via migrations.
- **Schemas**: D1 doesn't support database schemas.
- **UUID Generation**: No native UUID support. Use `hex(randomblob(16))` or application-level UUID generation.
- **Transactions**: 
  - Supported via D1's batch API. Nested transactions are not supported.
  - **Important**: D1 does not support true transaction rollback. Once a query is executed within a transaction, it is immediately committed. The `rollbackTransaction()` method will clean up transaction state but cannot undo already-executed queries. See [ISSUES.md](./ISSUES.md) for details and workarounds.
- **Connection Pooling**: D1 uses a stateless connection model. There's no traditional connection pooling - each query uses the D1 database instance directly.

## TypeScript Support

Full TypeScript support with type definitions included. The package exports:

```typescript
// Main exports
import { 
  D1Driver, 
  D1QueryRunner, 
  D1DriverFactory,
  D1SchemaBuilder,
  createD1DataSource 
} from "typeorm-d1";

// Types
import type { D1Database, D1Result, D1ErrorCode } from "typeorm-d1";

// Errors
import { 
  D1DriverError,
  D1ConnectionError,
  D1ValidationError,
  D1QueryError,
  D1TransactionError 
} from "typeorm-d1";
```

## Compatibility

- **TypeORM**: v0.3.0+
- **Cloudflare Workers**: All versions
- **Cloudflare Pages**: All versions
- **Runtime**: Edge (Cloudflare Workers runtime)

## Testing

The project includes comprehensive tests using Jest and Miniflare for local D1 testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

Current test coverage (358 tests passing):

**Overall Coverage:**
- **Statements**: 85.28%
- **Branches**: 73.57%
- **Functions**: 85.41%
- **Lines**: 84.78%

**Module Coverage (Aggregated by Folder):**

**Driver (`src/driver/d1/`):**
- **Overall**: 90.9% (statements), 85.81% (branches), 90.16% (functions), 90.61% (lines)
- **d1-driver.ts**: 96.66% (statements), 80% (branches)
- **d1-query-runner.ts**: 92.15% (statements), 87.5% (branches)
- **d1-driver-factory.ts**: 42.85% (statements)
- **d1-schema-builder.ts**: 50% (statements)

**Factory (`src/factory/`):**
- **Overall**: 100% coverage
- **create-d1-data-source.ts**: 100% coverage

**Utils (`src/utils/`):**
- **Overall**: 74.7% (statements), 62.16% (branches), 78.26% (functions), 74.55% (lines)
- **query-normalizer.ts**: 100% coverage
- **constants.ts**: 100% coverage
- **metadata-parser.ts**: 86.11% (statements), 68.75% (branches)
- **error-handler.ts**: 71.11% (statements), 60.34% (branches)
- **driver-registry.ts**: 63.33% (statements), 50% (branches)
- **guards.ts**: 40% (statements), 47.61% (branches)

**Errors (`src/errors/`):**
- **Overall**: 92.85% (statements), 33.33% (branches), 70% (functions), 91.3% (lines)
- **D1Error.ts**: 90.9% (statements), 33.33% (branches)

Test suites include:
- Connection and DataSource tests
- CRUD operations
- Query builder
- Relations (OneToMany, ManyToOne, ManyToMany, OneToOne)
- Transactions (with D1 limitations documented)
- Schema synchronization
- Error handling
- SQL injection protection
- Concurrency tests
- Migration idempotency
- Large data handling
- Parameter binding
- Type coercion
- Complex queries
- Edge cases

## Development

```bash
# Build
npm run build

# The driver will be compiled to dist/
```

## Known Issues

See [ISSUES.md](./ISSUES.md) for a comprehensive list of known issues, limitations, and workarounds.

## License

MIT

