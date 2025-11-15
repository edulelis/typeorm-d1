import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Tag, Profile } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

describe("Relations Tests", () => {
  let dataSource: DataSource;
  let userRepository: any;
  let postRepository: any;
  let tagRepository: any;
  let profileRepository: any;

  beforeAll(async () => {
    dataSource = await createTestDataSource([User, Post, Tag, Profile]);
    await dataSource.initialize();
    userRepository = dataSource.getRepository(User);
    postRepository = dataSource.getRepository(Post);
    tagRepository = dataSource.getRepository(Tag);
    profileRepository = dataSource.getRepository(Profile);
  });

  afterAll(async () => {
    await cleanupDataSource(dataSource);
    await cleanupDatabase();
  });

  beforeEach(async () => {
    // Clean up in reverse order of dependencies using raw SQL
    const queryRunner = dataSource.createQueryRunner();
    try {
      // Disable foreign keys temporarily for cleanup
      await queryRunner.query("PRAGMA foreign_keys = OFF");
      await queryRunner.query("DELETE FROM post_tags");
      await queryRunner.query("DELETE FROM posts");
      await queryRunner.query("DELETE FROM tags");
      await queryRunner.query("DELETE FROM profiles");
      await queryRunner.query("DELETE FROM users");
      await queryRunner.query("PRAGMA foreign_keys = ON");
    } finally {
      await queryRunner.release();
    }
  });

  describe("OneToMany / ManyToOne", () => {
    it("should create entities with OneToMany relation", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      const post = await postRepository.save({
        title: "Test Post",
        content: "Test Content",
        authorId: user.id,
      });

      expect(post.authorId).toBe(user.id);
      expect(post.id).toBeDefined();
    });

    it("should load relations (eager)", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      await postRepository.save({
        title: "Post 1",
        authorId: user.id,
      });

      await postRepository.save({
        title: "Post 2",
        authorId: user.id,
      });

      const userWithPosts = await userRepository.findOne({
        where: { id: user.id },
        relations: ["posts"],
      });

      expect(userWithPosts).toBeDefined();
      expect(userWithPosts?.posts).toBeDefined();
      expect(userWithPosts?.posts.length).toBe(2);
    });

    it("should save entities with relations", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      const post = postRepository.create({
        title: "Test Post",
        authorId: user.id,
      });

      const savedPost = await postRepository.save(post);

      expect(savedPost.authorId).toBe(user.id);
      expect(savedPost.id).toBeDefined();
    });

    it("should update relations", async () => {
      const user1 = await userRepository.save({
        name: "User 1",
        email: "user1@example.com",
      });

      const user2 = await userRepository.save({
        name: "User 2",
        email: "user2@example.com",
      });

      const post = await postRepository.save({
        title: "Test Post",
        authorId: user1.id,
      });

      // Update post author
      post.authorId = user2.id;
      await postRepository.save(post);

      const updatedPost = await postRepository.findOne({
        where: { id: post.id },
        relations: ["author"],
      });

      expect(updatedPost?.authorId).toBe(user2.id);
    });

    it("should test cascade delete", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      await postRepository.save({
        title: "Post 1",
        authorId: user.id,
      });

      await postRepository.save({
        title: "Post 2",
        authorId: user.id,
      });

      // Delete user (should cascade delete posts if configured)
      await userRepository.delete(user.id);

      const posts = await postRepository.find({ where: { authorId: user.id } });
      // Note: Cascade behavior depends on entity configuration
      // If CASCADE is configured, posts should be deleted
      expect(posts.length).toBe(0);
    });

    it("should test join queries", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      await postRepository.save({
        title: "Post 1",
        authorId: user.id,
      });

      const postsWithAuthor = await postRepository
        .createQueryBuilder("post")
        .leftJoinAndSelect("post.author", "author")
        .getMany();

      expect(postsWithAuthor.length).toBe(1);
      expect(postsWithAuthor[0].author).toBeDefined();
      expect(postsWithAuthor[0].author.name).toBe("John Doe");
    });
  });

  describe("ManyToMany", () => {
    it("should create entities with ManyToMany relation", async () => {
      const post = await postRepository.save({
        title: "Test Post",
        authorId: (await userRepository.save({
          name: "John Doe",
          email: "john@example.com",
        })).id,
      });

      const tag = await tagRepository.save({
        name: "Technology",
      });

      expect(post.id).toBeDefined();
      expect(tag.id).toBeDefined();
    });

    it("should create join table", async () => {
      // Use the existing dataSource instead of creating a new one
      // The join table should already be created during beforeAll
      const db = (dataSource as any).driver.databaseConnection;
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='post_tags'"
      ).all();

      expect(result.results).toBeDefined();
      expect(result.results?.length).toBe(1);
    });

    it("should add relations", async () => {
      const post = await postRepository.save({
        title: "Test Post",
        authorId: (await userRepository.save({
          name: "John Doe",
          email: "john@example.com",
        })).id,
      });

      const tag1 = await tagRepository.save({ name: "Technology" });
      const tag2 = await tagRepository.save({ name: "Programming" });

      post.tags = [tag1, tag2];
      await postRepository.save(post);

      const postWithTags = await postRepository.findOne({
        where: { id: post.id },
        relations: ["tags"],
      });

      expect(postWithTags?.tags).toBeDefined();
      expect(postWithTags?.tags.length).toBe(2);
    });

    it("should remove relations", async () => {
      const post = await postRepository.save({
        title: "Test Post",
        authorId: (await userRepository.save({
          name: "John Doe",
          email: "john@example.com",
        })).id,
      });

      const tag = await tagRepository.save({ name: "Technology" });

      post.tags = [tag];
      await postRepository.save(post);

      // Remove tag
      post.tags = [];
      await postRepository.save(post);

      const postWithoutTags = await postRepository.findOne({
        where: { id: post.id },
        relations: ["tags"],
      });

      expect(postWithoutTags?.tags.length).toBe(0);
    });

    it("should load ManyToMany relations", async () => {
      const post = await postRepository.save({
        title: "Test Post",
        authorId: (await userRepository.save({
          name: "John Doe",
          email: "john@example.com",
        })).id,
      });

      const tag = await tagRepository.save({ name: "Technology" });

      post.tags = [tag];
      await postRepository.save(post);

      const postWithTags = await postRepository.findOne({
        where: { id: post.id },
        relations: ["tags"],
      });

      expect(postWithTags?.tags).toBeDefined();
      expect(postWithTags?.tags.length).toBe(1);
      expect(postWithTags?.tags[0].name).toBe("Technology");
    });

    it("should query with ManyToMany join", async () => {
      const post = await postRepository.save({
        title: "Test Post",
        authorId: (await userRepository.save({
          name: "John Doe",
          email: "john@example.com",
        })).id,
      });

      const tag = await tagRepository.save({ name: "Technology" });

      post.tags = [tag];
      await postRepository.save(post);

      const posts = await postRepository
        .createQueryBuilder("post")
        .leftJoinAndSelect("post.tags", "tag")
        .where("tag.name = :name", { name: "Technology" })
        .getMany();

      expect(posts.length).toBe(1);
      expect(posts[0].tags.length).toBe(1);
    });
  });

  describe("OneToOne", () => {
    it("should create entities with OneToOne relation", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      const profile = await profileRepository.save({
        bio: "Test bio",
        userId: user.id,
      });

      expect(profile.userId).toBe(user.id);
      expect(profile.id).toBeDefined();
    });

    it("should load OneToOne relation", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      await profileRepository.save({
        bio: "Test bio",
        userId: user.id,
      });

      const userWithProfile = await userRepository.findOne({
        where: { id: user.id },
        relations: ["profile"],
      });

      expect(userWithProfile?.profile).toBeDefined();
      expect(userWithProfile?.profile.bio).toBe("Test bio");
    });

    it("should save OneToOne relation", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      const profile = profileRepository.create({
        bio: "Test bio",
        userId: user.id,
      });

      const savedProfile = await profileRepository.save(profile);

      expect(savedProfile.userId).toBe(user.id);
      expect(savedProfile.id).toBeDefined();
    });

    it("should test bidirectional OneToOne", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      const profile = await profileRepository.save({
        bio: "Test bio",
        userId: user.id,
      });

      // Load from user side
      const userWithProfile = await userRepository.findOne({
        where: { id: user.id },
        relations: ["profile"],
      });

      expect(userWithProfile?.profile).toBeDefined();

      // Load from profile side
      const profileWithUser = await profileRepository.findOne({
        where: { id: profile.id },
        relations: ["user"],
      });

      expect(profileWithUser?.user).toBeDefined();
      expect(profileWithUser?.user.name).toBe("John Doe");
    });
  });

  describe("Relation Options", () => {
    it("should test nullable relations", async () => {
      const user = await userRepository.save({
        name: "John Doe",
        email: "john@example.com",
      });

      // User without profile
      const userWithoutProfile = await userRepository.findOne({
        where: { id: user.id },
        relations: ["profile"],
      });

      // TypeORM may return null or undefined for missing relations
      expect(userWithoutProfile?.profile).toBeFalsy();
    });

    it("should test optional relations", async () => {
      const post = await postRepository.save({
        title: "Test Post",
        authorId: (await userRepository.save({
          name: "John Doe",
          email: "john@example.com",
        })).id,
      });

      // Post without tags
      const postWithoutTags = await postRepository.findOne({
        where: { id: post.id },
        relations: ["tags"],
      });

      expect(postWithoutTags?.tags).toBeDefined();
      expect(postWithoutTags?.tags.length).toBe(0);
    });
  });
});

