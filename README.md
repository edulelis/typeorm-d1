# typeorm-d1

TypeORM DataSource adapter for Cloudflare D1.

This package lets a TypeORM `DataSource` execute SQLite-compatible TypeORM
queries against a Cloudflare D1 binding. It supports repositories, query
builder, schema synchronization for supported SQLite operations, migrations,
query logging, view introspection, and an explicit D1 batch helper.

It does not provide true interactive database transactions. TypeORM transaction
methods are compatibility shims; use explicit D1 batches when you need D1's
atomic multi-statement batch behavior.

## Installation

```bash
npm install typeorm-d1 typeorm reflect-metadata
```

`typeorm` and `reflect-metadata` are peer dependencies. The package does not
bundle TypeORM, so applications keep a single TypeORM copy.

## Basic Usage

```typescript
import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { createD1DataSource } from "typeorm-d1";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  email!: string;

  @Column()
  name!: string;
}

export interface Env {
  DB: D1Database;
}

let dataSource: ReturnType<typeof createD1DataSource> | undefined;

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    dataSource ??= createD1DataSource({
      database: env.DB,
      entities: [User],
      synchronize: false,
      logging: false,
    });

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const users = await dataSource.getRepository(User).find();
    return Response.json(users);
  },
};
```

Use migrations rather than `synchronize: true` in production. D1 is SQLite
based, and SQLite has limited `ALTER TABLE` support.

## Public API

```typescript
import {
  createD1DataSource,
  registerD1Driver,
  executeD1Batch,
  D1Driver,
  D1QueryRunner,
  D1SchemaBuilder,
  D1DriverError,
  D1QueryError,
} from "typeorm-d1";

import type {
  D1DataSourceOptions,
  D1Database,
  D1BatchStatement,
  D1Result,
  D1ErrorCode,
} from "typeorm-d1";
```

### `createD1DataSource(options)`

Creates a TypeORM `DataSource` configured for a D1 binding.

```typescript
const dataSource = createD1DataSource({
  database: env.DB,
  entities: [User],
  migrations: [CreateUsers1710000000000],
  logging: true,
});
```

### `registerD1Driver()`

Registers the D1 driver with TypeORM's `DriverFactory`. Most applications do
not need this because `createD1DataSource()` calls it automatically.

```typescript
import { DataSource } from "typeorm";
import { registerD1Driver } from "typeorm-d1";

registerD1Driver();

const dataSource = new DataSource({
  type: "sqlite",
  database: ":memory:",
  driver: { database: env.DB },
  entities: [User],
} as any);
```

## Queries And Repositories

Repository and query builder operations work through TypeORM as usual.

```typescript
const repository = dataSource.getRepository(User);

await repository.save({ email: "ada@example.com", name: "Ada" });

const users = await repository
  .createQueryBuilder("user")
  .where("user.email = :email", { email: "ada@example.com" })
  .getMany();
```

Raw parameterized queries are supported. `undefined` bind parameters are
converted to `null` for D1 compatibility.

```typescript
await dataSource.query("SELECT * FROM users WHERE email = ?", [
  "ada@example.com",
]);
```

## Transactions And D1 Batches

Cloudflare D1 supports atomic batches through `D1Database.batch()`. It does not
support interactive transactions where code can run a query, inspect the result,
then decide whether to commit or roll back later.

For that reason, TypeORM transaction methods in this driver are compatibility
shims:

- `startTransaction()` marks the query runner as transaction-active.
- Queries execute immediately.
- `commitTransaction()` clears local transaction state.
- `rollbackTransaction()` clears local transaction state and does not undo
  already executed writes.
- Nested transactions are rejected.

Use `executeD1Batch()` or `D1QueryRunner.executeBatch()` when all statements are
known up front and you need D1's atomic batch behavior.

```typescript
import { executeD1Batch } from "typeorm-d1";

await executeD1Batch(dataSource, [
  {
    query: "INSERT INTO users (email, name) VALUES (?, ?)",
    parameters: ["ada@example.com", "Ada"],
  },
  {
    query: "INSERT INTO users (email, name) VALUES (?, ?)",
    parameters: ["grace@example.com", "Grace"],
  },
]);
```

Do not treat D1 batches as a drop-in replacement for TypeORM repository
transactions. Repository operations need generated ids, relation state, reads,
and errors immediately.

## Migrations

TypeORM class migrations are supported for SQLite-compatible operations.

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1710000000000 implements MigrationInterface {
  name = "CreateUsers1710000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS users");
  }
}
```

```typescript
const dataSource = createD1DataSource({
  database: env.DB,
  entities: [User],
  migrations: [CreateUsers1710000000000],
});

await dataSource.initialize();
await dataSource.runMigrations();
```

SQLite/D1 cannot apply every schema mutation in place. For unsupported changes
such as many column alterations, write migrations that recreate tables safely.

## Logging

TypeORM query logging and custom loggers are supported.

```typescript
const dataSource = createD1DataSource({
  database: env.DB,
  entities: [User],
  logging: true,
  maxQueryExecutionTime: 100,
});
```

Custom TypeORM loggers receive query, slow query, and query error events.

## Limitations

- No database schemas. D1 is SQLite based.
- Limited `ALTER TABLE`; unsupported schema operations should be handled with
  explicit migrations.
- TypeORM transaction rollback does not undo writes.
- Nested TypeORM transactions are not supported.
- D1 sessions/read-replica bookmark APIs are typed but not wrapped by the
  driver.
- UUIDs should be generated by application code or SQLite expressions such as
  `hex(randomblob(16))`.
- This package is tested with Miniflare's D1 implementation and TypeORM 0.3.x.

## Compatibility

- TypeORM: `^0.3.0`
- Cloudflare Workers D1 bindings
- Local tests: Miniflare 4
- Tooling: Node.js 20 and 22

The published package includes CommonJS, ESM, and TypeScript declaration
entrypoints.

## Development

```bash
npm ci
npm run build
npm test
npm run test:coverage
npm run verify
```

`npm run verify` builds the package, runs the Jest suite, checks CJS/ESM
imports, runs a built-package D1 smoke test, and validates package contents.

Coverage reports are generated locally in `coverage/` and are not committed.

## Security

Please report security issues privately. See [SECURITY.md](./SECURITY.md).

## License

MIT
