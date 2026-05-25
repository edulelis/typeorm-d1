import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { Logger, QueryRunner } from "typeorm";
import { createD1DataSource } from "../../src/factory";
import { cleanupDatabase, getTestDatabase } from "../setup";

class CollectingLogger implements Logger {
  queries: Array<{ query: string; parameters?: any[] }> = [];
  errors: Array<{ error: string | Error; query: string; parameters?: any[] }> = [];
  slowQueries: Array<{ time: number; query: string; parameters?: any[] }> = [];

  logQuery(query: string, parameters?: any[]): void {
    this.queries.push({ query, parameters });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[]): void {
    this.errors.push({ error, query, parameters });
  }

  logQuerySlow(time: number, query: string, parameters?: any[]): void {
    this.slowQueries.push({ time, query, parameters });
  }

  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

describe("Logging and Query Events", () => {
  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterEach(async () => {
    await cleanupDatabase();
  });

  it("emits query logs when logging is enabled", async () => {
    const logger = new CollectingLogger();
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
      logging: true,
      logger,
    });

    await dataSource.initialize();
    await dataSource.query("SELECT ? as value", [1]);

    expect(logger.queries.some((entry) => entry.query === "SELECT ? as value")).toBe(true);
    await dataSource.destroy();
  });

  it("emits query error logs for failed queries", async () => {
    const logger = new CollectingLogger();
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
      logging: true,
      logger,
    });

    await dataSource.initialize();
    await expect(dataSource.query("SELECT * FROM missing_logging_table")).rejects.toThrow();

    expect(logger.errors.length).toBeGreaterThan(0);
    expect(logger.errors[0].query).toContain("missing_logging_table");
    await dataSource.destroy();
  });

  it("emits slow query logs when maxQueryExecutionTime is exceeded", async () => {
    const logger = new CollectingLogger();
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
      logging: true,
      logger,
      maxQueryExecutionTime: -1,
    });

    await dataSource.initialize();
    await dataSource.query("SELECT 1");

    expect(logger.slowQueries.length).toBeGreaterThan(0);
    await dataSource.destroy();
  });

  it("broadcasts before and after query events for success and failure", async () => {
    const events: Array<{ type: string; query: string; success?: boolean; error?: unknown }> = [];
    const dataSource = createD1DataSource({
      database: await getTestDatabase(),
      entities: [],
      synchronize: false,
      subscribers: [],
    });

    await dataSource.initialize();
    dataSource.subscribers.push({
      beforeQuery(event: { query: string }) {
        events.push({ type: "before", query: event.query });
      },
      afterQuery(event: { query: string; success: boolean; error?: unknown }) {
        events.push({
          type: "after",
          query: event.query,
          success: event.success,
          error: event.error,
        });
      },
    } as any);

    await dataSource.query("SELECT 1");
    await expect(dataSource.query("SELECT * FROM missing_broadcast_table")).rejects.toThrow();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "before", query: "SELECT 1" }),
        expect.objectContaining({ type: "after", query: "SELECT 1", success: true }),
        expect.objectContaining({ type: "before", query: "SELECT * FROM missing_broadcast_table" }),
        expect.objectContaining({ type: "after", query: "SELECT * FROM missing_broadcast_table", success: false }),
      ])
    );
    await dataSource.destroy();
  });
});
