/**
 * Normalizes SQL queries for D1 compatibility.
 */
export class QueryNormalizer {
  /**
   * Normalizes a SQL query string for D1 compatibility.
   * Currently handles DROP INDEX statements by adding IF EXISTS clause.
   * 
   * @param query - The SQL query string to normalize
   * @returns The normalized query string
   */
  static normalizeQuery(query: string): string {
    // Normalize DROP INDEX statements to use IF EXISTS for safety
    // This prevents errors when trying to drop indices that don't exist
    if (query.trim().toUpperCase().startsWith("DROP INDEX")) {
      // Check if IF EXISTS is already present
      if (!query.toUpperCase().includes("IF EXISTS")) {
        // Insert IF EXISTS after DROP INDEX
        return query.replace(/^DROP INDEX\s+/i, "DROP INDEX IF EXISTS ");
      }
    }
    return query;
  }

  /**
   * Determines the type of SQL query (SELECT, INSERT, etc.).
   * 
   * @param query - The SQL query string
   * @returns Object indicating if query is SELECT or INSERT
   */
  static determineQueryType(query: string): { isSelect: boolean; isInsert: boolean } {
    const trimmedQuery = query.trim().toUpperCase();
    return {
      isSelect: trimmedQuery.startsWith("SELECT") || 
                trimmedQuery.startsWith("WITH") ||
                trimmedQuery.startsWith("PRAGMA"),
      isInsert: trimmedQuery.startsWith("INSERT"),
    };
  }
}

