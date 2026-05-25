import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createD1DataSource, executeD1Batch } from "../../src/factory";
import { D1Database } from "../../src/types";
import { cleanupDatabase, getTestDatabase } from "../setup";

function wrapDatabaseWithBatchCounter(database: D1Database): {
  database: D1Database;
  getBatchCalls: () => number;
} {
  let batchCalls = 0;
  return {
    database: {
      prepare: database.prepare.bind(database),
      exec: database.exec.bind(database),
      batch: (...args) => {
        batchCalls++;
        return database.batch(...args);
      },
      withSession: database.withSession?.bind(database),
      dump: database.dump?.bind(database),
    },
    getBatchCalls: () => batchCalls,
  };
}

describe("Explicit D1 Batch Execution", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("executes multiple statements through D1 batch exactly once", async () => {
    const wrapped = wrapDatabaseWithBatchCounter(await getTestDatabase());
    const dataSource = createD1DataSource({
      database: wrapped.database,
      entities: [],
      synchronize: false,
    });

    await dataSource.initialize();
    await dataSource.query("CREATE TABLE batch_users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE)");

    const results = await executeD1Batch(dataSource, [
      { query: "INSERT INTO batch_users (email) VALUES (?)", parameters: ["a@example.com"] },
      { query: "INSERT INTO batch_users (email) VALUES (?)", parameters: ["b@example.com"] },
    ]);

    const rows = await dataSource.query("SELECT email FROM batch_users ORDER BY email");
    expect(wrapped.getBatchCalls()).toBe(1);
    expect(results).toHaveLength(2);
    expect(rows.map((row: any) => row.email)).toEqual(["a@example.com", "b@example.com"]);
    await dataSource.destroy();
  });

  it("rejects empty batches", async () => {
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
    });

    await dataSource.initialize();
    await expect(executeD1Batch(dataSource, [])).rejects.toThrow("D1 batch requires at least one statement");
    await dataSource.destroy();
  });

  it("rolls back prior statements when a D1 batch statement fails", async () => {
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
    });

    await dataSource.initialize();
    await dataSource.query("CREATE TABLE batch_unique (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE)");

    await expect(
      executeD1Batch(dataSource, [
        { query: "INSERT INTO batch_unique (email) VALUES (?)", parameters: ["duplicate@example.com"] },
        { query: "INSERT INTO batch_unique (email) VALUES (?)", parameters: ["duplicate@example.com"] },
      ])
    ).rejects.toThrow();

    const rows = await dataSource.query("SELECT email FROM batch_unique");
    expect(rows).toHaveLength(0);
    await dataSource.destroy();
  });

  it("binds undefined parameters as null", async () => {
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
    });

    await dataSource.initialize();
    await dataSource.query("CREATE TABLE batch_nulls (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NULL)");
    await executeD1Batch(dataSource, [
      { query: "INSERT INTO batch_nulls (value) VALUES (?)", parameters: [undefined] },
    ]);

    const rows = await dataSource.query("SELECT value FROM batch_nulls");
    expect(rows).toEqual([{ value: null }]);
    await dataSource.destroy();
  });
});
