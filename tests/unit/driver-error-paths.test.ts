import { describe, it, expect } from "@jest/globals";
import { DataSource } from "typeorm";
import { D1Driver } from "../../src/driver/d1";
import { createD1DataSource } from "../../src/factory";
import { getTestDatabase } from "../setup";

describe("D1Driver Error Paths", () => {
  describe("Constructor Error Handling", () => {
    it("should throw error when database is not provided (line 37)", () => {
      // Create a minimal DataSource-like object to test constructor
      // We can't use real DataSource because TypeORM validates driver types
      const mockConnection = {
        options: {
          driver: {} as any, // Missing database
        },
      } as any as DataSource;

      // Create driver directly to test constructor
      expect(() => {
        new D1Driver(mockConnection);
      }).toThrow("D1 database instance must be provided");
    });

    it("should throw error when database is invalid (line 57)", () => {
      // Create a minimal DataSource-like object with invalid database
      // The constructor now validates the database instance immediately
      const mockConnection = {
        options: {
          driver: {
            database: {} as any, // Invalid database (object but not a D1Database)
          } as any,
        },
      } as any as DataSource;

      // Constructor now validates database instance and throws D1ValidationError immediately
      expect(() => {
        new D1Driver(mockConnection);
      }).toThrow("Invalid D1 database instance");
    });

    it("should handle valid database connection", async () => {
      const db = await getTestDatabase();
      const dataSource = createD1DataSource({
        database: db,
        entities: [],
        synchronize: false,
      });

      await dataSource.initialize();
      expect(dataSource.isInitialized).toBe(true);
      await dataSource.destroy();
    });
  });
});

