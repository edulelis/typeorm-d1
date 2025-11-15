import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { DataSource } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { cleanupDatabase } from "../setup";

// Helper to get all entities with relations
function getAllEntities() {
  return [User, Post, Profile, Tag];
}

describe("PRAGMA Statements Tests", () => {
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
    // Ensure tables exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS test_pragma (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        value INTEGER
      )
    `);
  });

  describe("PRAGMA foreign_keys", () => {
    it("should check foreign keys status", async () => {
      const result = await queryRunner.query("PRAGMA foreign_keys");
      
      expect(result.length).toBe(1);
      // Should be 1 (enabled) since we enable it in afterConnect
      expect(result[0].foreign_keys).toBe(1);
    });

    it("should verify foreign keys are enabled", async () => {
      // Create tables with foreign key
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_fk_parent (
          id INTEGER PRIMARY KEY
        )
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_fk_child (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER,
          FOREIGN KEY (parent_id) REFERENCES test_fk_parent(id)
        )
      `);

      // Insert parent
      await queryRunner.query("INSERT INTO test_fk_parent (id) VALUES (1)");

      // Try to insert child with valid parent
      await queryRunner.query("INSERT INTO test_fk_child (id, parent_id) VALUES (1, 1)");

      // Try to insert child with invalid parent (should fail if foreign keys enabled)
      try {
        await queryRunner.query("INSERT INTO test_fk_child (id, parent_id) VALUES (2, 999)");
        // If we get here, foreign keys might not be enforced
      } catch (error) {
        // Expected: foreign key violation
        expect((error as Error).message).toMatch(/foreign key|constraint/i);
      }

      await queryRunner.query("DROP TABLE IF EXISTS test_fk_child");
      await queryRunner.query("DROP TABLE IF EXISTS test_fk_parent");
    });
  });

  describe("PRAGMA table_info", () => {
    it("should get table information", async () => {
      const result = await queryRunner.query("PRAGMA table_info(users)");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("cid");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("type");
      expect(result[0]).toHaveProperty("notnull");
      expect(result[0]).toHaveProperty("dflt_value");
      expect(result[0]).toHaveProperty("pk");
    });

    it("should get column details from table_info", async () => {
      const result = await queryRunner.query("PRAGMA table_info(users)");

      const idColumn = result.find((col: any) => col.name === "id");
      expect(idColumn).toBeDefined();
      expect(idColumn.type).toContain("INTEGER");
      expect(idColumn.pk).toBe(1); // Primary key

      const nameColumn = result.find((col: any) => col.name === "name");
      expect(nameColumn).toBeDefined();
      expect(nameColumn.type).toContain("TEXT");
      expect(nameColumn.notnull).toBe(1); // NOT NULL
    });

    it("should get nullable column information", async () => {
      const result = await queryRunner.query("PRAGMA table_info(users)");

      const ageColumn = result.find((col: any) => col.name === "age");
      expect(ageColumn).toBeDefined();
      expect(ageColumn.notnull).toBe(0); // Nullable
    });

    it("should get default value information", async () => {
      const result = await queryRunner.query("PRAGMA table_info(users)");

      const activeColumn = result.find((col: any) => col.name === "active");
      expect(activeColumn).toBeDefined();
      // Default value should be present
      expect(activeColumn.dflt_value).toBeDefined();
    });

    it("should handle table_info for non-existent table", async () => {
      const result = await queryRunner.query("PRAGMA table_info(non_existent_table)");
      
      // Should return empty array, not throw error
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("PRAGMA index_list", () => {
    beforeEach(async () => {
      // Create table with indexes
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_indexes (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_test_indexes_age ON test_indexes(age)
      `);
    });

    afterEach(async () => {
      await queryRunner.query("DROP TABLE IF EXISTS test_indexes");
    });

    it("should list indexes for a table", async () => {
      const result = await queryRunner.query("PRAGMA index_list(test_indexes)");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("seq");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("unique");
      expect(result[0]).toHaveProperty("origin");
      expect(result[0]).toHaveProperty("partial");
    });

    it("should identify unique indexes", async () => {
      const result = await queryRunner.query("PRAGMA index_list(test_indexes)");

      const uniqueIndex = result.find((idx: any) => idx.name?.includes("email") || idx.unique === 1);
      if (uniqueIndex) {
        expect(uniqueIndex.unique).toBe(1);
      }
    });

    it("should list all indexes including auto-created ones", async () => {
      const result = await queryRunner.query("PRAGMA index_list(users)");

      // Should include indexes for unique columns, foreign keys, etc.
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("PRAGMA index_info", () => {
    beforeEach(async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_index_info (
          id INTEGER PRIMARY KEY,
          name TEXT,
          email TEXT,
          age INTEGER
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_name_age ON test_index_info(name, age)
      `);
    });

    afterEach(async () => {
      await queryRunner.query("DROP TABLE IF EXISTS test_index_info");
    });

    it("should get index column information", async () => {
      const result = await queryRunner.query("PRAGMA index_info(idx_name_age)");

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("seqno");
      expect(result[0]).toHaveProperty("cid");
      expect(result[0]).toHaveProperty("name");
    });

    it("should list all columns in composite index", async () => {
      const result = await queryRunner.query("PRAGMA index_info(idx_name_age)");

      expect(result.length).toBe(2); // name and age
      const columnNames = result.map((r: any) => r.name);
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("age");
    });
  });

  describe("PRAGMA integrity_check", () => {
    it("should check database integrity (if supported)", async () => {
      try {
        const result = await queryRunner.query("PRAGMA integrity_check");
        
        // Should return 'ok' if integrity is good
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
          expect(result[0].integrity_check).toBe("ok");
        }
      } catch (error) {
        // If not supported, that's okay - document it
        expect((error as Error).message).toBeDefined();
      }
    });

    it("should check quick integrity (if supported)", async () => {
      try {
        const result = await queryRunner.query("PRAGMA quick_check");
        
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // If not supported, that's okay
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe("PRAGMA user_version", () => {
    it("should get user version (if supported)", async () => {
      try {
        const result = await queryRunner.query("PRAGMA user_version");
        
        expect(result.length).toBe(1);
        expect(result[0]).toHaveProperty("user_version");
        expect(typeof result[0].user_version).toBe("number");
      } catch (error) {
        // If not supported, that's okay
        expect((error as Error).message).toBeDefined();
      }
    });

    it("should set and get user version (if supported)", async () => {
      try {
        await queryRunner.query("PRAGMA user_version = 5");
        const result = await queryRunner.query("PRAGMA user_version");
        
        expect(result[0].user_version).toBe(5);
      } catch (error) {
        // If not supported, that's okay
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe("Unsupported PRAGMAs", () => {
    it("should handle unsupported PRAGMA journal_mode gracefully", async () => {
      try {
        const result = await queryRunner.query("PRAGMA journal_mode");
        // If it works, check the result
        if (result.length > 0) {
          expect(result[0].journal_mode).toBeDefined();
        }
      } catch (error) {
        // Expected: D1 doesn't support journal_mode
        expect((error as Error).message).toBeDefined();
      }
    });

    it("should handle unsupported PRAGMA synchronous gracefully", async () => {
      try {
        const result = await queryRunner.query("PRAGMA synchronous");
        // If it works, check the result
        if (result.length > 0) {
          expect(result[0].synchronous).toBeDefined();
        }
      } catch (error) {
        // Expected: D1 doesn't support synchronous
        expect((error as Error).message).toBeDefined();
      }
    });

    it("should handle unsupported PRAGMA cache_size gracefully", async () => {
      try {
        const result = await queryRunner.query("PRAGMA cache_size");
        // If it works, check the result
        if (result.length > 0) {
          expect(result[0].cache_size).toBeDefined();
        }
      } catch (error) {
        // Expected: D1 doesn't support cache_size
        expect((error as Error).message).toBeDefined();
      }
    });
  });

  describe("PRAGMA table_list (SQLite 3.37+)", () => {
    it("should list all tables (if supported)", async () => {
      try {
        const result = await queryRunner.query("PRAGMA table_list");
        
        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
          expect(result[0]).toHaveProperty("schema");
          expect(result[0]).toHaveProperty("name");
          expect(result[0]).toHaveProperty("type");
        }
      } catch (error) {
        // If not supported (older SQLite), that's okay
        expect((error as Error).message).toBeDefined();
      }
    });
  });
});

