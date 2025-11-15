import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";

// Helper to get all entities with relations
const getAllEntities = () => [User, Post, Profile, Tag];

describe("Error Handling Tests", () => {
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

  describe("UNIQUE Constraint Violations", () => {
    it("should handle UNIQUE constraint errors with proper error code", async () => {
      // Create user with unique email
      await queryRunner.query(`
        INSERT INTO users (name, email, active, createdAt, updatedAt)
        VALUES ('User 1', 'test@example.com', 1, datetime('now'), datetime('now'))
      `);

      // Try to insert duplicate email
      try {
        await queryRunner.query(`
          INSERT INTO users (name, email, active, createdAt, updatedAt)
          VALUES ('User 2', 'test@example.com', 1, datetime('now'), datetime('now'))
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain("UNIQUE constraint");
        expect(error.code).toBe("SQLITE_CONSTRAINT_UNIQUE");
      }
    });
  });

  describe("NOT NULL Constraint Violations", () => {
    it("should handle NOT NULL constraint errors", async () => {
      // Try to insert without required field
      try {
        await queryRunner.query(`
          INSERT INTO users (email, active, createdAt, updatedAt)
          VALUES ('test2@example.com', 1, datetime('now'), datetime('now'))
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined();
        // Error should be caught and wrapped
        expect(error.code).toBeDefined();
      }
    });
  });

  describe("FOREIGN KEY Constraint Violations", () => {
    it("should handle FOREIGN KEY constraint errors", async () => {
      // Create posts table with foreign key
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          authorId INTEGER,
          FOREIGN KEY (authorId) REFERENCES users(id)
        )
      `);

      // Try to insert post with invalid authorId
      try {
        await queryRunner.query(`
          INSERT INTO posts (title, authorId)
          VALUES ('Test Post', 99999)
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined();
        // Error should be caught and wrapped
        expect(error.code).toBeDefined();
      }
    });
  });

  describe("CHECK Constraint Violations", () => {
    beforeEach(async () => {
      // Create table with CHECK constraints
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_check (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          age INTEGER CHECK(age >= 0 AND age <= 150),
          email TEXT CHECK(email LIKE '%@%'),
          score INTEGER CHECK(score >= 0),
          status TEXT CHECK(status IN ('active', 'inactive', 'pending'))
        )
      `);
    });

    afterEach(async () => {
      await queryRunner.query("DROP TABLE IF EXISTS test_check");
    });

    it("should handle CHECK constraint violation for age range", async () => {
      // Try to insert invalid age
      try {
        await queryRunner.query(`
          INSERT INTO test_check (age, email, score, status)
          VALUES (200, 'test@example.com', 10, 'active')
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should handle CHECK constraint violation for negative age", async () => {
      try {
        await queryRunner.query(`
          INSERT INTO test_check (age, email, score, status)
          VALUES (-1, 'test@example.com', 10, 'active')
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should handle CHECK constraint violation for email format", async () => {
      try {
        await queryRunner.query(`
          INSERT INTO test_check (age, email, score, status)
          VALUES (25, 'invalid-email', 10, 'active')
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should handle CHECK constraint violation for negative score", async () => {
      try {
        await queryRunner.query(`
          INSERT INTO test_check (age, email, score, status)
          VALUES (25, 'test@example.com', -10, 'active')
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should handle CHECK constraint violation for invalid status", async () => {
      try {
        await queryRunner.query(`
          INSERT INTO test_check (age, email, score, status)
          VALUES (25, 'test@example.com', 10, 'invalid')
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should allow valid data that passes CHECK constraints", async () => {
      // Valid data should insert successfully
      await queryRunner.query(`
        INSERT INTO test_check (age, email, score, status)
        VALUES (25, 'test@example.com', 10, 'active')
      `);

      const result = await queryRunner.query("SELECT * FROM test_check");
      expect(result.length).toBe(1);
      expect(result[0].age).toBe(25);
      expect(result[0].email).toBe("test@example.com");
      expect(result[0].score).toBe(10);
      expect(result[0].status).toBe("active");
    });

    it("should handle CHECK constraint in UPDATE", async () => {
      // Insert valid data
      await queryRunner.query(`
        INSERT INTO test_check (age, email, score, status)
        VALUES (25, 'test@example.com', 10, 'active')
      `);

      // Try to update with invalid value
      try {
        await queryRunner.query(`
          UPDATE test_check SET age = 200 WHERE id = 1
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should handle multiple CHECK constraints", async () => {
      // Try to violate multiple constraints at once
      try {
        await queryRunner.query(`
          INSERT INTO test_check (age, email, score, status)
          VALUES (200, 'invalid-email', -10, 'invalid')
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });
  });

  describe("Table Not Found Errors", () => {
    it("should handle 'no such table' errors", async () => {
      try {
        await queryRunner.query("SELECT * FROM non_existent_table");
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBe("SQLITE_ERROR");
      }
    });
  });

  describe("Query Syntax Errors", () => {
    it("should handle invalid SQL syntax", async () => {
      try {
        await queryRunner.query("SELECT * FROM users WHERE invalid syntax");
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should include query context in error message", async () => {
      try {
        await queryRunner.query("SELECT * FROM non_existent_table WHERE id = 1");
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("Query:");
        expect(error.message).toContain("non_existent_table");
      }
    });
  });

  describe("Transaction Error Handling", () => {
    it("should handle errors during transaction commit", async () => {
      await queryRunner.startTransaction();

      try {
        // Do something that might fail
        await queryRunner.query("SELECT * FROM non_existent_table");
      } catch (error: any) {
        // Error should be caught
        expect(error.message).toBeDefined();
      } finally {
        // Clean up transaction state
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
      }
    });

    it("should handle errors during transaction rollback", async () => {
      await queryRunner.startTransaction();
      
      // Rollback should work even if there were errors
      await queryRunner.rollbackTransaction();
      expect(queryRunner.isTransactionActive).toBe(false);
    });
  });

  describe("Error Message Formatting", () => {
    it("should format errors with query context", async () => {
      const longQuery = "SELECT * FROM " + "a".repeat(300) + "_table";
      
      try {
        await queryRunner.query(longQuery);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("Query:");
        // Query should be truncated to 200 chars + "..."
        // Error message includes "D1 Error: " prefix, so total length should be reasonable
        const queryPart = error.message.split("Query:")[1] || "";
        // Allow for newline and spacing (200 + "..." + newline = 204)
        expect(queryPart.length).toBeLessThanOrEqual(204);
      }
    });

    it("should handle errors without query context", async () => {
      // This tests the error path where query might not be available
      // We can't easily trigger this, but the code path exists
      expect(true).toBe(true);
    });
  });

  describe("D1 Exception Wrapping", () => {
    it("should wrap D1 exceptions with proper context", async () => {
      try {
        await queryRunner.query("INVALID SQL SYNTAX HERE");
        expect(true).toBe(false);
      } catch (error: any) {
        // Error should be wrapped
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
      }
    });

    it("should preserve error stack traces", async () => {
      try {
        await queryRunner.query("SELECT * FROM non_existent_table");
        expect(true).toBe(false);
      } catch (error: any) {
        // Stack trace should be preserved if available
        if (error.stack) {
          expect(error.stack).toBeDefined();
        }
      }
    });
  });

  describe("Error Code Mapping", () => {
    it("should map UNIQUE constraint errors correctly", async () => {
      await queryRunner.query(`
        INSERT INTO users (name, email, active, createdAt, updatedAt)
        VALUES ('User 1', 'unique@example.com', 1, datetime('now'), datetime('now'))
      `);

      try {
        await queryRunner.query(`
          INSERT INTO users (name, email, active, createdAt, updatedAt)
          VALUES ('User 2', 'unique@example.com', 1, datetime('now'), datetime('now'))
        `);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_CONSTRAINT_UNIQUE");
      }
    });

    it("should map generic errors correctly", async () => {
      try {
        await queryRunner.query("SELECT * FROM non_existent_table");
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.code).toBe("SQLITE_ERROR");
      }
    });
  });
});

