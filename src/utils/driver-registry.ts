import { DriverFactory } from "typeorm/driver/DriverFactory";
import { DataSource } from "typeorm/data-source/DataSource";
import { D1Driver } from "../driver/d1";
import { D1Database } from "../types";
import { D1ConnectionError } from "../errors";

/**
 * Manages D1 driver registration with TypeORM's DriverFactory.
 * Provides better isolation than global prototype patching.
 */
export class D1DriverRegistry {
  private static isRegistered = false;
  private static originalCreate: ((connection: DataSource) => any) | null = null;
  private static registrationCount = 0;

  /**
   * Registers the D1 driver with TypeORM's DriverFactory.
   * Safe to call multiple times (idempotent).
   */
  static register(): void {
    if (this.isRegistered) {
      this.registrationCount++;
      return; // Already registered
    }

    // Store original implementation
    this.originalCreate = DriverFactory.prototype.create;
    
    // Patch DriverFactory to recognize D1 connections
    DriverFactory.prototype.create = function(connection: DataSource) {
      const driverOptions = (connection.options as { driver?: { database?: D1Database } }).driver;
      
      // Check if this is a D1 connection
      if (driverOptions?.database && typeof driverOptions.database.prepare === "function") {
        return new D1Driver(connection);
      }
      
      // Fall back to original implementation
      if (D1DriverRegistry.originalCreate) {
        return D1DriverRegistry.originalCreate.call(this, connection);
      }
      
      // Should never reach here, but provide fallback
      throw new D1ConnectionError(
        "DriverFactory.create() called but no original implementation available"
      );
    };
    
    this.isRegistered = true;
    this.registrationCount = 1;
  }

  /**
   * Unregisters the D1 driver from TypeORM's DriverFactory.
   * Only unregisters if all registrations have been unregistered.
   */
  static unregister(): void {
    if (!this.isRegistered) {
      return; // Not registered
    }

    this.registrationCount--;
    
    if (this.registrationCount <= 0) {
      // Restore original implementation
      if (this.originalCreate) {
        DriverFactory.prototype.create = this.originalCreate;
      }
      
      this.isRegistered = false;
      this.registrationCount = 0;
      this.originalCreate = null;
    }
  }

  /**
   * Checks if the D1 driver is currently registered.
   */
  static getIsRegistered(): boolean {
    return this.isRegistered;
  }
}

