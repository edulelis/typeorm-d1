import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

// Helper to get all entities with relations
function getAllEntities() {
  return [User, Post, Profile, Tag];
}

describe("Advanced DML Operations Tests", () => {
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
    // Clean up all tables
    await queryRunner.query("DELETE FROM post_tags");
    await queryRunner.query("DELETE FROM posts");
    await queryRunner.query("DELETE FROM tags");
    await queryRunner.query("DELETE FROM profiles");
    await queryRunner.query("DELETE FROM users");
  });

  describe("INSERT ... SELECT", () => {
    beforeEach(async () => {
      // Create source data
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["John Doe", "john@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Jane Doe", "jane@example.com", 1, 25]
      );
    });

    it("should insert data from SELECT query", async () => {
      // Create a temporary table for testing
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS users_backup (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          active INTEGER NOT NULL,
          age INTEGER
        )
      `);

      const result = await queryRunner.query(`
        INSERT INTO users_backup (name, email, active, age)
        SELECT name, email, active, age
        FROM users
        WHERE active = 1
      `);

      // Verify data was inserted
      const backupData = await queryRunner.query("SELECT * FROM users_backup");
      expect(backupData.length).toBe(2);
      expect(backupData[0].name).toBe("John Doe");
      expect(backupData[1].name).toBe("Jane Doe");

      // Cleanup
      await queryRunner.query("DROP TABLE IF EXISTS users_backup");
    });

    it("should insert with calculated values in SELECT", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS user_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userName TEXT NOT NULL,
          userEmail TEXT NOT NULL,
          agePlusTen INTEGER
        )
      `);

      await queryRunner.query(`
        INSERT INTO user_stats (userName, userEmail, agePlusTen)
        SELECT name, email, age + 10
        FROM users
        WHERE age IS NOT NULL
      `);

      const stats = await queryRunner.query("SELECT * FROM user_stats");
      expect(stats.length).toBe(2);
      expect(stats[0].agePlusTen).toBe(40); // 30 + 10
      expect(stats[1].agePlusTen).toBe(35); // 25 + 10

      await queryRunner.query("DROP TABLE IF EXISTS user_stats");
    });
  });

  describe("INSERT ... ON CONFLICT (Upsert)", () => {
    beforeEach(async () => {
      // Create table with unique constraint
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_upsert (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          score INTEGER DEFAULT 0
        )
      `);

      // Insert initial data
      await queryRunner.query(
        "INSERT INTO test_upsert (email, name, score) VALUES (?, ?, ?)",
        ["test@example.com", "Test User", 10]
      );
    });

    afterEach(async () => {
      await queryRunner.query("DROP TABLE IF EXISTS test_upsert");
    });

    it("should handle INSERT ... ON CONFLICT DO NOTHING", async () => {
      // Try to insert duplicate email
      await queryRunner.query(`
        INSERT INTO test_upsert (email, name, score)
        VALUES ('test@example.com', 'Another User', 20)
        ON CONFLICT(email) DO NOTHING
      `);

      const result = await queryRunner.query("SELECT * FROM test_upsert WHERE email = 'test@example.com'");
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Test User"); // Original value preserved
      expect(result[0].score).toBe(10);
    });

    it("should handle INSERT ... ON CONFLICT DO UPDATE", async () => {
      // Upsert with update
      await queryRunner.query(`
        INSERT INTO test_upsert (email, name, score)
        VALUES ('test@example.com', 'Updated User', 30)
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          score = excluded.score
      `);

      const result = await queryRunner.query("SELECT * FROM test_upsert WHERE email = 'test@example.com'");
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Updated User"); // Updated
      expect(result[0].score).toBe(30); // Updated
    });

    it("should handle INSERT ... ON CONFLICT with partial update", async () => {
      // Update only score, keep name
      await queryRunner.query(`
        INSERT INTO test_upsert (email, name, score)
        VALUES ('test@example.com', 'New Name', 50)
        ON CONFLICT(email) DO UPDATE SET
          score = excluded.score
      `);

      const result = await queryRunner.query("SELECT * FROM test_upsert WHERE email = 'test@example.com'");
      expect(result.length).toBe(1);
      expect(result[0].name).toBe("Test User"); // Original name preserved
      expect(result[0].score).toBe(50); // Score updated
    });
  });

  describe("UPDATE with Expressions", () => {
    beforeEach(async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["John Doe", "john@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Jane Doe", "jane@example.com", 1, 25]
      );
    });

    it("should update with arithmetic expressions", async () => {
      await queryRunner.query(`
        UPDATE users
        SET age = age + 1
        WHERE name = 'John Doe'
      `);

      const result = await queryRunner.query("SELECT age FROM users WHERE name = 'John Doe'");
      expect(result.length).toBe(1);
      expect(result[0].age).toBe(31);
    });

    it("should update with CASE expressions", async () => {
      await queryRunner.query(`
        UPDATE users
        SET age = CASE
          WHEN age < 30 THEN age + 5
          ELSE age + 1
        END
      `);

      const john = await queryRunner.query("SELECT age FROM users WHERE name = 'John Doe'");
      const jane = await queryRunner.query("SELECT age FROM users WHERE name = 'Jane Doe'");
      
      expect(john[0].age).toBe(31); // 30 + 1
      expect(jane[0].age).toBe(30); // 25 + 5
    });

    it("should update with string concatenation", async () => {
      await queryRunner.query(`
        UPDATE users
        SET name = name || ' (Updated)'
        WHERE name = 'John Doe'
      `);

      const result = await queryRunner.query("SELECT name FROM users WHERE name LIKE '%John Doe%'");
      expect(result.length).toBe(1);
      expect(result[0].name).toContain("John Doe");
      expect(result[0].name).toContain("Updated");
    });

    it("should update with COALESCE", async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Null Age", "nullage@example.com", 1, null]
      );

      await queryRunner.query(`
        UPDATE users
        SET age = COALESCE(age, 0) + 10
        WHERE age IS NULL
      `);

      const result = await queryRunner.query("SELECT age FROM users WHERE name = 'Null Age'");
      expect(result.length).toBe(1);
      expect(result[0].age).toBe(10); // NULL coalesced to 0, then + 10
    });

    it("should update multiple columns with expressions", async () => {
      await queryRunner.query(`
        UPDATE users
        SET 
          age = age * 2,
          name = UPPER(name)
        WHERE name = 'Jane Doe'
      `);

      const result = await queryRunner.query("SELECT name, age FROM users WHERE name = 'JANE DOE'");
      expect(result.length).toBe(1);
      expect(result[0].age).toBe(50); // 25 * 2
      expect(result[0].name).toBe("JANE DOE");
    });
  });

  describe("Bulk INSERT Operations", () => {
    it("should handle large batch insert", async () => {
      const users = [];
      for (let i = 0; i < 100; i++) {
        users.push([`User ${i}`, `user${i}@example.com`, 1, 20 + i]);
      }

      // Insert in batches
      for (const [name, email, active, age] of users) {
        await queryRunner.query(
          "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
          [name, email, active, age]
        );
      }

      const count = await queryRunner.query("SELECT COUNT(*) as count FROM users");
      expect(count[0].count).toBe(100);
    });

    it("should handle bulk insert with transaction", async () => {
      await queryRunner.startTransaction();
      try {
        for (let i = 0; i < 50; i++) {
          await queryRunner.query(
            "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
            [`Bulk User ${i}`, `bulk${i}@example.com`, 1, 20 + i]
          );
        }
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      }

      const count = await queryRunner.query("SELECT COUNT(*) as count FROM users WHERE name LIKE 'Bulk User%'");
      expect(count[0].count).toBe(50);
    });
  });

  describe("Batch Updates", () => {
    beforeEach(async () => {
      // Create test data
      for (let i = 0; i < 10; i++) {
        await queryRunner.query(
          "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
          [`User ${i}`, `user${i}@example.com`, 1, 20 + i]
        );
      }
    });

    it("should update multiple rows with different values", async () => {
      // Update each user's age
      for (let i = 0; i < 10; i++) {
        await queryRunner.query(
          "UPDATE users SET age = ? WHERE email = ?",
          [30 + i, `user${i}@example.com`]
        );
      }

      const result = await queryRunner.query("SELECT age FROM users WHERE email = 'user5@example.com'");
      expect(result[0].age).toBe(35);
    });

    it("should batch update with CASE expression", async () => {
      await queryRunner.query(`
        UPDATE users
        SET age = CASE
          WHEN age < 25 THEN age + 10
          WHEN age < 30 THEN age + 5
          ELSE age
        END
      `);

      const result = await queryRunner.query("SELECT age FROM users ORDER BY age");
      expect(result.length).toBe(10);
      // All ages should be >= 25 after update
      result.forEach((row: any) => {
        expect(row.age).toBeGreaterThanOrEqual(25);
      });
    });
  });
});

