import { describe, expect, it, jest } from "@jest/globals";
import { DataSource } from "typeorm";
import { D1DriverFactory } from "../../src/driver/d1";
import { D1DriverRegistry, D1Guards } from "../../src/utils";
import { D1Database } from "../../src/types";

const validDatabase: D1Database = {
  prepare: jest.fn(),
  batch: jest.fn(),
  exec: jest.fn(),
};

describe("D1Guards", () => {
  it("detects valid and invalid D1 database objects", () => {
    expect(D1Guards.isD1Database(validDatabase)).toBe(true);
    expect(D1Guards.isD1Database(null)).toBe(false);
    expect(D1Guards.isD1Database(undefined)).toBe(false);
    expect(D1Guards.isD1Database({ prepare: jest.fn() })).toBe(false);
    expect(D1Guards.isD1Database({ prepare: jest.fn(), batch: jest.fn() })).toBe(false);
    expect(D1Guards.isD1Database({ prepare: jest.fn(), batch: jest.fn(), exec: "nope" })).toBe(false);
  });

  it("asserts driver and connection state", () => {
    expect(() => D1Guards.assertDriverInitialized(undefined)).toThrow("Driver is not initialized");
    expect(() => D1Guards.assertDriverInitialized({} as any)).not.toThrow();

    expect(() => D1Guards.assertConnectionEstablished(undefined)).toThrow("Database connection is not established");
    expect(() => D1Guards.assertConnectionEstablished(validDatabase)).not.toThrow();
  });

  it("validates query parameters", () => {
    expect(() => D1Guards.validateQueryParameters(undefined)).not.toThrow();
    expect(() => D1Guards.validateQueryParameters([])).not.toThrow();
    expect(() => D1Guards.validateQueryParameters(["value"])).not.toThrow();
    expect(() => D1Guards.validateQueryParameters("value" as any)).toThrow("Query parameters must be an array");
  });

  it("asserts required values and strings", () => {
    expect(() => D1Guards.assertNotNull("value", "Value")).not.toThrow();
    expect(() => D1Guards.assertNotNull(null, "Value")).toThrow("Value must not be null or undefined");
    expect(() => D1Guards.assertNotNull(undefined, "Value")).toThrow("Value must not be null or undefined");

    expect(() => D1Guards.assertNonEmptyString("table", "Table name")).not.toThrow();
    expect(() => D1Guards.assertNonEmptyString("", "Table name")).toThrow("Table name must not be empty");
    expect(() => D1Guards.assertNonEmptyString("   ", "Table name")).toThrow("Table name must not be empty");
    expect(() => D1Guards.assertNonEmptyString(undefined, "Table name")).toThrow("Table name must not be empty");
  });
});

describe("D1DriverRegistry", () => {
  it("registers and unregisters idempotently", () => {
    D1DriverRegistry.unregister();
    expect(D1DriverRegistry.getIsRegistered()).toBe(false);

    D1DriverRegistry.register();
    D1DriverRegistry.register();
    expect(D1DriverRegistry.getIsRegistered()).toBe(true);

    D1DriverRegistry.unregister();
    expect(D1DriverRegistry.getIsRegistered()).toBe(true);

    D1DriverRegistry.unregister();
    expect(D1DriverRegistry.getIsRegistered()).toBe(false);
  });
});

describe("D1DriverFactory", () => {
  it("throws when driver database is missing", () => {
    const dataSource = { options: { driver: {} } } as DataSource;
    const factory = new D1DriverFactory();

    expect(() => factory.create(dataSource)).toThrow("D1DriverFactory requires driver.database");
  });

  it("creates a D1 driver for valid options", () => {
    const dataSource = {
      options: {
        driver: { database: validDatabase },
      },
    } as any as DataSource;
    const factory = new D1DriverFactory();

    expect(factory.create(dataSource).constructor.name).toBe("D1Driver");
  });
});
