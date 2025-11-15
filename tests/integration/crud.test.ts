import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

describe("CRUD Operations", () => {
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

  describe("Create (Insert)", () => {
    it("should insert a single entity", async () => {
      const user = userRepository.create({
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        active: true,
      });

      const savedUser = await userRepository.save(user);

      expect(savedUser.id).toBeDefined();
      expect(savedUser.name).toBe("John Doe");
      expect(savedUser.email).toBe("john@example.com");
      expect(savedUser.age).toBe(30);
      expect(savedUser.active).toBe(true);
    });

    it("should insert entity with auto-generated ID", async () => {
      const user = userRepository.create({
        name: "Jane Doe",
        email: "jane@example.com",
      });

      const savedUser = await userRepository.save(user);

      expect(savedUser.id).toBeGreaterThan(0);
      expect(typeof savedUser.id).toBe("number");
    });

    it("should insert entity with default values", async () => {
      const user = userRepository.create({
        name: "Bob Smith",
        email: "bob@example.com",
      });

      const savedUser = await userRepository.save(user);

      expect(savedUser.active).toBe(true); // default value
    });

    it("should insert entity with null values", async () => {
      const user = userRepository.create({
        name: "Alice Johnson",
        email: "alice@example.com",
        age: null,
      });

      const savedUser = await userRepository.save(user);

      expect(savedUser.age).toBeNull();
    });

    it("should insert multiple entities", async () => {
      const users = [
        userRepository.create({ name: "User 1", email: "user1@example.com" }),
        userRepository.create({ name: "User 2", email: "user2@example.com" }),
        userRepository.create({ name: "User 3", email: "user3@example.com" }),
      ];

      const savedUsers = await userRepository.save(users);

      expect(savedUsers.length).toBe(3);
      expect(savedUsers[0].id).toBeDefined();
      expect(savedUsers[1].id).toBeDefined();
      expect(savedUsers[2].id).toBeDefined();
    });
  });

  describe("Read (Select)", () => {
    beforeEach(async () => {
      // Create test data
      await userRepository.save([
        { name: "John Doe", email: "john@example.com", age: 30 },
        { name: "Jane Doe", email: "jane@example.com", age: 25 },
        { name: "Bob Smith", email: "bob@example.com", age: 35 },
      ]);
    });

    it("should find all entities", async () => {
      const users = await userRepository.find();

      expect(users.length).toBe(3);
      expect(users[0].name).toBeDefined();
      expect(users[0].email).toBeDefined();
    });

    it("should find one by ID", async () => {
      // First, create a user to get a valid ID
      const savedUser = await userRepository.save({
        name: "John Doe",
        email: "john-id-test@example.com",
      });

      const user = await userRepository.findOne({ where: { id: savedUser.id } });

      expect(user).toBeDefined();
      expect(user?.id).toBe(savedUser.id);
      expect(user?.name).toBe("John Doe");
    });

    it("should find one by condition", async () => {
      const user = await userRepository.findOne({
        where: { email: "jane@example.com" },
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe("jane@example.com");
    });

    it("should find entities with where conditions", async () => {
      const users = await userRepository.find({
        where: { age: 30 },
      });

      expect(users.length).toBe(1);
      expect(users[0].age).toBe(30);
    });

    it("should find entities with order by", async () => {
      const users = await userRepository.find({
        order: { age: "ASC" },
      });

      expect(users.length).toBe(3);
      expect(users[0].age).toBe(25);
      expect(users[2].age).toBe(35);
    });

    it("should find entities with limit and offset", async () => {
      const users = await userRepository.find({
        take: 2,
        skip: 1,
      });

      expect(users.length).toBe(2);
    });

    it("should use findOneBy method", async () => {
      const user = await userRepository.findOneBy({ email: "john@example.com" });

      expect(user).toBeDefined();
      expect(user?.email).toBe("john@example.com");
    });

    it("should use findBy method", async () => {
      const users = await userRepository.findBy({ active: true });

      expect(users.length).toBeGreaterThan(0);
      expect(users.every((u: User) => u.active)).toBe(true);
    });
  });

  describe("Update", () => {
    let user: User;

    beforeEach(async () => {
      user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      });
    });

    it("should update single entity", async () => {
      user.name = "Jane Doe";
      const updatedUser = await userRepository.save(user);

      expect(updatedUser.name).toBe("Jane Doe");
      expect(updatedUser.id).toBe(user.id);
    });

    it("should update entity with save method", async () => {
      user.age = 35;
      const updatedUser = await userRepository.save(user);

      expect(updatedUser.age).toBe(35);
    });

    it("should update entity with update method", async () => {
      await userRepository.update(user.id, { name: "Bob Smith" });

      const updatedUser = await userRepository.findOne({ where: { id: user.id } });

      expect(updatedUser?.name).toBe("Bob Smith");
    });

    it("should update multiple entities", async () => {
      await userRepository.update({ active: true }, { active: false });

      const users = await userRepository.findBy({ active: false });
      expect(users.length).toBeGreaterThan(0);
    });

    it("should update with conditions", async () => {
      await userRepository.update(
        { email: "john@example.com" },
        { age: 40 }
      );

      const updatedUser = await userRepository.findOne({
        where: { email: "john@example.com" },
      });

      expect(updatedUser?.age).toBe(40);
    });
  });

  describe("Delete", () => {
    let user: User;

    beforeEach(async () => {
      user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });
    });

    it("should delete single entity", async () => {
      await userRepository.remove(user);

      const foundUser = await userRepository.findOne({ where: { id: user.id } });
      expect(foundUser).toBeNull();
    });

    it("should delete entity with delete method", async () => {
      await userRepository.delete(user.id);

      const foundUser = await userRepository.findOne({ where: { id: user.id } });
      expect(foundUser).toBeNull();
    });

    it("should delete entity with conditions", async () => {
      await userRepository.delete({ email: "john@example.com" });

      const foundUser = await userRepository.findOne({
        where: { email: "john@example.com" },
      });
      expect(foundUser).toBeNull();
    });

    it("should delete multiple entities", async () => {
      await userRepository.save([
        { name: "User 1", email: "user1@example.com" },
        { name: "User 2", email: "user2@example.com" },
      ]);

      await userRepository.delete({ active: true });

      const users = await userRepository.find();
      expect(users.length).toBe(0);
    });
  });
});

