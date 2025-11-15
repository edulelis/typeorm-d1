// D1 database type definitions

/**
 * Cloudflare D1 database interface.
 * 
 * This interface matches the D1Database API provided by Cloudflare Workers.
 * 
 * @public
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

/**
 * D1 prepared statement interface.
 * 
 * @public
 */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

/**
 * D1 query result interface.
 * 
 * @public
 */
export interface D1Result<T = unknown> {
  success: boolean;
  meta: {
    duration: number;
    size_after?: number;
    rows_read: number;
    rows_written: number;
    last_row_id?: number;
    changed_db?: boolean;
    changes?: number;
  };
  results?: T[];
  error?: string;
}

/**
 * D1 exec result interface.
 * 
 * @public
 */
export interface D1ExecResult {
  count: number;
  duration: number;
}

