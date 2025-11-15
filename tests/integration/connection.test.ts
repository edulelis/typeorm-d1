import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createD1DataSource } from "../../src/factory";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";
import { User, Post, Profile, Tag } from "../fixtures/entities";

describe("Connection Tests", () => {
  let db: any;
  let dataSource: DataSource;

  beforeAll(async () => {
    db = await getTestDatabase();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await cleanupDatabase();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Clean up database before each test to ensure isolation
    await cleanupDatabase();
  });

  describe("DataSource Creation", () => {
    it("should create DataSource with D1 driver", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      expect(dataSource).toBeDefined();
      expect(dataSource.options.driver).toBeDefined();
    });

    it("should initialize DataSource successfully", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      await dataSource.initialize();

      expect(dataSource.isInitialized).toBe(true);
    });

    it("should throw error if database instance is missing", () => {
      expect(() => {
        createD1DataSource({
          database: undefined as any,
          entities: [User, Post, Profile, Tag],
        });
      }).toThrow();
    });

    it("should validate database instance", async () => {
      const invalidDb = {} as any;

      expect(() => {
        createD1DataSource({
          database: invalidDb,
          entities: [User, Post, Profile, Tag],
        });
      }).toThrow();
    });
  });

  describe("Connection Lifecycle", () => {
    it("should connect successfully", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      await dataSource.initialize();
      expect(dataSource.isInitialized).toBe(true);
    });

    it("should disconnect successfully", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      await dataSource.initialize();
      await dataSource.destroy();

      expect(dataSource.isInitialized).toBe(false);
    });

    it("should allow multiple DataSource instances with same database", async () => {
      const dataSource1 = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      const dataSource2 = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      await dataSource1.initialize();
      await dataSource2.initialize();

      expect(dataSource1.isInitialized).toBe(true);
      expect(dataSource2.isInitialized).toBe(true);

      await dataSource1.destroy();
      await dataSource2.destroy();
    });

    it("should verify connection is always 'connected' (stateless)", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
      });

      await dataSource.initialize();

      const driver = (dataSource as any).driver;
      await driver.connect();

      // D1 is stateless, so the connection is always available
      expect(driver.databaseConnection).toBeDefined();
    });
  });

  describe("Connection Options", () => {
    it("should accept synchronize option", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: true,
      });

      await dataSource.initialize();
      expect(dataSource.isInitialized).toBe(true);

      // Verify table was created
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).all();

      expect(result.results).toBeDefined();
      expect(result.results?.length).toBeGreaterThan(0);
    });

    it("should accept logging option", async () => {
      dataSource = createD1DataSource({
        database: db,
        entities: [User, Post, Profile, Tag],
        synchronize: false,
        logging: true,
      });

      await dataSource.initialize();
      expect(dataSource.isInitialized).toBe(true);
    });
  });
});

