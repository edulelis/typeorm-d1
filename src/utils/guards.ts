import { D1Database } from "../types";
import { D1Driver } from "../driver/d1";
import { D1ConnectionError, D1ValidationError } from "../errors";

/**
 * Type guards and validation functions for D1 driver.
 * Provides runtime type checking and validation with clear error messages.
 * 
 * @internal
 */
export class D1Guards {
  /**
   * Type guard: Checks if value is a valid D1Database instance.
   * 
   * @param value - Value to check
   * @returns True if value is a valid D1Database
   */
  static isD1Database(value: unknown): value is D1Database {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as D1Database).prepare === "function" &&
      typeof (value as D1Database).batch === "function" &&
      typeof (value as D1Database).exec === "function"
    );
  }

  /**
   * Asserts that driver is initialized, throws if not.
   * 
   * @param driver - Driver instance to check
   * @throws {D1ConnectionError} If driver is not initialized
   */
  static assertDriverInitialized(
    driver: D1Driver | null | undefined
  ): asserts driver is D1Driver {
    if (!driver) {
      throw new D1ConnectionError("Driver is not initialized");
    }
  }

  /**
   * Asserts that database connection is established, throws if not.
   * 
   * @param connection - Connection to check
   * @throws {D1ConnectionError} If connection is not established
   */
  static assertConnectionEstablished(
    connection: D1Database | null | undefined
  ): asserts connection is D1Database {
    if (!connection) {
      throw new D1ConnectionError(
        "Database connection is not established. Call connect() first."
      );
    }
  }

  /**
   * Validates query parameters format.
   * 
   * @param parameters - Parameters to validate
   * @throws {D1ValidationError} If parameters are invalid
   */
  static validateQueryParameters(parameters: unknown[] | undefined): void {
    if (parameters === undefined) {
      return; // undefined is valid (no parameters)
    }

    if (!Array.isArray(parameters)) {
      throw new D1ValidationError("Query parameters must be an array", {
        received: typeof parameters,
      });
    }

    // Additional validation can be added here if needed
    // D1 accepts: string, number, null, ArrayBuffer, ArrayBufferView
    // undefined will be converted to null in normalizeParameters
  }

  /**
   * Validates that a value is not null or undefined.
   * 
   * @param value - Value to check
   * @param name - Name of the value for error message
   * @throws {D1ValidationError} If value is null or undefined
   */
  static assertNotNull<T>(
    value: T | null | undefined,
    name: string
  ): asserts value is T {
    if (value === null || value === undefined) {
      throw new D1ValidationError(`${name} must not be null or undefined`, {
        name,
        received: value,
      });
    }
  }

  /**
   * Validates that a string is not empty.
   * 
   * @param value - String to check
   * @param name - Name of the value for error message
   * @throws {D1ValidationError} If string is empty
   */
  static assertNonEmptyString(value: string | null | undefined, name: string): void {
    if (!value || value.trim().length === 0) {
      throw new D1ValidationError(`${name} must not be empty`, {
        name,
        received: value,
      });
    }
  }
}

