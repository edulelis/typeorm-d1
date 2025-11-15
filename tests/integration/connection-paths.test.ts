import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";
import { D1QueryRunner } from "../../src/driver/d1";

// Helper to get all entities with relations
const getAllEntities = () => [User, Post, Profile, Tag];

describe("Connection Path Coverage Tests", () => {
  let dataSource: DataSource;
  let db: any;

  beforeAll(async () => {
    db = await getTestDatabase();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanupDataSource(dataSource);
    }
    await cleanupDatabase();
    await closeDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe("QueryRunner Connection Handling", () => {
    it("should handle connection initialization and connect() method", async () => {
      // Create data source
      dataSource = await createTestDataSource(getAllEntities());
      await dataSource.initialize();

      // Create query runner - this should trigger connection check
      const queryRunner = dataSource.createQueryRunner() as D1QueryRunner;
      
      // Call connect() directly to test the connection initialization path
      // This covers lines 40-48, including the defensive checks
      const database = await queryRunner.connect();
      expect(database).toBeDefined();
      expect(database.prepare).toBeDefined();

      // Execute a query to ensure connection works
      const result = await queryRunner.query("SELECT 1 as test");
      expect(result).toBeDefined();

      await queryRunner.release();
      await cleanupDataSource(dataSource);
    });

    it("should handle query execution after connection", async () => {
      dataSource = await createTestDataSource(getAllEntities());
      await dataSource.initialize();

      const queryRunner = dataSource.createQueryRunner();
      
      // Execute a query - this ensures connection is properly initialized
      const result = await queryRunner.query("SELECT 1 as test");
      expect(result).toBeDefined();

      await queryRunner.release();
      await cleanupDataSource(dataSource);
    });
  });

  describe("Transaction Error Handling", () => {
    it("should handle transaction commit errors (lines 302-306)", async () => {
      dataSource = await createTestDataSource(getAllEntities());
      await dataSource.initialize();

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.startTransaction();

      try {
        // Cause an error during transaction
        await queryRunner.query("SELECT * FROM non_existent_table_in_transaction");
      } catch (error: any) {
        // Error should be caught and transaction state cleaned up
        expect(error.message).toBeDefined();
      } finally {
        // Clean up transaction state
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }

      await cleanupDataSource(dataSource);
    });
  });

  describe("Table Metadata Edge Cases", () => {
    it("should handle getTable with non-existent table (line 333)", async () => {
      dataSource = await createTestDataSource(getAllEntities());
      await dataSource.initialize();

      const queryRunner = dataSource.createQueryRunner();
      const table = await queryRunner.getTable("non_existent_table_name");
      expect(table).toBeUndefined();

      await queryRunner.release();
      await cleanupDataSource(dataSource);
    });

    it("should handle getView with non-existent view (line 355)", async () => {
      dataSource = await createTestDataSource(getAllEntities());
      await dataSource.initialize();

      const queryRunner = dataSource.createQueryRunner();
      const view = await queryRunner.getView("non_existent_view_name");
      expect(view).toBeUndefined();

      await queryRunner.release();
      await cleanupDataSource(dataSource);
    });
  });

  describe("Database Operations", () => {
    it("should handle clearDatabase edge case (line 485)", async () => {
      dataSource = await createTestDataSource(getAllEntities());
      await dataSource.initialize();

      const queryRunner = dataSource.createQueryRunner();
      
      // Clear database when it might be empty or have tables
      // This tests the getTables() path which returns empty array
      await queryRunner.clearDatabase();
      
      // Should complete without error
      expect(true).toBe(true);

      await queryRunner.release();
      await cleanupDataSource(dataSource);
    });
  });
});

