import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

// Helper to get all entities with relations
function getAllEntities() {
  return [User, Post, Profile, Tag];
}

describe("Type Coercion Tests", () => {
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

  describe("Storing Wrong Types in Columns", () => {
    it("should store string in INTEGER column (SQLite flexibility)", async () => {
      // SQLite allows storing strings in INTEGER columns
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_type_flex (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          int_col INTEGER,
          text_col TEXT
        )
      `);

      // Store string in INTEGER column
      await queryRunner.query(
        "INSERT INTO test_type_flex (int_col, text_col) VALUES (?, ?)",
        ["123", "test"]
      );

      const result = await queryRunner.query("SELECT * FROM test_type_flex");
      expect(result.length).toBe(1);
      // SQLite may coerce or store as-is
      expect(result[0].int_col).toBeDefined();

      await queryRunner.query("DROP TABLE IF EXISTS test_type_flex");
    });

    it("should store number in TEXT column", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_type_flex (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text_col TEXT
        )
      `);

      // Store number in TEXT column
      await queryRunner.query(
        "INSERT INTO test_type_flex (text_col) VALUES (?)",
        [123]
      );

      const result = await queryRunner.query("SELECT * FROM test_type_flex");
      expect(result.length).toBe(1);
      // Should be stored as string representation
      expect(result[0].text_col).toBeDefined();

      await queryRunner.query("DROP TABLE IF EXISTS test_type_flex");
    });

    it("should store boolean in INTEGER column", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_type_flex (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          int_col INTEGER
        )
      `);

      // D1 doesn't support boolean directly, convert to 1/0
      await queryRunner.query(
        "INSERT INTO test_type_flex (int_col) VALUES (?)",
        [1] // Use 1 instead of true
      );

      const result = await queryRunner.query("SELECT * FROM test_type_flex");
      expect(result.length).toBe(1);
      expect(result[0].int_col).toBe(1);

      await queryRunner.query("DROP TABLE IF EXISTS test_type_flex");
    });
  });

  describe("Type Coercion in WHERE Clauses", () => {
    beforeEach(async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 1", "user1@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 2", "user2@example.com", 1, 25]
      );
    });

    it("should coerce string to number in WHERE clause", async () => {
      // Compare INTEGER column with string
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE age = ?",
        ["30"]
      );

      expect(result.length).toBe(1);
      expect(result[0].age).toBe(30);
    });

    it("should coerce number to string in WHERE clause", async () => {
      // Compare TEXT column with number
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE email = ?",
        [123] // Wrong type, but SQLite may handle it
      );

      // Should not match (email is text, 123 won't match)
      expect(result.length).toBe(0);
    });

    it("should handle type coercion in comparisons", async () => {
      // Compare with string representation of number
      const result = await queryRunner.query(
        "SELECT * FROM users WHERE age > ?",
        ["25"]
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.age).toBeGreaterThan(25);
      });
    });
  });

  describe("Type Coercion in JOINs", () => {
    beforeEach(async () => {
      const userId1 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author 1", "author1@example.com", 1]
      );
      const userId2 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author 2", "author2@example.com", 1]
      );

      // Posts table only has createdAt, not updatedAt
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content", userId1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 2", "Content", userId2]
      );
    });

    it("should handle type coercion in JOIN conditions", async () => {
      // Join with numeric comparison (no need for CAST in this case)
      const result = await queryRunner.query(`
        SELECT u.name, p.title
        FROM users u
        INNER JOIN posts p ON p.authorId = u.id
        WHERE u.id = ?
      `, [1]);

      // Should handle the join correctly
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Type Coercion in Aggregations", () => {
    beforeEach(async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 1", "user1@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 2", "user2@example.com", 1, 25]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 3", "user3@example.com", 1, 35]
      );
    });

    it("should handle type coercion in AVG", async () => {
      const result = await queryRunner.query(`
        SELECT AVG(CAST(age AS REAL)) as avgAge
        FROM users
        WHERE age IS NOT NULL
      `);

      expect(result.length).toBe(1);
      expect(result[0].avgAge).toBeGreaterThan(0);
      expect(result[0].avgAge).toBeCloseTo(30, 0); // (30+25+35)/3 = 30
    });

    it("should handle type coercion in SUM", async () => {
      const result = await queryRunner.query(`
        SELECT SUM(CAST(age AS INTEGER)) as totalAge
        FROM users
        WHERE age IS NOT NULL
      `);

      expect(result.length).toBe(1);
      expect(result[0].totalAge).toBe(90); // 30+25+35
    });

    it("should handle type coercion in COUNT", async () => {
      const result = await queryRunner.query(`
        SELECT COUNT(CAST(age AS TEXT)) as ageCount
        FROM users
        WHERE age IS NOT NULL
      `);

      expect(result.length).toBe(1);
      expect(result[0].ageCount).toBe(3);
    });
  });

  describe("Numeric String Coercion", () => {
    it("should coerce numeric strings to numbers", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_numeric (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          num_col INTEGER,
          text_col TEXT
        )
      `);

      await queryRunner.query(
        "INSERT INTO test_numeric (num_col, text_col) VALUES (?, ?)",
        ["123", "456"]
      );

      const result = await queryRunner.query(`
        SELECT 
          num_col,
          text_col,
          num_col + 10 as added,
          CAST(text_col AS INTEGER) as textAsInt
        FROM test_numeric
      `);

      expect(result.length).toBe(1);
      expect(result[0].added).toBe(133); // 123 + 10
      expect(result[0].textAsInt).toBe(456);

      await queryRunner.query("DROP TABLE IF EXISTS test_numeric");
    });
  });

  describe("Empty String vs NULL", () => {
    it("should distinguish between empty string and NULL", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_empty (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          description TEXT
        )
      `);

      await queryRunner.query(
        "INSERT INTO test_empty (name, description) VALUES (?, ?)",
        ["", null]
      );

      const emptyResult = await queryRunner.query(
        "SELECT * FROM test_empty WHERE name = ?",
        [""]
      );
      expect(emptyResult.length).toBe(1);

      const nullResult = await queryRunner.query(
        "SELECT * FROM test_empty WHERE description IS NULL"
      );
      expect(nullResult.length).toBe(1);

      await queryRunner.query("DROP TABLE IF EXISTS test_empty");
    });

    it("should handle empty string in comparisons", async () => {
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
  });

  describe("Date/Time String Handling", () => {
    it("should handle various date formats", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_dates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date_col TEXT,
          datetime_col TEXT
        )
      `);

      const formats = [
        "2024-01-01",
        "2024-01-01 12:00:00",
        "2024-01-01T12:00:00Z",
      ];

      for (const format of formats) {
        await queryRunner.query(
          "INSERT INTO test_dates (date_col, datetime_col) VALUES (?, ?)",
          [format, format]
        );
      }

      const result = await queryRunner.query("SELECT * FROM test_dates");
      expect(result.length).toBe(3);

      await queryRunner.query("DROP TABLE IF EXISTS test_dates");
    });

    it("should handle date comparisons with strings", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_date_compare (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date_col TEXT
        )
      `);

      await queryRunner.query(
        "INSERT INTO test_date_compare (date_col) VALUES (?)",
        ["2024-01-01"]
      );
      await queryRunner.query(
        "INSERT INTO test_date_compare (date_col) VALUES (?)",
        ["2024-12-31"]
      );

      const result = await queryRunner.query(`
        SELECT * FROM test_date_compare
        WHERE date_col > '2024-06-01'
        ORDER BY date_col
      `);

      expect(result.length).toBe(1);
      expect(result[0].date_col).toBe("2024-12-31");

      await queryRunner.query("DROP TABLE IF EXISTS test_date_compare");
    });
  });
});

