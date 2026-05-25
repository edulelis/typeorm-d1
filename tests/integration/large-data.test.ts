import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";
import { executeD1Batch } from "../../src/factory";

describe("Large Data Tests", () => {
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

  async function insertUsers(prefix: string, count: number): Promise<void> {
    const chunkSize = 100;
    const statements = Array.from({ length: count }, (_, i) => ({
      query: "INSERT INTO users (name, email) VALUES (?, ?)",
      parameters: [`User ${i}`, `${prefix}${i}@example.com`],
    }));

    for (let i = 0; i < statements.length; i += chunkSize) {
      await executeD1Batch(dataSource, statements.slice(i, i + chunkSize));
    }
  }

  describe("Large Text Data", () => {
    it("should handle large text in name field", async () => {
      // Create a large string (1MB)
      const largeText = "A".repeat(1024 * 1024); // 1MB of 'A's

      const user = userRepository.create({
        name: largeText,
        email: "large-text@example.com",
      });

      const savedUser = await userRepository.save(user);
      expect(savedUser.id).toBeDefined();
      expect(savedUser.name.length).toBe(1024 * 1024);
    });

    it("should handle large text in email field", async () => {
      // Create a large email (though emails are typically shorter)
      const largeEmail = "a".repeat(1000) + "@example.com";

      const user = userRepository.create({
        name: "Test User",
        email: largeEmail,
      });

      const savedUser = await userRepository.save(user);
      expect(savedUser.id).toBeDefined();
      expect(savedUser.email).toBe(largeEmail);
    });

    it("should retrieve large text data correctly", async () => {
      const largeText = "B".repeat(500 * 1024); // 500KB

      const user = await userRepository.save({
        name: largeText,
        email: "large-retrieve@example.com",
      });

      const retrievedUser = await userRepository.findOne({
        where: { id: user.id },
      });

      expect(retrievedUser).toBeDefined();
      expect(retrievedUser?.name.length).toBe(500 * 1024);
      expect(retrievedUser?.name).toBe(largeText);
    });
  });

  describe("Bulk Operations", () => {
    it("should handle bulk insert of many records", async () => {
      // Create 100 users
      const users = Array.from({ length: 100 }, (_, i) =>
        userRepository.create({
          name: `User ${i}`,
          email: `user${i}@example.com`,
        })
      );

      const savedUsers = await userRepository.save(users);
      expect(savedUsers.length).toBe(100);
      savedUsers.forEach((user: any) => {
        expect(user.id).toBeDefined();
      });
    });

    it("should handle bulk insert of records with large data", async () => {
      const largeText = "C".repeat(10 * 1024); // 10KB per user

      const users = Array.from({ length: 50 }, (_, i) =>
        userRepository.create({
          name: largeText + ` User ${i}`,
          email: `bulk${i}@example.com`,
        })
      );

      const savedUsers = await userRepository.save(users);
      expect(savedUsers.length).toBe(50);
    });

    it("should handle querying large result sets", async () => {
      // Create many users
      const users = Array.from({ length: 200 }, (_, i) =>
        userRepository.create({
          name: `User ${i}`,
          email: `query${i}@example.com`,
        })
      );

      await userRepository.save(users);

      // Query all users
      const allUsers = await userRepository.find();
      expect(allUsers.length).toBe(200);
    });
  });

  describe("Performance with Large Data", () => {
    it("should handle findOne efficiently with large dataset", async () => {
      await insertUsers("perf", 1000);

      // Find a specific user (should use index on email)
      const startTime = Date.now();
      const user = await userRepository.findOne({
        where: { email: "perf500@example.com" },
      });
      const endTime = Date.now();

      expect(user).toBeDefined();
      expect(user?.email).toBe("perf500@example.com");
      // Should be reasonably fast even with 1000 records
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });

    it("should handle pagination with large dataset", async () => {
      await insertUsers("page", 500);

      // Test pagination
      const page1 = await userRepository.find({
        take: 10,
        skip: 0,
      });

      const page2 = await userRepository.find({
        take: 10,
        skip: 10,
      });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(10);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });
});
