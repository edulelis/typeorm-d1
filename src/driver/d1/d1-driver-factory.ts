// D1 driver factory implementation for TypeORM

import { DriverFactory } from "typeorm/driver/DriverFactory";
import { DataSource } from "typeorm/data-source/DataSource";
import { D1Driver } from "./d1-driver";
import { D1ValidationError } from "../../errors";

/**
 * D1DriverFactory creates D1Driver instances for TypeORM.
 * 
 * This factory allows TypeORM to instantiate the driver when
 * a D1Database instance is provided in driver options.
 * 
 * @public
 */
export class D1DriverFactory implements DriverFactory {
  /**
   * Creates a new driver depend on a given connection's driver type.
   * 
   * @param connection - TypeORM DataSource instance
   * @returns D1Driver instance
   * @throws {D1ValidationError} If database instance is missing
   */
  create(connection: DataSource): D1Driver {
    const driverOptions = (connection.options as any).driver as any;
    if (!driverOptions?.database) {
      throw new D1ValidationError(
        "D1DriverFactory requires driver.database option with D1Database instance",
        {
          received: typeof driverOptions,
        }
      );
    }
    return new D1Driver(connection);
  }
}

