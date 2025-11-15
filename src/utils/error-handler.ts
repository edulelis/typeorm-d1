import { D1Result, D1ErrorCode } from "../types";
import { D1QueryError } from "../errors";
import { CONSTANTS } from "./constants";

/**
 * Handles D1 error mapping and formatting.
 * Extracted from D1QueryRunner for better testability and reusability.
 * 
 * @internal
 */
export class D1ErrorHandler {

  /**
   * Maps D1 error messages to TypeORM-compatible error codes.
   * 
   * @param errorMessage - The error message from D1
   * @param defaultCode - Default error code if no match is found
   * @returns TypeORM-compatible error code
   */
  mapErrorCode(errorMessage: string, defaultCode: D1ErrorCode = "D1_ERROR"): D1ErrorCode {
    const lowerMessage = errorMessage.toLowerCase();
    
    if (lowerMessage.includes('unique constraint') || lowerMessage.includes('unique')) {
      return "SQLITE_CONSTRAINT_UNIQUE";
    }
    if (lowerMessage.includes('not null constraint') || lowerMessage.includes('not null')) {
      return "SQLITE_CONSTRAINT_NOTNULL";
    }
    if (lowerMessage.includes('foreign key constraint') || lowerMessage.includes('foreign key')) {
      return "SQLITE_CONSTRAINT_FOREIGNKEY";
    }
    if (lowerMessage.includes('no such table') || 
        lowerMessage.includes('already exists') || 
        lowerMessage.includes('duplicate')) {
      return "SQLITE_ERROR";
    }
    
    return defaultCode;
  }

  /**
   * Extracts error message from various error formats.
   * 
   * @param error - The error object
   * @returns Extracted error message
   */
  extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Check for cause.message first (Miniflare SqliteError format)
      if (error.cause && typeof error.cause === 'object' && 'message' in error.cause) {
        return String(error.cause.message);
      }
      return error.message;
    }
    if (error && typeof error === 'object') {
      // Handle Miniflare SqliteError format
      if ('cause' in error && error.cause && typeof error.cause === 'object' && 'message' in error.cause) {
        return String(error.cause.message);
      }
      if ('message' in error) {
        return String(error.message);
      }
    }
    return String(error);
  }

  /**
   * Builds a formatted error message with query context.
   * 
   * @param errorMessage - The base error message
   * @param query - Optional SQL query for context
   * @returns Formatted error message
   */
  buildErrorMessage(errorMessage: string, query?: string): string {
    let message = `D1 Error: ${errorMessage}`;
    if (query) {
      const queryPreview = query.length > CONSTANTS.QUERY_PREVIEW_MAX_LENGTH 
        ? query.substring(0, CONSTANTS.QUERY_PREVIEW_MAX_LENGTH) + '...' 
        : query;
      message += `\nQuery: ${queryPreview}`;
    }
    return message;
  }

  /**
   * Checks if D1 result contains an error and throws if it does.
   * Provides better error messages with context.
   * 
   * @param result - The D1 result object
   * @param query - Optional SQL query for context
   * @throws {D1Error} If result contains an error
   */
  checkD1Error(result: D1Result, query?: string): void {
    if (!result.success && result.error) {
      const errorCode = this.mapErrorCode(result.error);
      const errorMessage = this.buildErrorMessage(result.error, query);
      throw new D1QueryError(errorMessage, errorCode, query);
    }
  }

  /**
   * Wraps D1 exceptions (thrown directly, not in result.error) with better context.
   * 
   * @param error - The error object
   * @param query - Optional SQL query for context
   * @returns Wrapped error with D1-specific information
   */
  wrapD1Exception(error: unknown, query?: string): D1QueryError {
    const errorMessage = this.extractErrorMessage(error);
    
    // Determine error code
    let errorCode: D1ErrorCode = "D1_ERROR";
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code);
      if (['D1_ERROR', 'SQLITE_CONSTRAINT_UNIQUE', 'SQLITE_CONSTRAINT_NOTNULL', 
           'SQLITE_CONSTRAINT_FOREIGNKEY', 'SQLITE_ERROR'].includes(code)) {
        errorCode = code as D1ErrorCode;
      }
    }
    
    const mappedCode = this.mapErrorCode(errorMessage, errorCode);
    const fullMessage = this.buildErrorMessage(errorMessage, query);
    
    const cause = error instanceof Error ? error : undefined;
    const wrappedError = new D1QueryError(fullMessage, mappedCode, query, cause);
    
    // Preserve original stack trace if available
    if (error instanceof Error && error.stack) {
      wrappedError.stack = error.stack;
    }
    
    return wrappedError;
  }
}

