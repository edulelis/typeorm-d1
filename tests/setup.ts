import "reflect-metadata";
import { Miniflare } from "miniflare";
import { D1Database } from "../src/types";

/**
 * Test setup and teardown for D1 database tests
 * Uses Miniflare to create a local D1 database instance for testing
 */

let mf: Miniflare | undefined;
let db: D1Database | undefined;

export async function getTestDatabase(): Promise<D1Database> {
  if (!mf) {
    mf = new Miniflare({
      modules: true,
      script: `export default { fetch() { return new Response("OK"); } }`,
      d1Databases: { TEST_DB: "test-db" },
    });
  }
  
  if (!db) {
    db = (await mf.getD1Database("TEST_DB")) as D1Database;
    
    if (!db) {
      throw new Error("Failed to get D1 database from Miniflare bindings.");
    }
  }
  
  return db;
}

export async function cleanupDatabase(): Promise<void> {
  if (db) {
    try {
      // Get all tables and drop them
      const tables = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND substr(lower(name), 1, 4) != '_cf_'"
      ).all<{ name: string }>();
      
      if (tables.results) {
        for (const table of tables.results) {
          try {
            await db.prepare(`DROP TABLE IF EXISTS "${table.name}"`).run();
          } catch (error) {
            // Ignore errors for individual table drops
          }
        }
      }
      
      // Also drop all indices
      const indices = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' AND substr(lower(name), 1, 4) != '_cf_'"
      ).all<{ name: string }>();
      
      if (indices.results) {
        for (const index of indices.results) {
          try {
            await db.prepare(`DROP INDEX IF EXISTS "${index.name}"`).run();
          } catch (error) {
            // Ignore errors for individual index drops
          }
        }
      }
    } catch (error) {
      // Ignore errors during cleanup - database might be empty
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (mf) {
    await mf.dispose();
    mf = undefined;
    db = undefined;
  }
}

const jestAfterAll = (globalThis as { afterAll?: (fn: () => Promise<void>) => void }).afterAll;
if (typeof jestAfterAll === "function") {
  jestAfterAll(async () => {
    await closeDatabase();
  });
}
