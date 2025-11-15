import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

// Helper to get all entities with relations
function getAllEntities() {
  return [User, Post, Profile, Tag];
}

describe("Complex Queries Tests", () => {
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

  describe("Multiple JOINs", () => {
    beforeEach(async () => {
      // Create test data
      const user1 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["John Doe", "john@example.com", 1]
      );
      const user1Id = user1;

      const user2 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Jane Doe", "jane@example.com", 1]
      );
      const user2Id = user2;

      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content 1", user1Id]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 2", "Content 2", user2Id]
      );
    });

    it("should handle multiple LEFT JOINs", async () => {
      const result = await queryRunner.query(`
        SELECT 
          u.id as userId,
          u.name as userName,
          p.id as postId,
          p.title as postTitle
        FROM users u
        LEFT JOIN posts p ON p.authorId = u.id
        ORDER BY u.id, p.id
      `);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("userId");
      expect(result[0]).toHaveProperty("userName");
      expect(result[0]).toHaveProperty("postId");
      expect(result[0]).toHaveProperty("postTitle");
    });

    it("should handle INNER JOIN with multiple tables", async () => {
      const result = await queryRunner.query(`
        SELECT 
          u.name as userName,
          p.title as postTitle
        FROM users u
        INNER JOIN posts p ON p.authorId = u.id
        WHERE u.active = 1
      `);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("userName");
      expect(result[0]).toHaveProperty("postTitle");
    });

    it("should handle three-way JOIN", async () => {
      // Create profile data
      const userId = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Test User", "test@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO profiles (bio, userId) VALUES (?, ?)",
        ["Test bio", userId]
      );

      const result = await queryRunner.query(`
        SELECT 
          u.name as userName,
          p.title as postTitle,
          pr.bio as profileBio
        FROM users u
        LEFT JOIN posts p ON p.authorId = u.id
        LEFT JOIN profiles pr ON pr.userId = u.id
        WHERE u.id = ?
      `, [userId]);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Subqueries", () => {
    beforeEach(async () => {
      // Create test data
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["John Doe", "john@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Jane Doe", "jane@example.com", 1, 25]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Bob Smith", "bob@example.com", 1, 35]
      );
    });

    it("should handle scalar subquery in SELECT", async () => {
      const result = await queryRunner.query(`
        SELECT 
          name,
          age,
          (SELECT AVG(age) FROM users) as avgAge
        FROM users
        WHERE age > (SELECT AVG(age) FROM users)
      `);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("age");
      expect(result[0]).toHaveProperty("avgAge");
      expect(typeof result[0].avgAge).toBe("number");
    });

    it("should handle subquery in WHERE clause", async () => {
      const result = await queryRunner.query(`
        SELECT name, age
        FROM users
        WHERE age > (SELECT AVG(age) FROM users)
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.age).toBeGreaterThan(25); // Average should be around 30
      });
    });

    it("should handle subquery in FROM clause (derived table)", async () => {
      const result = await queryRunner.query(`
        SELECT 
          sub.name,
          sub.age
        FROM (
          SELECT name, age 
          FROM users 
          WHERE active = 1
        ) AS sub
        WHERE sub.age > 25
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.age).toBeGreaterThan(25);
      });
    });

    it("should handle correlated subquery", async () => {
      const userId = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author", "author@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content", userId]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 2", "Content", userId]
      );

      const result = await queryRunner.query(`
        SELECT 
          u.name,
          (SELECT COUNT(*) FROM posts p WHERE p.authorId = u.id) as postCount
        FROM users u
        WHERE u.id = ?
      `, [userId]);

      expect(result.length).toBe(1);
      expect(result[0].postCount).toBe(2);
    });

    it("should handle EXISTS subquery", async () => {
      const userId = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author", "author@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content", userId]
      );

      const result = await queryRunner.query(`
        SELECT name, email
        FROM users u
        WHERE EXISTS (SELECT 1 FROM posts p WHERE p.authorId = u.id)
      `);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("email");
    });

    it("should handle IN subquery", async () => {
      const userId = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author", "author@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content", userId]
      );

      const result = await queryRunner.query(`
        SELECT name, email
        FROM users
        WHERE id IN (SELECT DISTINCT authorId FROM posts WHERE authorId IS NOT NULL)
      `);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Common Table Expressions (CTEs)", () => {
    beforeEach(async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["John Doe", "john@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Jane Doe", "jane@example.com", 1, 25]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["Bob Smith", "bob@example.com", 1, 35]
      );
    });

    it("should handle simple CTE (WITH clause)", async () => {
      const result = await queryRunner.query(`
        WITH active_users AS (
          SELECT id, name, email, age
          FROM users
          WHERE active = 1
        )
        SELECT name, age
        FROM active_users
        WHERE age > 25
        ORDER BY age DESC
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.age).toBeGreaterThan(25);
      });
    });

    it("should handle multiple CTEs", async () => {
      const result = await queryRunner.query(`
        WITH 
          active_users AS (
            SELECT id, name, age
            FROM users
            WHERE active = 1
          ),
          older_users AS (
            SELECT id, name, age
            FROM active_users
            WHERE age > 25
          )
        SELECT name, age
        FROM older_users
        ORDER BY age DESC
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.age).toBeGreaterThan(25);
      });
    });

    it("should handle recursive CTE (if D1 supports)", async () => {
      // SQLite supports recursive CTEs, but D1 may have limitations
      // Test basic recursive pattern
      try {
        const result = await queryRunner.query(`
          WITH RECURSIVE numbers(n) AS (
            SELECT 1
            UNION ALL
            SELECT n + 1 FROM numbers WHERE n < 5
          )
          SELECT n FROM numbers
        `);

        expect(result.length).toBe(5);
        expect(result[0].n).toBe(1);
        expect(result[4].n).toBe(5);
      } catch (error) {
        // If recursive CTEs are not supported, document it
        expect((error as Error).message).toContain("recursive");
      }
    });
  });

  describe("UNION Queries", () => {
    beforeEach(async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["John Doe", "john@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Jane Doe", "jane@example.com", 1]
      );
    });

    it("should handle UNION query", async () => {
      const result = await queryRunner.query(`
        SELECT name, email FROM users WHERE name LIKE 'John%'
        UNION
        SELECT name, email FROM users WHERE name LIKE 'Jane%'
      `);

      expect(result.length).toBe(2);
      const names = result.map((r: any) => r.name);
      expect(names).toContain("John Doe");
      expect(names).toContain("Jane Doe");
    });

    it("should handle UNION ALL query", async () => {
      // UNION ALL allows duplicates
      const result = await queryRunner.query(`
        SELECT name, email FROM users WHERE active = 1
        UNION ALL
        SELECT name, email FROM users WHERE active = 1
      `);

      expect(result.length).toBe(4); // 2 users × 2 = 4 rows
    });

    it("should handle UNION with different column types", async () => {
      const result = await queryRunner.query(`
        SELECT name as value, 'user' as type FROM users
        UNION
        SELECT title as value, 'post' as type FROM posts
      `);

      // Should work even if posts table is empty
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("HAVING Clauses", () => {
    beforeEach(async () => {
      // Create test data with various ages
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 1", "user1@example.com", 1, 20]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 2", "user2@example.com", 1, 25]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 3", "user3@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 4", "user4@example.com", 1, 35]
      );
    });

    it("should filter groups with HAVING", async () => {
      const result = await queryRunner.query(`
        SELECT 
          CASE 
            WHEN age < 25 THEN 'Young'
            WHEN age < 30 THEN 'Adult'
            ELSE 'Senior'
          END as ageGroup,
          COUNT(*) as count
        FROM users
        GROUP BY ageGroup
        HAVING COUNT(*) > 1
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.count).toBeGreaterThan(1);
      });
    });

    it("should use HAVING with aggregate functions", async () => {
      const result = await queryRunner.query(`
        SELECT 
          active,
          COUNT(*) as userCount,
          AVG(age) as avgAge
        FROM users
        GROUP BY active
        HAVING AVG(age) > 25
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.avgAge).toBeGreaterThan(25);
      });
    });

    it("should combine WHERE and HAVING", async () => {
      const result = await queryRunner.query(`
        SELECT 
          active,
          COUNT(*) as count,
          AVG(age) as avgAge
        FROM users
        WHERE age >= 20
        GROUP BY active
        HAVING COUNT(*) >= 2
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.count).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("NULL Handling in Complex Queries", () => {
    beforeEach(async () => {
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 1", "user1@example.com", 1, 30]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 2", "user2@example.com", 1, null]
      );
      await queryRunner.query(
        "INSERT INTO users (name, email, active, age, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
        ["User 3", "user3@example.com", 1, 25]
      );
    });

    it("should handle NULL in WHERE clauses", async () => {
      const result = await queryRunner.query(`
        SELECT name, age
        FROM users
        WHERE age IS NULL
      `);

      expect(result.length).toBe(1);
      expect(result[0].age).toBeNull();
    });

    it("should handle NULL in JOINs", async () => {
      const userId1 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author 1", "author1@example.com", 1]
      );
      const userId2 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author 2", "author2@example.com", 1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content", userId1]
      );
      // User 2 has no posts, so LEFT JOIN will show NULL for postTitle
      const result = await queryRunner.query(`
        SELECT 
          u.name as userName,
          p.title as postTitle
        FROM users u
        LEFT JOIN posts p ON p.authorId = u.id
        WHERE u.id IN (?, ?)
        ORDER BY u.id, p.id
      `, [userId1, userId2]);

      expect(result.length).toBeGreaterThan(0);
      // Should have at least one row with NULL postTitle (user with no posts)
      const nullPostTitle = result.find((r: any) => r.postTitle === null);
      expect(nullPostTitle).toBeDefined();
    });

    it("should handle NULL in aggregations", async () => {
      const result = await queryRunner.query(`
        SELECT 
          COUNT(*) as totalCount,
          COUNT(age) as ageCount,
          AVG(age) as avgAge
        FROM users
      `);

      expect(result.length).toBe(1);
      expect(result[0].totalCount).toBeGreaterThan(result[0].ageCount); // Some ages are NULL
      expect(result[0].avgAge).toBeGreaterThan(0);
    });

    it("should handle NULL in subqueries", async () => {
      const result = await queryRunner.query(`
        SELECT 
          name,
          age,
          (SELECT AVG(age) FROM users WHERE age IS NOT NULL) as avgAge
        FROM users
        WHERE age IS NOT NULL
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.age).not.toBeNull();
        expect(row.avgAge).not.toBeNull();
      });
    });

    it("should handle COALESCE with NULL", async () => {
      const result = await queryRunner.query(`
        SELECT 
          name,
          COALESCE(age, 0) as ageOrZero
        FROM users
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.ageOrZero).not.toBeNull();
        expect(typeof row.ageOrZero).toBe("number");
      });
    });
  });

  describe("Nested Aggregations", () => {
    beforeEach(async () => {
      const userId1 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author 1", "author1@example.com", 1]
      );
      const userId2 = await queryRunner.query(
        "INSERT INTO users (name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
        ["Author 2", "author2@example.com", 1]
      );

      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 1", "Content", userId1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 2", "Content", userId1]
      );
      await queryRunner.query(
        "INSERT INTO posts (title, content, authorId, createdAt) VALUES (?, ?, ?, datetime('now'))",
        ["Post 3", "Content", userId2]
      );
    });

    it("should handle nested aggregate functions", async () => {
      const result = await queryRunner.query(`
        SELECT 
          u.name,
          COUNT(p.id) as postCount,
          (SELECT AVG(postCount) FROM (
            SELECT COUNT(*) as postCount 
            FROM posts 
            GROUP BY authorId
          )) as avgPostsPerAuthor
        FROM users u
        LEFT JOIN posts p ON p.authorId = u.id
        GROUP BY u.id, u.name
      `);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((row: any) => {
        expect(row.postCount).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

