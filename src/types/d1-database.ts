// D1 database type definitions

export type D1Bindable =
  | string
  | number
  | null
  | ArrayBuffer
  | ArrayBufferView;

export type D1SessionConstraint = "first-primary" | "first-unconstrained";
export type D1SessionBookmark = string;

/**
 * Cloudflare D1 database interface.
 *
 * This mirrors the stable subset of the Cloudflare Workers D1 API used by the
 * driver, while keeping optional newer/session APIs available for consumers.
 *
 * @public
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  withSession?(
    constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint
  ): D1DatabaseSession;
  dump?(): Promise<ArrayBuffer>;
}

/**
 * D1 database session interface.
 *
 * @public
 */
export interface D1DatabaseSession {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  getBookmark(): D1SessionBookmark | null;
}

/**
 * D1 prepared statement interface.
 * 
 * @public
 */
export interface D1PreparedStatement {
  bind(...values: D1Bindable[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(options?: { columnNames?: boolean }): Promise<T[]>;
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
