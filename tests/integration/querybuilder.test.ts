import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

describe("QueryBuilder Tests", () => {
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
    // Clean up users before each test using raw SQL
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.query("DELETE FROM users");
    } finally {
      await queryRunner.release();
    }
  });

  describe("Basic Queries", () => {
    beforeEach(async () => {
      await userRepository.save([
        { name: "John Doe", email: "john@example.com", age: 30 },
        { name: "Jane Doe", email: "jane@example.com", age: 25 },
        { name: "Bob Smith", email: "bob@example.com", age: 35 },
      ]);
    });

    it("should select all columns", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .getMany();

      expect(users.length).toBe(3);
      expect(users[0].id).toBeDefined();
      expect(users[0].name).toBeDefined();
      expect(users[0].email).toBeDefined();
    });

    it("should select specific columns", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .select(["user.id", "user.name"])
        .getMany();

      expect(users.length).toBe(3);
      expect(users[0].id).toBeDefined();
      expect(users[0].name).toBeDefined();
    });

    it("should select with aliases", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .select("user.name", "userName")
        .getRawMany();

      expect(users.length).toBe(3);
      expect(users[0].userName).toBeDefined();
    });
  });

  describe("Where Conditions", () => {
    beforeEach(async () => {
      await userRepository.save([
        { name: "John Doe", email: "john@example.com", age: 30, active: true },
        { name: "Jane Doe", email: "jane@example.com", age: 25, active: false },
        { name: "Bob Smith", email: "bob@example.com", age: 35, active: true },
      ]);
    });

    it("should filter with equality", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.email = :email", { email: "john@example.com" })
        .getMany();

      expect(users.length).toBe(1);
      expect(users[0].email).toBe("john@example.com");
    });

    it("should filter with inequality", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.age > :age", { age: 30 })
        .getMany();

      expect(users.length).toBe(1);
      expect(users[0].age).toBeGreaterThan(30);
    });

    it("should filter with IN clause", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.email IN (:...emails)", { emails: ["john@example.com", "jane@example.com"] })
        .getMany();

      expect(users.length).toBe(2);
    });

    it("should filter with LIKE", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.email LIKE :pattern", { pattern: "%@example.com" })
        .getMany();

      expect(users.length).toBe(3);
    });

    it("should filter with BETWEEN", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.age BETWEEN :min AND :max", { min: 25, max: 30 })
        .getMany();

      expect(users.length).toBe(2);
    });

    it("should filter with IS NULL", async () => {
      await userRepository.save({
        name: "Null Age",
        email: "null@example.com",
        age: null,
      });

      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.age IS NULL")
        .getMany();

      expect(users.length).toBe(1);
      expect(users[0].age).toBeNull();
    });

    it("should filter with AND", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.age > :age", { age: 25 })
        .andWhere("user.active = :active", { active: true })
        .getMany();

      expect(users.length).toBe(2);
      expect(users.every((u: User) => u.age! > 25 && u.active)).toBe(true);
    });

    it("should filter with OR", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .where("user.age < :age1", { age1: 26 })
        .orWhere("user.age > :age2", { age2: 34 })
        .getMany();

      expect(users.length).toBe(2);
    });
  });

  describe("Sorting and Pagination", () => {
    beforeEach(async () => {
      await userRepository.save([
        { name: "John Doe", email: "john@example.com", age: 30 },
        { name: "Jane Doe", email: "jane@example.com", age: 25 },
        { name: "Bob Smith", email: "bob@example.com", age: 35 },
      ]);
    });

    it("should order by single column ASC", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .orderBy("user.age", "ASC")
        .getMany();

      expect(users.length).toBe(3);
      expect(users[0].age).toBe(25);
      expect(users[2].age).toBe(35);
    });

    it("should order by single column DESC", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .orderBy("user.age", "DESC")
        .getMany();

      expect(users.length).toBe(3);
      expect(users[0].age).toBe(35);
      expect(users[2].age).toBe(25);
    });

    it("should order by multiple columns", async () => {
      await userRepository.save([
        { name: "Alice", email: "alice1@example.com", age: 30 },
        { name: "Alice", email: "alice2@example.com", age: 30 },
      ]);

      const users = await userRepository
        .createQueryBuilder("user")
        .orderBy("user.age", "ASC")
        .addOrderBy("user.name", "ASC")
        .getMany();

      expect(users.length).toBeGreaterThan(3);
    });

    it("should limit results", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .limit(2)
        .getMany();

      expect(users.length).toBe(2);
    });

    it("should offset results", async () => {
      const users = await userRepository
        .createQueryBuilder("user")
        .orderBy("user.id", "ASC")
        .skip(1)
        .take(2)
        .getMany();

      expect(users.length).toBe(2);
    });
  });

  describe("Aggregations", () => {
    beforeEach(async () => {
      await userRepository.save([
        { name: "John Doe", email: "john@example.com", age: 30 },
        { name: "Jane Doe", email: "jane@example.com", age: 25 },
        { name: "Bob Smith", email: "bob@example.com", age: 35 },
      ]);
    });

    it("should count records", async () => {
      const count = await userRepository
        .createQueryBuilder("user")
        .getCount();

      expect(count).toBe(3);
    });

    it("should calculate sum", async () => {
      const result = await userRepository
        .createQueryBuilder("user")
        .select("SUM(user.age)", "totalAge")
        .getRawOne();

      expect(result.totalAge).toBe(90);
    });

    it("should calculate average", async () => {
      const result = await userRepository
        .createQueryBuilder("user")
        .select("AVG(user.age)", "avgAge")
        .getRawOne();

      expect(result.avgAge).toBe(30);
    });

    it("should find minimum", async () => {
      const result = await userRepository
        .createQueryBuilder("user")
        .select("MIN(user.age)", "minAge")
        .getRawOne();

      expect(result.minAge).toBe(25);
    });

    it("should find maximum", async () => {
      const result = await userRepository
        .createQueryBuilder("user")
        .select("MAX(user.age)", "maxAge")
        .getRawOne();

      expect(result.maxAge).toBe(35);
    });
  });

  describe("Updates and Deletes", () => {
    beforeEach(async () => {
      await userRepository.save([
        { name: "John Doe", email: "john@example.com", age: 30 },
        { name: "Jane Doe", email: "jane@example.com", age: 25 },
      ]);
    });

    it("should update with QueryBuilder", async () => {
      await userRepository
        .createQueryBuilder()
        .update(User)
        .set({ age: 40 })
        .where("email = :email", { email: "john@example.com" })
        .execute();

      const user = await userRepository.findOne({ where: { email: "john@example.com" } });
      expect(user?.age).toBe(40);
    });

    it("should delete with QueryBuilder", async () => {
      await userRepository
        .createQueryBuilder()
        .delete()
        .from(User)
        .where("email = :email", { email: "john@example.com" })
        .execute();

      const user = await userRepository.findOne({ where: { email: "john@example.com" } });
      expect(user).toBeNull();
    });
  });
});

