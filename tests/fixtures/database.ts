import { DataSource } from "typeorm";
import { createD1DataSource } from "../../src/factory";
import { D1Database } from "../../src/types";
import { getTestDatabase } from "../setup";

/**
 * Database setup utilities for tests
 */

export async function createTestDataSource(entities: any[]): Promise<DataSource> {
  const db = await getTestDatabase();
  return createD1DataSource({
    database: db,
    entities,
    synchronize: true,
    logging: false,
  });
}

export async function createTestDataSourceWithOptions(
  entities: any[],
  options: Partial<{
    synchronize: boolean;
    logging: boolean;
  }> = {}
): Promise<DataSource> {
  const db = await getTestDatabase();
  return createD1DataSource({
    database: db,
    entities,
    synchronize: options.synchronize ?? true,
    logging: options.logging ?? false,
  });
}

export async function cleanupDataSource(dataSource: DataSource): Promise<void> {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}

export async function resetDatabase(db: D1Database): Promise<void> {
  // Get all tables
  const tables = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all<{ name: string }>();

  if (tables.results) {
    // Drop all tables
    for (const table of tables.results) {
      await db.prepare(`DROP TABLE IF EXISTS ${table.name}`).run();
    }
  }
}

/**
 * Clear all data from tables in a DataSource
 * Uses raw SQL to avoid TypeORM's restriction on empty delete criteria
 */
export async function clearAllTables(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    // Get all tables
    const tables = await queryRunner.getTables();
    
    // Disable foreign key checks temporarily for SQLite
    await queryRunner.query("PRAGMA foreign_keys = OFF");
    
    // Delete all data from each table
    for (const table of tables) {
      try {
        await queryRunner.query(`DELETE FROM ${queryRunner.escape(table.name)}`);
      } catch (error) {
        // Ignore errors for tables that don't exist or have no data
      }
    }
    
    // Re-enable foreign key checks
    await queryRunner.query("PRAGMA foreign_keys = ON");
  } finally {
    await queryRunner.release();
  }
}

