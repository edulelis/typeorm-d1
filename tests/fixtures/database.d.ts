import { DataSource } from "typeorm";
import { D1Database } from "../../src/types";
/**
 * Database setup utilities for tests
 */
export declare function createTestDataSource(entities: any[]): Promise<DataSource>;
export declare function createTestDataSourceWithOptions(entities: any[], options?: Partial<{
    synchronize: boolean;
    logging: boolean;
}>): Promise<DataSource>;
export declare function cleanupDataSource(dataSource: DataSource): Promise<void>;
export declare function resetDatabase(db: D1Database): Promise<void>;
