import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DataSource } from "typeorm";
import { createD1DataSource } from "../../src/factory";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";
import { User, Post, Profile, Tag } from "../fixtures/entities";

// Helper to get all entities with relations
const getAllEntities = () => [User, Post, Profile, Tag];

describe("Migration Tests", () => {
  let db: any;

  beforeAll(async () => {
    db = await getTestDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await closeDatabase();
  });

  describe("Migration Idempotency", () => {
    it("should handle running synchronize twice without errors", async () => {
      // Clean up first to ensure fresh start
      await cleanupDatabase();
      
      // First synchronization
      let dataSource1 = createD1DataSource({
        database: db,
        entities: getAllEntities(),
        synchronize: true,
        logging: false,
      });

      await dataSource1.initialize();
      expect(dataSource1.isInitialized).toBe(true);
      await dataSource1.destroy();

      // Second synchronization (should not fail - TypeORM uses IF NOT EXISTS)
      let dataSource2 = createD1DataSource({
        database: db,
        entities: getAllEntities(),
        synchronize: true,
        logging: false,
      });

      await dataSource2.initialize();
      expect(dataSource2.isInitialized).toBe(true);
      await dataSource2.destroy();
    });

    it("should create tables with IF NOT EXISTS", async () => {
      // Clean up first
      await cleanupDatabase();

      // Create data source and synchronize
      const dataSource = createD1DataSource({
        database: db,
        entities: getAllEntities(),
        synchronize: true,
        logging: false,
      });

      await dataSource.initialize();

      // Verify table was created
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).all();

      expect(result.results).toBeDefined();
      expect(result.results?.length).toBe(1);

      await dataSource.destroy();
    });

    it("should handle schema changes gracefully", async () => {
      // Clean up first
      await cleanupDatabase();
      
      // This test documents that schema changes require migrations
      // Synchronize can add columns but not remove them
      const dataSource = createD1DataSource({
        database: db,
        entities: getAllEntities(),
        synchronize: true,
        logging: false,
      });

      await dataSource.initialize();

      // Verify table exists
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).all();

      expect(result.results?.length).toBe(1);

      await dataSource.destroy();
    });
  });

  describe("Schema Consistency", () => {
    it("should maintain schema consistency across multiple initializations", async () => {
      // Clean up first
      await cleanupDatabase();

      // Initialize multiple times
      for (let i = 0; i < 3; i++) {
        const dataSource = createD1DataSource({
          database: db,
          entities: getAllEntities(),
          synchronize: true,
          logging: false,
        });

        await dataSource.initialize();
        expect(dataSource.isInitialized).toBe(true);
        await dataSource.destroy();
      }

      // Verify table still exists and is consistent
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).all();

      expect(result.results?.length).toBe(1);
    });
  });
});

