/**
 * Shared constants for D1 driver.
 * 
 * @internal
 */
export const CONSTANTS = {
  /**
   * Maximum length for query preview in error messages.
   */
  QUERY_PREVIEW_MAX_LENGTH: 200,

  /**
   * Default batch size for operations (if needed in future).
   */
  DEFAULT_BATCH_SIZE: 100,

  /**
   * Maximum retry attempts for transient errors (if needed in future).
   */
  MAX_RETRY_ATTEMPTS: 3,
} as const;

