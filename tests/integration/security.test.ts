import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

describe("Security Tests", () => {
  let dataSource: DataSource;
  let userRepository: any;

  beforeAll(async () => {
    // Include all related entities to avoid relation metadata errors
    dataSource = await createTestDataSource([User, Post, Profile, Tag]);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
  });

  afterAll(async () => {
    await cleanupDataSource(dataSource);
    await cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean up users before each test
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.query("DELETE FROM users");
    } finally {
      await queryRunner.release();
    }
  });

  describe("SQL Injection Protection", () => {
    it("should prevent SQL injection in email field", async () => {
      // Attempt SQL injection in email
      const maliciousEmail = "'; DROP TABLE users; --";
      
      // This should be safely parameterized and not execute DROP TABLE
      const user = userRepository.create({
        name: "Test User",
        email: maliciousEmail,
      });

      await userRepository.save(user);

      // Verify table still exists
      const queryRunner = dataSource.createQueryRunner();
      try {
        const result = await queryRunner.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        );
        expect(result.length).toBe(1);
        expect(result[0].name).toBe("users");
      } finally {
        await queryRunner.release();
      }

      // Verify the malicious string was stored as data, not executed
      const savedUser = await userRepository.findOne({
        where: { email: maliciousEmail },
      });
      expect(savedUser).toBeDefined();
      expect(savedUser?.email).toBe(maliciousEmail);
    });

    it("should prevent SQL injection in name field", async () => {
      const maliciousName = "'; DELETE FROM users WHERE '1'='1";
      
      const user = userRepository.create({
        name: maliciousName,
        email: "test@example.com",
      });

      await userRepository.save(user);

      // Verify other users still exist (if any)
      const users = await userRepository.find();
      expect(users.length).toBeGreaterThan(0);

      // Verify the malicious string was stored as data
      const savedUser = await userRepository.findOne({
        where: { email: "test@example.com" },
      });
      expect(savedUser?.name).toBe(maliciousName);
    });

    it("should safely handle special characters in queries", async () => {
      const specialChars = "test'user\"with;special--chars";
      
      const user = userRepository.create({
        name: "Test User",
        email: specialChars,
      });

      await userRepository.save(user);

      const savedUser = await userRepository.findOne({
        where: { email: specialChars },
      });
      expect(savedUser).toBeDefined();
      expect(savedUser?.email).toBe(specialChars);
    });

    it("should prevent SQL injection via query builder", async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      // Use query builder with parameterized query
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.email = :email", { email: maliciousInput })
        .getMany();

      // Verify table still exists
      const queryRunner = dataSource.createQueryRunner();
      try {
        const result = await queryRunner.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        );
        expect(result.length).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });

    it("should safely handle raw queries with parameters", async () => {
      const queryRunner = dataSource.createQueryRunner();
      try {
        const maliciousInput = "'; DROP TABLE users; --";
        
        // Use parameterized query
        const result = await queryRunner.query(
          "SELECT * FROM users WHERE email = ?",
          [maliciousInput]
        );

        // Verify table still exists
        const tableCheck = await queryRunner.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        );
        expect(tableCheck.length).toBe(1);
      } finally {
        await queryRunner.release();
      }
    });
  });

  describe("Parameter Binding", () => {
    it("should properly bind parameters in INSERT", async () => {
      const user = userRepository.create({
        name: "Test User",
        email: "test@example.com",
      });

      await userRepository.save(user);

      const savedUser = await userRepository.findOne({
        where: { email: "test@example.com" },
      });
      expect(savedUser).toBeDefined();
      expect(savedUser?.name).toBe("Test User");
    });

    it("should properly bind parameters in UPDATE", async () => {
      const user = await userRepository.save({
        name: "Original Name",
        email: "update@example.com",
      });

      await userRepository.update(user.id, {
        name: "Updated Name",
      });

      const updatedUser = await userRepository.findOne({
        where: { id: user.id },
      });
      expect(updatedUser?.name).toBe("Updated Name");
    });

    it("should properly bind parameters in DELETE", async () => {
      const user = await userRepository.save({
        name: "To Delete",
        email: "delete@example.com",
      });

      await userRepository.delete(user.id);

      const deletedUser = await userRepository.findOne({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();
    });
  });
});

