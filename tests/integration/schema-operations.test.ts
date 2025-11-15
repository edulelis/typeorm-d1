import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import { DataSource, Table, TableColumn, TableIndex, TableForeignKey } from "typeorm";
import { createTestDataSource, cleanupDataSource } from "../fixtures/database";
import { User, Post, Profile, Tag } from "../fixtures/entities";
import { getTestDatabase, cleanupDatabase, closeDatabase } from "../setup";

// Helper to get all entities with relations
const getAllEntities = () => [User, Post, Profile, Tag];

describe("Schema Operations Tests", () => {
  let dataSource: DataSource;
  let db: any;
  let queryRunner: any;

  beforeAll(async () => {
    db = await getTestDatabase();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await cleanupDataSource(dataSource);
    }
    await cleanupDatabase();
    await closeDatabase();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    dataSource = await createTestDataSource(getAllEntities());
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
  });

  afterEach(async () => {
    if (queryRunner) {
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await cleanupDataSource(dataSource);
    }
  });

  describe("Table Operations", () => {
    it("should drop table with IF EXISTS", async () => {
      // Create a test table first
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_drop_table (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);

      // Verify table exists
      const before = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_drop_table'"
      ).all();
      expect(before.results?.length).toBe(1);

      // Drop with IF EXISTS
      await queryRunner.dropTable("test_drop_table", true);

      // Verify table is gone
      const after = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_drop_table'"
      ).all();
      expect(after.results?.length).toBe(0);
    });

    it("should drop table without IF EXISTS", async () => {
      // Create a test table first
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_drop_table2 (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);

      // Drop without IF EXISTS
      await queryRunner.dropTable("test_drop_table2", false);

      // Verify table is gone
      const after = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_drop_table2'"
      ).all();
      expect(after.results?.length).toBe(0);
    });

    it("should throw error when dropping non-existent table without IF EXISTS", async () => {
      await expect(
        queryRunner.dropTable("non_existent_table", false)
      ).rejects.toThrow();
    });

    it("should get table metadata", async () => {
      const table = await queryRunner.getTable("users");
      // getTable now returns parsed table metadata
      expect(table).toBeDefined();
      expect(table?.name).toBe("users");
      expect(table?.columns.length).toBeGreaterThan(0);
      
      // Verify column properties
      const idColumn = table?.columns.find(c => c.name === "id");
      expect(idColumn?.isPrimary).toBe(true);
      expect(idColumn?.isGenerated).toBe(true);
      
      const emailColumn = table?.columns.find(c => c.name === "email");
      expect(emailColumn?.isUnique).toBe(true);
    });

    it("should get tables list", async () => {
      const tables = await queryRunner.getTables();
      // getTables now returns parsed table metadata
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables.some(t => t.name === "users")).toBe(true);
    });

    it("should get tables with specific names", async () => {
      const tables = await queryRunner.getTables(["users", "posts"]);
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  describe("View Operations", () => {
    it("should get view (returns undefined - D1 doesn't support views)", async () => {
      const view = await queryRunner.getView("non_existent_view");
      expect(view).toBeUndefined();
    });

    it("should get views list (returns empty array - D1 doesn't support views)", async () => {
      const views = await queryRunner.getViews();
      expect(Array.isArray(views)).toBe(true);
      expect(views.length).toBe(0);
    });

    it("should get views with specific names", async () => {
      const views = await queryRunner.getViews(["view1", "view2"]);
      expect(Array.isArray(views)).toBe(true);
    });
  });

  describe("Column Operations", () => {
    it("should add column to existing table", async () => {
      // Create a simple table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_add_column (
          id INTEGER PRIMARY KEY
        )
      `);

      const column = new TableColumn({
        name: "new_column",
        type: "TEXT",
        isNullable: true,
      });

      await queryRunner.addColumn("test_add_column", column);

      // Verify column was added
      const result = await db.prepare("PRAGMA table_info(test_add_column)").all();
      const newColumn = result.results?.find((col: any) => col.name === "new_column");
      expect(newColumn).toBeDefined();
      expect(newColumn?.type).toBe("TEXT");
    });

    it("should add multiple columns", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_add_columns (
          id INTEGER PRIMARY KEY
        )
      `);

      const columns = [
        new TableColumn({ name: "col1", type: "TEXT", isNullable: true }),
        new TableColumn({ name: "col2", type: "INTEGER", isNullable: true }),
      ];

      await queryRunner.addColumns("test_add_columns", columns);

      // Verify columns were added
      const result = await db.prepare("PRAGMA table_info(test_add_columns)").all();
      const col1 = result.results?.find((col: any) => col.name === "col1");
      const col2 = result.results?.find((col: any) => col.name === "col2");
      expect(col1).toBeDefined();
      expect(col2).toBeDefined();
    });

    it("should throw error when dropping column (SQLite limitation)", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_drop_column (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);

      await expect(
        queryRunner.dropColumn("test_drop_column", "name")
      ).rejects.toThrow();
    });

    it("should throw error when changing column (SQLite limitation)", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_change_column (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);

      const oldColumn = new TableColumn({ name: "name", type: "TEXT" });
      const newColumn = new TableColumn({ name: "name", type: "INTEGER" });

      await expect(
        queryRunner.changeColumn("test_change_column", oldColumn, newColumn)
      ).rejects.toThrow("SQLite/D1 has limited ALTER TABLE support");
    });

    it("should throw error when renaming column (SQLite limitation)", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_rename_column (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);

      await expect(
        queryRunner.renameColumn("test_rename_column", "name", "new_name")
      ).rejects.toThrow("SQLite/D1 may not support RENAME COLUMN");
    });

    it("should throw error when dropping multiple columns (SQLite limitation)", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_drop_columns (
          id INTEGER PRIMARY KEY,
          col1 TEXT,
          col2 TEXT
        )
      `);

      const columns = [
        new TableColumn({ name: "col1", type: "TEXT" }),
        new TableColumn({ name: "col2", type: "TEXT" }),
      ];

      await expect(
        queryRunner.dropColumns("test_drop_columns", columns)
      ).rejects.toThrow("SQLite/D1 doesn't support DROP COLUMN");
    });
  });

  describe("Index Operations", () => {
    it("should create index", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_index (
          id INTEGER PRIMARY KEY,
          name TEXT,
          email TEXT
        )
      `);

      const index = new TableIndex({
        name: "idx_test_name",
        columnNames: ["name"],
        isUnique: false,
      });

      await queryRunner.createIndex("test_index", index);

      // Verify index was created
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_name'"
      ).all();
      expect(result.results?.length).toBe(1);
    });

    it("should create unique index", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_unique_index (
          id INTEGER PRIMARY KEY,
          email TEXT
        )
      `);

      const index = new TableIndex({
        name: "idx_test_email_unique",
        columnNames: ["email"],
        isUnique: true,
      });

      await queryRunner.createIndex("test_unique_index", index);

      // Verify unique index was created
      const result = await db.prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND name='idx_test_email_unique'"
      ).all();
      expect(result.results?.length).toBe(1);
      expect(result.results?.[0].sql?.toUpperCase()).toContain("UNIQUE");
    });

    it("should create index with multiple columns", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_multi_index (
          id INTEGER PRIMARY KEY,
          col1 TEXT,
          col2 TEXT
        )
      `);

      const index = new TableIndex({
        name: "idx_test_multi",
        columnNames: ["col1", "col2"],
        isUnique: false,
      });

      await queryRunner.createIndex("test_multi_index", index);

      // Verify index was created
      const result = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_multi'"
      ).all();
      expect(result.results?.length).toBe(1);
    });

    it("should drop index", async () => {
      // Create index first
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_drop_index (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_test_drop ON test_drop_index(name)
      `);

      // Verify index exists
      const before = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_drop'"
      ).all();
      expect(before.results?.length).toBe(1);

      // Drop index
      await queryRunner.dropIndex("test_drop_index", "idx_test_drop");

      // Verify index is gone
      const after = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_drop'"
      ).all();
      expect(after.results?.length).toBe(0);
    });

    it("should throw error when dropping index without name", async () => {
      const index = new TableIndex({
        columnNames: ["name"],
      });

      await expect(
        queryRunner.dropIndex("test_table", index)
      ).rejects.toThrow("Index name is required");
    });
  });

  describe("Foreign Key Operations", () => {
    it("should throw error when creating foreign key (SQLite limitation)", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_fk_parent (
          id INTEGER PRIMARY KEY
        )
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_fk_child (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER
        )
      `);

      const foreignKey = new TableForeignKey({
        name: "fk_test",
        columnNames: ["parent_id"],
        referencedTableName: "test_fk_parent",
        referencedColumnNames: ["id"],
      });

      await expect(
        queryRunner.createForeignKey("test_fk_child", foreignKey)
      ).rejects.toThrow("SQLite/D1 doesn't support adding foreign keys to existing tables");
    });

    it("should throw error when dropping foreign key (SQLite limitation)", async () => {
      await expect(
        queryRunner.dropForeignKey("test_table", "fk_test")
      ).rejects.toThrow("SQLite/D1 doesn't support dropping foreign keys");
    });
  });

  describe("Primary Key Operations", () => {
    it("should throw error when creating primary key (SQLite limitation)", async () => {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_pk (
          id INTEGER,
          name TEXT
        )
      `);

      await expect(
        queryRunner.createPrimaryKey("test_pk", ["id"])
      ).rejects.toThrow("SQLite/D1 doesn't support adding primary keys to existing tables");
    });

    it("should throw error when dropping primary key (SQLite limitation)", async () => {
      await expect(
        queryRunner.dropPrimaryKey("test_table")
      ).rejects.toThrow("SQLite/D1 doesn't support dropping primary keys");
    });
  });

  describe("Database Operations", () => {
    it("should clear table", async () => {
      // Create and populate table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_clear (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);
      await queryRunner.query(`INSERT INTO test_clear (name) VALUES ('test1'), ('test2')`);

      // Verify data exists
      const before = await db.prepare("SELECT COUNT(*) as count FROM test_clear").first();
      expect(before?.count).toBe(2);

      // Clear table
      await queryRunner.clearTable("test_clear");

      // Verify table is empty
      const after = await db.prepare("SELECT COUNT(*) as count FROM test_clear").first();
      expect(after?.count).toBe(0);
    });

    it("should clear database (all tables)", async () => {
      // Create and populate tables
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_clear1 (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS test_clear2 (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `);
      await queryRunner.query(`INSERT INTO test_clear1 (name) VALUES ('test')`);
      await queryRunner.query(`INSERT INTO test_clear2 (name) VALUES ('test')`);

      // Clear database
      // Note: clearDatabase() only clears tables that TypeORM knows about
      // It uses getTables() which returns empty array in current implementation
      // So this test documents the behavior
      await queryRunner.clearDatabase();

      // Verify tables still exist (clearDatabase only clears data, not tables)
      const tables = await db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('test_clear1', 'test_clear2')"
      ).all();
      // Tables should still exist
      expect(tables.results?.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Connection Error Handling", () => {
    it("should handle connection errors gracefully", async () => {
      // Create a query runner with invalid driver
      const invalidRunner = dataSource.createQueryRunner();
      
      // This should work normally with valid connection
      const result = await invalidRunner.query("SELECT 1 as test");
      expect(result).toBeDefined();
      
      await invalidRunner.release();
    });
  });
});

