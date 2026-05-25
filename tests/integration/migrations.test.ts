import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { DataSource, MigrationInterface, QueryRunner } from "typeorm";
import { createD1DataSource } from "../../src/factory";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";
import { User, Post, Profile, Tag } from "../fixtures/entities";

// Helper to get all entities with relations
const getAllEntities = () => [User, Post, Profile, Tag];

class CreateMigrationSmoke1710000000000 implements MigrationInterface {
  name = "CreateMigrationSmoke1710000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS migration_smoke (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS migration_smoke");
  }
}

describe("Migration Tests", () => {
  let db: any;

  beforeAll(async () => {
    db = await getTestDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await closeDatabase();
  });

  describe("Migration Execution", () => {
    it("should run class migrations and create the migrations table", async () => {
      await cleanupDatabase();

      const dataSource = createD1DataSource({
        database: db,
        entities: [],
        migrations: [CreateMigrationSmoke1710000000000],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();
      const migrations = await dataSource.runMigrations();

      const table = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_smoke'"
      ).all();
      const migrationTable = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
      ).all();

      expect(migrations).toHaveLength(1);
      expect(table.results).toHaveLength(1);
      expect(migrationTable.results).toHaveLength(1);
      await dataSource.destroy();
    });

    it("should not rerun already-applied migrations", async () => {
      await cleanupDatabase();

      const dataSource = createD1DataSource({
        database: db,
        entities: [],
        migrations: [CreateMigrationSmoke1710000000000],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();
      const firstRun = await dataSource.runMigrations();
      const secondRun = await dataSource.runMigrations();

      expect(firstRun).toHaveLength(1);
      expect(secondRun).toHaveLength(0);
      await dataSource.destroy();
    });

    it("should undo the last migration for supported operations", async () => {
      await cleanupDatabase();

      const dataSource = createD1DataSource({
        database: db,
        entities: [],
        migrations: [CreateMigrationSmoke1710000000000],
        synchronize: false,
        logging: false,
      });

      await dataSource.initialize();
      await dataSource.runMigrations();
      await dataSource.undoLastMigration();

      const table = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migration_smoke'"
      ).all();

      expect(table.results).toHaveLength(0);
      await dataSource.destroy();
    });
  });

  describe("Synchronization Idempotency", () => {
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
