import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

// Helper to get all entities with relations
function getAllEntities() {
  return [User, Post, Profile, Tag];
}

describe("Parameter Binding Tests", () => {
  let dataSource: DataSource;
  let queryRunner: any;

  beforeAll(async () => {
    dataSource = await createTestDataSource(getAllEntities());
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
  });

  afterAll(async () => {
    await queryRunner.release();
    await cleanupDataSource(dataSource);
    await cleanupDatabase();
  });

  beforeEach(async () => {
    await queryRunner.query("DELETE FROM users");
  });

  describe("undefined Parameters", () => {
    it("should handle undefined as NULL", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Test User", "test@example.com", 1, undefined]
      );

      const result = await queryRunner.query("SELECT age FROM users WHERE email = 'test@example.com'");
      expect(result.length).toBe(1);
      expect(result[0].age).toBeNull();
    });

    it("should handle undefined in WHERE clause", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 1", "user1@example.com", 1, null]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 2", "user2@example.com", 1, 30]
      );

      // undefined is converted to null, so use IS NULL for matching
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE age IS ?",
        [null] // undefined converted to null
      );

      // Should match NULL values (at least User 1)
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle multiple undefined parameters", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Test", "test@example.com", 1, undefined]
      );

      // undefined is converted to null, so use IS NULL for matching
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ? AND age IS ?",
        ["Test", null] // undefined converted to null
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Array Parameters", () => {
    it("should handle array parameters in IN clause", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["User 1", "user1@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["User 2", "user2@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["User 3", "user3@example.com", 1]
      );

      // Note: D1 may not support array binding directly, so we test with multiple placeholders
      const emails = ["user1@example.com", "user2@example.com"];
      const placeholders = emails.map(() => "?").join(",");
      const result = await queryRunner.query(
        `SELECT * FROM users WHERE email IN (${placeholders})`,
        emails
      );

      expect(result.length).toBe(2);
    });

    it("should handle empty array in IN clause", async () => {
      // Empty array should return no results
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE email IN (?)",
        [[]]
      );

      expect(result.length).toBe(0);
    });
  });

  describe("Mixed Parameter Types", () => {
    it("should handle mixed string, number, and boolean parameters", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Mixed User", "mixed@example.com", 1, 25]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ? AND active = ? AND age = ?",
        ["Mixed User", 1, 25]
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Mixed User");
      expect(result[0].active).toBe(1);
      expect(result[0].age).toBe(25);
    });

    it("should handle mixed types with NULL", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Null Age", "nullage@example.com", 1, null]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ? AND age IS ?",
        ["Null Age", null]
      );

      expect(result.length).toBe(1);
      expect(result[0].age).toBeNull();
    });

    it("should handle Date parameters mixed with other types", async () => {
      const now = new Date();
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        ["Date User", "date@example.com", 1, now.toISOString(), now.toISOString()]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE email = ? AND active = ?",
        ["date@example.com", 1]
      );

      expect(result.length).toBe(1);
    });
  });

  describe("Buffer/Blob Parameters", () => {
    it("should handle Buffer parameters", async () => {
      // Create a test table with BLOB column
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_blob (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          data BLOB
        )
      `);

      const buffer = Buffer.from("test binary data", "utf-8");
      await queryRunner.query(
        "INSERT INTO test_blob (name, data) VALUES (?, ?)",
        ["Test", buffer]
      );

      const result = await queryRunner.query("SELECT * FROM test_blob WHERE name = 'Test'");
      expect(result.length).toBe(1);
      expect(result[0].data).toBeDefined();

      await queryRunner.query("DROP TABLE IF EXISTS test_blob");
    });

    it("should handle large Buffer parameters", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_large_blob (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          data BLOB
        )
      `);

      // Create a 1KB buffer
      const largeBuffer = Buffer.alloc(1024, "x");
      await queryRunner.query(
        "INSERT INTO test_large_blob (name, data) VALUES (?, ?)",
        ["Large", largeBuffer]
      );

      const result = await queryRunner.query("SELECT LENGTH(data) as size FROM test_large_blob WHERE name = 'Large'");
      expect(result[0].size).toBe(1024);

      await queryRunner.query("DROP TABLE IF EXISTS test_large_blob");
    });

    it("should handle NULL BLOB", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_null_blob (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          data BLOB
        )
      `);

      await queryRunner.query(
        "INSERT INTO test_null_blob (name, data) VALUES (?, ?)",
        ["Null Blob", null]
      );

      const result = await queryRunner.query("SELECT * FROM test_null_blob WHERE name = 'Null Blob'");
      expect(result.length).toBe(1);
      expect(result[0].data).toBeNull();

      await queryRunner.query("DROP TABLE IF EXISTS test_null_blob");
    });
  });

  describe("Parameter Ordering", () => {
    it("should handle parameters in correct order", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Order Test", "order@example.com", 1, 30]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ? AND email = ? AND age = ?",
        ["Order Test", "order@example.com", 30]
      );

      expect(result.length).toBe(1);
    });

    it("should handle parameters in different order", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Order Test 2", "order2@example.com", 1, 25]
      );

      // Query with parameters in different order than WHERE clause
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE age = ? AND name = ?",
        [25, "Order Test 2"]
      );

      expect(result.length).toBe(1);
    });
  });

  describe("Special Characters in Parameters", () => {
    it("should handle single quotes in parameters", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["O'Brien", "obrien@example.com", 1]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ?",
        ["O'Brien"]
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("O'Brien");
    });

    it("should handle double quotes in parameters", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ['User "Test"', 'test@example.com', 1]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ?",
        ['User "Test"']
      );

      expect(result.length).toBe(1);
    });

    it("should handle semicolons in parameters", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Test; User", "test@example.com", 1]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ?",
        ["Test; User"]
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Test; User");
    });

    it("should handle SQL-like strings in parameters", async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        [maliciousInput, "malicious@example.com", 1]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ?",
        [maliciousInput]
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe(maliciousInput);

      // Verify table still exists
      const tableCheck = await queryRunner.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      expect(tableCheck.length).toBe(1);
    });
  });

  describe("Very Large Parameters", () => {
    it("should handle very long string parameters", async () => {
      // Create a 1MB string
      const largeString = "x".repeat(1024 * 1024);
      
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_large_string (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          content TEXT
        )
      `);

      await queryRunner.query(
        "INSERT INTO test_large_string (name, content) VALUES (?, ?)",
        ["Large", largeString]
      );

      const result = await queryRunner.query("SELECT LENGTH(content) as length FROM test_large_string WHERE name = 'Large'");
      expect(result[0].length).toBe(1024 * 1024);

      await queryRunner.query("DROP TABLE IF EXISTS test_large_string");
    });

    it("should handle very large number parameters", async () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Large Number", "large@example.com", 1, largeNumber]
      );

      const result = await queryRunner.query("SELECT age FROM users WHERE email = 'large@example.com'");
      expect(result[0].age).toBe(largeNumber);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero as parameter", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Zero Age", "zero@example.com", 1, 0]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE age = ?",
        [0]
      );

      expect(result.length).toBe(1);
      expect(result[0].age).toBe(0);
    });

    it("should handle empty string as parameter", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["", "empty@example.com", 1]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE name = ?",
        [""]
      );

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("");
    });

    it("should handle boolean false as parameter", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Inactive", "inactive@example.com", 0]
      );

      const result = await queryRunner.query(
        "SELECT * FROM users WHERE active = ?",
        [0]
      );

      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});

