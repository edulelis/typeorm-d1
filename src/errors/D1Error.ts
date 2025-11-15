import { D1ErrorCode } from "../types";

/**
 * Base error class for all D1 driver errors.
 * Provides structured error information with code, context, and query details.
 * 
 * @public
 */
export class D1DriverError extends Error {
  readonly code: D1ErrorCode;
  readonly cause?: Error;
  readonly query?: string;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: D1ErrorCode = "D1_ERROR",
    options?: {
      cause?: Error;
      query?: string;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "D1DriverError";
    this.code = code;
    this.cause = options?.cause;
    this.query = options?.query;
    this.context = options?.context;

    // Preserve stack trace (V8/Node.js specific, safe to ignore in other environments)
    const ErrorConstructor = Error as unknown as {
      captureStackTrace?: (error: Error, constructor: typeof D1DriverError) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === "function") {
      ErrorConstructor.captureStackTrace(this, D1DriverError);
    }
  }
}

/**
 * Error thrown when connection-related operations fail.
 * 
 * @public
 */
export class D1ConnectionError extends D1DriverError {
  constructor(message: string, cause?: Error) {
    super(message, "D1_ERROR", { cause });
    this.name = "D1ConnectionError";
  }
}

/**
 * Error thrown when validation fails (e.g., invalid options, parameters).
 * 
 * @public
 */
export class D1ValidationError extends D1DriverError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "D1_ERROR", { context });
    this.name = "D1ValidationError";
  }
}

/**
 * Error thrown when query execution fails.
 * Includes query context and error code mapping.
 * 
 * @public
 */
export class D1QueryError extends D1DriverError {
  constructor(
    message: string,
    code: D1ErrorCode,
    query?: string,
    cause?: Error
  ) {
    super(message, code, { query, cause });
    this.name = "D1QueryError";
  }
}

/**
 * Error thrown when transaction operations fail.
 * 
 * @public
 */
export class D1TransactionError extends D1DriverError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "D1_ERROR", { context });
    this.name = "D1TransactionError";
  }
}

