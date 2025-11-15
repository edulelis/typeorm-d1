import { describe, it, expect } from "@jest/globals";
import { DataSource } from "typeorm";
import { D1QueryRunner, D1Driver } from "../../src/driver/d1";
import { createD1DataSource } from "../../src/factory";
import { getTestDatabase } from "../setup";
import { TableColumn } from "typeorm";

describe("Type Normalization Tests", () => {
  let dataSource: DataSource;
  let queryRunner: D1QueryRunner;

  beforeAll(async () => {
    const db = await getTestDatabase();
    dataSource = createD1DataSource({
      database: db,
      entities: [],
      synchronize: false,
    });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner() as D1QueryRunner;
  });

  afterAll(async () => {
    await queryRunner.release();
    await dataSource.destroy();
  });

  describe("normalizeType()", () => {
    it("should normalize integer types", () => {
      const testCases = [
        { type: "int", expected: "INTEGER" },
        { type: "integer", expected: "INTEGER" },
        { type: "bigint", expected: "INTEGER" },
        { type: "smallint", expected: "INTEGER" },
        { type: "tinyint", expected: "INTEGER" },
      ];

      testCases.forEach(({ type, expected }) => {
        const column = new TableColumn({ name: "test", type: type as any });
        const sql = (queryRunner as any).normalizeType(column);
        expect(sql).toBe(expected);
      });
    });

    it("should normalize real types", () => {
      const testCases = [
        { type: "float", expected: "REAL" },
        { type: "double", expected: "REAL" },
        { type: "real", expected: "REAL" },
        { type: "decimal", expected: "REAL" },
        { type: "numeric", expected: "REAL" },
      ];

      testCases.forEach(({ type, expected }) => {
        const column = new TableColumn({ name: "test", type: type as any });
        const sql = (queryRunner as any).normalizeType(column);
        expect(sql).toBe(expected);
      });
    });

    it("should normalize text types", () => {
      const testCases = [
        { type: "text", expected: "TEXT" },
        { type: "string", expected: "TEXT" },
        { type: "varchar", expected: "TEXT" },
        { type: "char", expected: "TEXT" },
      ];

      testCases.forEach(({ type, expected }) => {
        const column = new TableColumn({ name: "test", type: type as any });
        const sql = (queryRunner as any).normalizeType(column);
        expect(sql).toBe(expected);
      });
    });

    it("should normalize date/time types", () => {
      const testCases = [
        { type: "date", expected: "TEXT" },
        { type: "datetime", expected: "TEXT" },
        { type: "timestamp", expected: "TEXT" },
        { type: "time", expected: "TEXT" },
      ];

      testCases.forEach(({ type, expected }) => {
        const column = new TableColumn({ name: "test", type: type as any });
        const sql = (queryRunner as any).normalizeType(column);
        expect(sql).toBe(expected);
      });
    });

    it("should normalize boolean types", () => {
      const testCases = [
        { type: "boolean", expected: "INTEGER" },
        { type: "bool", expected: "INTEGER" },
      ];

      testCases.forEach(({ type, expected }) => {
        const column = new TableColumn({ name: "test", type: type as any });
        const sql = (queryRunner as any).normalizeType(column);
        expect(sql).toBe(expected);
      });
    });

    it("should normalize blob type", () => {
      const column = new TableColumn({ name: "test", type: "blob" });
      const sql = (queryRunner as any).normalizeType(column);
      expect(sql).toBe("BLOB");
    });

    it("should handle unknown types by uppercasing", () => {
      const column = new TableColumn({ name: "test", type: "customtype" as any });
      const sql = (queryRunner as any).normalizeType(column);
      expect(sql).toBe("CUSTOMTYPE");
    });

    it("should handle case-insensitive type names", () => {
      const column = new TableColumn({ name: "test", type: "INTEGER" as any });
      const sql = (queryRunner as any).normalizeType(column);
      expect(sql).toBe("INTEGER");
    });
  });

  describe("normalizeDefault()", () => {
    it("should normalize string defaults with proper escaping", () => {
      const testCases = [
        { value: "simple", expected: "'simple'" },
        { value: "with'quote", expected: "'with''quote'" },
        { value: "with''double", expected: "'with''''double'" },
      ];

      testCases.forEach(({ value, expected }) => {
        const result = (queryRunner as any).normalizeDefault(value);
        expect(result).toBe(expected);
      });
    });

    it("should normalize number defaults", () => {
      const testCases = [
        { value: 0, expected: "0" },
        { value: 42, expected: "42" },
        { value: -10, expected: "-10" },
        { value: 3.14, expected: "3.14" },
      ];

      testCases.forEach(({ value, expected }) => {
        const result = (queryRunner as any).normalizeDefault(value);
        expect(result).toBe(expected);
      });
    });

    it("should normalize boolean defaults", () => {
      expect((queryRunner as any).normalizeDefault(true)).toBe("1");
      expect((queryRunner as any).normalizeDefault(false)).toBe("0");
    });

    it("should normalize null defaults", () => {
      expect((queryRunner as any).normalizeDefault(null)).toBe("NULL");
    });

    it("should handle other types by converting to string", () => {
      const result = (queryRunner as any).normalizeDefault({});
      expect(typeof result).toBe("string");
      expect(result).toBeDefined();
    });
  });

  describe("buildCreateColumnSql()", () => {
    it("should build column SQL with primary key", () => {
      const column = new TableColumn({
        name: "id",
        type: "integer",
        isPrimary: true,
        isGenerated: false,
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).toContain("PRIMARY KEY");
      expect(sql).toContain('"id"');
    });

    it("should build column SQL with auto-increment", () => {
      const column = new TableColumn({
        name: "id",
        type: "integer",
        isPrimary: true,
        isGenerated: true,
        generationStrategy: "increment",
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).toContain("AUTOINCREMENT");
      expect(sql).toContain("PRIMARY KEY");
    });

    it("should build column SQL with UNIQUE constraint", () => {
      const column = new TableColumn({
        name: "email",
        type: "text",
        isUnique: true,
        isPrimary: false,
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).toContain("UNIQUE");
    });

    it("should build column SQL with NOT NULL", () => {
      const column = new TableColumn({
        name: "name",
        type: "text",
        isNullable: false,
        isPrimary: false,
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).toContain("NOT NULL");
    });

    it("should build column SQL with default value", () => {
      const column = new TableColumn({
        name: "active",
        type: "boolean",
        default: true,
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).toContain("DEFAULT");
      expect(sql).toContain("1");
    });

    it("should handle composite primary key correctly", () => {
      const column = new TableColumn({
        name: "id",
        type: "integer",
        isPrimary: true,
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, true);
      // In composite primary key, PRIMARY KEY is added at table level
      expect(sql).not.toContain("PRIMARY KEY");
    });

    it("should not add AUTOINCREMENT for non-INTEGER types", () => {
      const column = new TableColumn({
        name: "id",
        type: "text",
        isPrimary: true,
        isGenerated: true,
        generationStrategy: "increment",
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).not.toContain("AUTOINCREMENT");
      expect(sql).toContain("PRIMARY KEY");
    });

    it("should handle nullable columns", () => {
      const column = new TableColumn({
        name: "optional",
        type: "text",
        isNullable: true,
      });

      const sql = (queryRunner as any).buildCreateColumnSql(column, false);
      expect(sql).not.toContain("NOT NULL");
    });
  });
});

