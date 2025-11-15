// D1 driver options type definitions

import { D1Database } from "./d1-database";

/**
 * D1 driver connection options.
 * 
 * @public
 */
export interface D1ConnectionOptions {
  database: D1Database;
}

/**
 * TypeORM-compatible error codes for D1 errors.
 * 
 * @public
 */
export type D1ErrorCode =
  | "D1_ERROR"
  | "SQLITE_CONSTRAINT_UNIQUE"
  | "SQLITE_CONSTRAINT_NOTNULL"
  | "SQLITE_CONSTRAINT_FOREIGNKEY"
  | "SQLITE_ERROR";

/**
 * Extended Error interface with D1-specific error information.
 * 
 * @public
 */
export interface D1Error extends Error {
  code: D1ErrorCode;
  cause?: Error;
  query?: string;
}

/**
 * Context information for D1 errors.
 * 
 * @public
 */
export interface D1ErrorContext {
  query?: string;
  parameters?: unknown[];
  operation?: string;
  timestamp?: Date;
}

