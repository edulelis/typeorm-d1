import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

describe("Concurrency Tests", () => {
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

  describe("Concurrent Reads", () => {
    it("should handle concurrent read operations", async () => {
      // Create test data
      await userRepository.save([
        { name: "User 1", email: "user1@example.com" },
        { name: "User 2", email: "user2@example.com" },
        { name: "User 3", email: "user3@example.com" },
      ]);

      // Run multiple concurrent reads
      const promises = Array.from({ length: 10 }, () =>
        userRepository.find()
      );

      const results = await Promise.all(promises);

      // All reads should return the same data
      results.forEach((result) => {
        expect(result.length).toBe(3);
      });
    });

    it("should handle concurrent findOne operations", async () => {
      const user = await userRepository.save({
        name: "Test User",
        email: "concurrent@example.com",
      });

      // Run multiple concurrent findOne operations
      const promises = Array.from({ length: 20 }, () =>
        userRepository.findOne({ where: { id: user.id } })
      );

      const results = await Promise.all(promises);

      // All should return the same user
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result?.id).toBe(user.id);
        expect(result?.email).toBe("concurrent@example.com");
      });
    });
  });

  describe("Concurrent Writes", () => {
    it("should handle concurrent insert operations", async () => {
      // Create multiple users concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        userRepository.save({
          name: `User ${i}`,
          email: `user${i}@example.com`,
        })
      );

      const results = await Promise.all(promises);

      // All should be saved successfully
      expect(results.length).toBe(10);
      results.forEach((user) => {
        expect(user.id).toBeDefined();
        expect(user.email).toBeDefined();
      });

      // Verify all users exist
      const allUsers = await userRepository.find();
      expect(allUsers.length).toBe(10);
    });

    it("should handle concurrent update operations", async () => {
      const user = await userRepository.save({
        name: "Original Name",
        email: "update-concurrent@example.com",
      });

      // Run multiple concurrent updates
      const promises = Array.from({ length: 5 }, (_, i) =>
        userRepository.update(user.id, {
          name: `Updated Name ${i}`,
        })
      );

      await Promise.all(promises);

      // Verify user was updated (last update wins)
      const updatedUser = await userRepository.findOne({
        where: { id: user.id },
      });
      expect(updatedUser).toBeDefined();
      // Note: In concurrent updates, the last one wins
      expect(updatedUser?.name).toContain("Updated Name");
    });
  });

  describe("Race Conditions", () => {
    it("should handle race condition in counter increment", async () => {
      // Create a user with a counter field (using age as counter)
      const user = await userRepository.save({
        name: "Counter User",
        email: "counter@example.com",
        age: 0,
      });

      // Simulate 50 concurrent increment operations
      // Note: This test documents that D1 doesn't support atomic increments
      // In a real scenario, you'd need to use application-level locking or
      // accept that some increments might be lost
      const incrementPromises = Array.from({ length: 50 }, async () => {
        // Use raw SQL for atomic increment to avoid race conditions in this test
        // In practice, you'd want to use UPDATE ... SET age = age + 1
        const queryRunner = dataSource.createQueryRunner();
        try {
          await queryRunner.query(
            "UPDATE users SET age = age + 1 WHERE id = ?",
            [user.id]
          );
        } finally {
          await queryRunner.release();
        }
      });

      await Promise.all(incrementPromises);

      // Verify final value (should be 50 with atomic operations)
      const finalUser = await userRepository.findOne({
        where: { id: user.id },
      });
      expect(finalUser?.age).toBe(50);
      // Note: Using atomic SQL operations prevents race conditions
      // For application-level increments, you'd need locking
    });

    it("should handle unique constraint violations in concurrent inserts", async () => {
      const email = "unique-concurrent@example.com";

      // Try to create multiple users with the same email concurrently
      const promises = Array.from({ length: 5 }, () =>
        userRepository.save({
          name: "Test User",
          email: email,
        }).catch((error: any) => error) // Catch errors to see which ones fail
      );

      const results = await Promise.all(promises);

      // Only one should succeed, others should fail with unique constraint error
      const successes = results.filter((r) => !(r instanceof Error));
      const failures = results.filter((r) => r instanceof Error);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);

      // Verify only one user exists
      const users = await userRepository.find({
        where: { email: email },
      });
      expect(users.length).toBe(1);
    });
  });

  describe("Transaction Concurrency", () => {
    it("should handle concurrent transactions", async () => {
      // Create multiple transactions concurrently
      const transactionPromises = Array.from({ length: 5 }, async (_, i) => {
        const queryRunner = dataSource.createQueryRunner();
        try {
          await queryRunner.startTransaction();

          const user = queryRunner.manager.create(User, {
            name: `User ${i}`,
            email: `user-tx-${i}@example.com`,
          });

          await queryRunner.manager.save(user);
          await queryRunner.commitTransaction();

          return user;
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw error;
        } finally {
          await queryRunner.release();
        }
      });

      const results = await Promise.all(transactionPromises);

      // All transactions should complete successfully
      expect(results.length).toBe(5);
      results.forEach((user) => {
        expect(user.id).toBeDefined();
      });

      // Verify all users exist
      const allUsers = await userRepository.find();
      expect(allUsers.length).toBeGreaterThanOrEqual(5);
    });
  });
});

