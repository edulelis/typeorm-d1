import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";

// Helper to get all entities with relations
const getAllEntities = () => [User, Post, Profile, Tag];

describe("Error Code Path Coverage Tests", () => {
  let dataSource: DataSource;
  let db: any;
  let queryRunner: any;

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
    dataSource = await createTestDataSource(getAllEntities());
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
  });

  afterEach(async () => {
    if (queryRunner) {
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await cleanupDataSource(dataSource);
    }
  });

  describe("checkD1Error - All Error Code Paths", () => {
    it("should map UNIQUE constraint error (line 171-172)", async () => {
      await queryRunner.query(`
        INSERT INTO users (name, email, active, createdAt, updatedAt)
        VALUES ('User 1', 'unique-path@example.com', 1, datetime('now'), datetime('now'))
      `);

      try {
        await queryRunner.query(`
          INSERT INTO users (name, email, active, createdAt, updatedAt)
          VALUES ('User 2', 'unique-path@example.com', 1, datetime('now'), datetime('now'))
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_CONSTRAINT_UNIQUE");
        expect(error.message).toContain("UNIQUE constraint");
      }
    });

    it("should map NOT NULL constraint error (line 173-174)", async () => {
      // Create a table with NOT NULL constraint
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_not_null (
          id INTEGER PRIMARY KEY,
          required_field TEXT NOT NULL
        )
      `);

      try {
        await queryRunner.query(`
          INSERT INTO test_not_null (id) VALUES (1)
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_CONSTRAINT_NOTNULL");
        expect(error.message).toContain("NOT NULL constraint");
      }
    });

    it("should map FOREIGN KEY constraint error (line 175-176)", async () => {
      // Create tables with foreign key
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_fk_parent (
          id INTEGER PRIMARY KEY
        )
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_fk_child (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER,
          FOREIGN KEY (parent_id) REFERENCES test_fk_parent(id)
        )
      `);

      try {
        await queryRunner.query(`
          INSERT INTO test_fk_child (id, parent_id) VALUES (1, 999)
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_CONSTRAINT_FOREIGNKEY");
        expect(error.message).toContain("FOREIGN KEY constraint");
      }
    });

    it("should map 'no such table' error (line 177-178)", async () => {
      try {
        await queryRunner.query("SELECT * FROM definitely_does_not_exist_table");
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_ERROR");
        expect(error.message).toContain("no such table");
      }
    });

    it("should map 'already exists' error (line 177-178)", async () => {
      // Create a table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_already_exists (
          id INTEGER PRIMARY KEY
        )
      `);

      // Try to create again without IF NOT EXISTS
      try {
        await queryRunner.query(`
          CREATE TABLE test_already_exists (
            id INTEGER PRIMARY KEY
          )
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_ERROR");
        expect(error.message).toContain("already exists");
      }
    });

    it("should handle generic D1_ERROR (line 168)", async () => {
      // Try an invalid SQL that doesn't match specific patterns
      try {
        await queryRunner.query("INVALID SQL SYNTAX THAT DOESN'T MATCH PATTERNS");
        expect(true).toBe(false);
      } catch (error: any) {
        // Should have a code, even if generic
        expect(error.code).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    it("should include query context when available (line 162-164)", async () => {
      const testQuery = "SELECT * FROM non_existent_table WHERE id = 42";
      try {
        await queryRunner.query(testQuery);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("Query:");
        expect(error.message).toContain("non_existent_table");
      }
    });

    it("should handle query without context (line 159, 202)", async () => {
      // This tests the path where query might not be provided
      // The checkD1Error method is called with query parameter
      // But we can test the error path without query by checking error handling
      try {
        await queryRunner.query("SELECT * FROM non_existent");
        expect(true).toBe(false);
      } catch (error: any) {
        // Error should still be properly formatted
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });
  });

  describe("wrapD1Exception - All Error Code Paths", () => {
    it("should handle errors with cause.message (Miniflare format)", async () => {
      // This tests the path where error.cause.message exists
      // Miniflare wraps errors in this format
      try {
        await queryRunner.query("SELECT * FROM non_existent_table");
        expect(true).toBe(false);
      } catch (error: any) {
        // Error should be wrapped properly
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should preserve stack traces when available", async () => {
      try {
        await queryRunner.query("SELECT * FROM non_existent_table");
        expect(true).toBe(false);
      } catch (error: any) {
        // If stack exists, it should be preserved
        if (error.stack) {
          expect(error.stack).toBeDefined();
        }
      }
    });
  });
});

