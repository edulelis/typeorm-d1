// D1 DataSource factory function

import { DataSource, DataSourceOptions } from "typeorm";
import { D1Database } from "../types";
import { D1DriverRegistry } from "../utils/driver-registry";

/**
 * Creates a DataSource configured for Cloudflare D1.
 * 
 * This is the recommended way to create a TypeORM DataSource for D1.
 * It automatically registers the D1 driver and configures it correctly.
 * 
 * @example
 * ```typescript
 * import { createD1DataSource } from "typeorm-d1";
 * import { User } from "./entity/User";
 * 
 * const dataSource = createD1DataSource({
 *   database: env.DB, // D1 database instance from Cloudflare
 *   entities: [User],
 *   synchronize: true,
 * });
 * 
 * await dataSource.initialize();
 * ```
 * 
 * @param options - DataSource options with D1 database instance
 * @param options.database - The D1Database instance from Cloudflare (e.g., `env.DB`)
 * @param options.entities - Array of entity classes
 * @param options.synchronize - Whether to auto-sync schema (default: false)
 * @returns A configured DataSource instance ready to initialize
 * 
 * @throws {D1ValidationError} If database instance is invalid
 * @throws {D1ConnectionError} If driver registration fails
 * 
 * @public
 */
export function createD1DataSource(
  options: Omit<DataSourceOptions, "type" | "database"> & {
    database: D1Database;
  }
): DataSource {
  // Register D1 driver (idempotent)
  D1DriverRegistry.register();
  
  try {
    // Create DataSource with sqlite type (since D1 is SQLite-based)
    // Our registered DriverFactory will intercept and use D1Driver instead
    const dataSourceOptions: DataSourceOptions = {
      ...options,
      type: "sqlite",
      database: ":memory:", // Dummy database path (not used with D1)
      driver: {
        database: options.database,
      },
    } as DataSourceOptions;
    
    const dataSource = new DataSource(dataSourceOptions);
    
    return dataSource;
  } catch (error) {
    throw error;
  }
}

