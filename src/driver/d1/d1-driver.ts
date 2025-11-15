// D1 driver implementation for TypeORM

import { DataSource } from "typeorm/data-source/DataSource";
import { DataSourceOptions } from "typeorm";
import { AbstractSqliteDriver } from "typeorm/driver/sqlite-abstract/AbstractSqliteDriver";
import { D1QueryRunner } from "./d1-query-runner";
import { D1Database } from "../../types";
import { ReplicationMode } from "typeorm/driver/types/ReplicationMode";
import { QueryRunner } from "typeorm/query-runner/QueryRunner";
import { ColumnType } from "typeorm/driver/types/ColumnTypes";
import { D1ValidationError, D1ConnectionError } from "../../errors";
import { D1Guards } from "../../utils/guards";

/**
 * D1Driver connects TypeORM to Cloudflare D1 database.
 * 
 * Extends AbstractSqliteDriver since D1 is SQLite-based and shares many
 * characteristics with SQLite. This driver handles connection management,
 * query runner creation, and D1-specific configurations.
 * 
 * @public
 */
export class D1Driver extends AbstractSqliteDriver {
  /**
   * D1 database instance provided via driver options.
   * Set during createDatabaseConnection().
   */
  declare databaseConnection: D1Database;

  /**
   * Connection options extended with D1-specific driver configuration.
   */
  declare options: DataSourceOptions & {
    driver?: {
      database: D1Database;
    };
  };

  /**
   * Creates a new D1Driver instance.
   * 
   * @param connection - TypeORM DataSource instance
   * @throws {D1ValidationError} If database instance is missing or invalid
   */
  constructor(connection: DataSource) {
    super(connection);
    this.connection = connection;
    this.options = connection.options;
    
    const driverOptions = this.options.driver;
    if (!driverOptions?.database) {
      throw new D1ValidationError(
        "D1 database instance must be provided in driver options",
        {
          hint: "Use { driver: { database: env.DB } }",
          received: typeof driverOptions,
        }
      );
    }

    if (!D1Guards.isD1Database(driverOptions.database)) {
      throw new D1ValidationError(
        "Invalid D1 database instance",
        {
          hint: "Expected D1Database with prepare(), batch(), and exec() methods",
          received: typeof driverOptions.database,
        }
      );
    }
    
    // Extend supported data types to include timestamp (mapped to TEXT in SQLite)
    if (this.supportedDataTypes && !this.supportedDataTypes.includes("timestamp")) {
      this.supportedDataTypes.push("timestamp");
    }
  }

  /**
   * Creates connection with the database.
   * 
   * For D1, this validates and returns the D1Database instance provided
   * in driver options. There's no actual connection establishment needed
   * since D1 is serverless.
   * 
   * @returns Promise resolving to D1Database instance
   * @throws {D1ValidationError} If database instance is invalid
   */
  protected async createDatabaseConnection(): Promise<D1Database> {
    const driverOptions = this.options.driver;
    const database = driverOptions?.database;
    
    if (!D1Guards.isD1Database(database)) {
      throw new D1ValidationError(
        "Invalid D1 database instance. Expected D1Database with prepare(), batch(), and exec() methods.",
        {
          received: typeof database,
        }
      );
    }
    
    return database;
  }

  /**
   * Closes connection with database.
   * 
   * For D1, there's no persistent connection to close, so this is a no-op.
   * We clean up internal state for consistency.
   */
  async disconnect(): Promise<void> {
    this.queryRunner = undefined;
    this.databaseConnection = undefined as unknown as D1Database;
  }

  /**
   * Creates a query runner used to execute database queries.
   * 
   * For D1, we create a new query runner for each request to avoid
   * transaction state conflicts in concurrent scenarios. This is safe
   * since there's no connection pooling overhead.
   * 
   * @param mode - Replication mode (not used for D1)
   * @returns New D1QueryRunner instance
   */
  createQueryRunner(mode: ReplicationMode): QueryRunner {
    return new D1QueryRunner(this);
  }

  /**
   * Makes any action after connection (e.g. create extensions in Postgres driver).
   * 
   * For D1, we enable foreign key constraints which are disabled by default
   * in SQLite. This is important for enforcing referential integrity.
   */
  async afterConnect(): Promise<void> {
    const queryRunner = this.createQueryRunner("master");
    try {
      await queryRunner.query("PRAGMA foreign_keys = ON");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Normalizes type definition for D1/SQLite.
   * 
   * @param column - Column metadata
   * @returns Normalized SQLite type string
   */
  normalizeType(column: {
    type?: ColumnType;
    length?: number | string;
    precision?: number | null;
    scale?: number;
  }): string {
    // For D1/Edge runtime, Buffer is not available, so we skip Buffer-specific handling
    // The base class will handle blob types via the column type string
    return super.normalizeType(column);
  }

  /**
   * Builds table name with schema and database prefix.
   * 
   * For SQLite/D1, we don't support multiple databases or schemas,
   * so this returns the table name as-is.
   * 
   * @param tableName - Table name
   * @param _schema - Schema name (ignored for D1)
   * @param _database - Database name (ignored for D1)
   * @returns Table name without modifications
   */
  buildTableName(tableName: string, _schema?: string, _database?: string): string {
    return tableName;
  }

  /**
   * Transaction support level for D1.
   * 
   * D1 supports simple transactions via batch API, but not nested transactions.
   */
  transactionSupport: "simple" | "nested" | "none" = "simple";
}

