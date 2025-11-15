// D1 query runner implementation for TypeORM

import { AbstractSqliteQueryRunner } from "typeorm/driver/sqlite-abstract/AbstractSqliteQueryRunner";
import { DataSource } from "typeorm/data-source/DataSource";
import { QueryResult } from "typeorm/query-runner/QueryResult";
import { D1Driver } from "./d1-driver";
import { D1Result } from "../../types";
import { Table } from "typeorm/schema-builder/table/Table";
import { TableColumn } from "typeorm/schema-builder/table/TableColumn";
import { TableIndex } from "typeorm/schema-builder/table/TableIndex";
import { TableForeignKey } from "typeorm/schema-builder/table/TableForeignKey";
import { View } from "typeorm/schema-builder/view/View";
import { Broadcaster } from "typeorm/subscriber/Broadcaster";
import { D1ErrorHandler } from "../../utils/error-handler";
import { QueryNormalizer } from "../../utils/query-normalizer";
import { MetadataParser } from "../../utils/metadata-parser";
import { D1ConnectionError, D1TransactionError, D1ValidationError } from "../../errors";
import { D1Guards } from "../../utils/guards";

/**
 * D1QueryRunner executes queries against Cloudflare D1 database.
 * 
 * Extends AbstractSqliteQueryRunner to reuse SQLite-specific functionality
 * while implementing D1-specific query execution and transaction handling.
 * 
 * @public
 */
export class D1QueryRunner extends AbstractSqliteQueryRunner {
  driver: D1Driver;
  connection: DataSource;
  broadcaster: Broadcaster;
  
  private readonly transactionStatements: string[] = [];
  private readonly transactionBindings: unknown[][] = [];
  isTransactionActive = false;
  private readonly errorHandler = new D1ErrorHandler();

  /**
   * Creates a new D1QueryRunner instance.
   * 
   * @param driver - D1Driver instance
   */
  constructor(driver: D1Driver) {
    super();
    this.driver = driver;
    this.connection = driver.connection;
    this.broadcaster = new Broadcaster(this);
    (this as any).isTransactionActive = false;
  }

  /**
   * Creates/uses database connection from the connection pool to perform further operations.
   * 
   * For D1, this ensures the connection is established and returns the D1Database instance.
   * 
   * @returns Promise resolving to D1Database instance
   * @throws {D1ConnectionError} If connection fails
   */
  async connect(): Promise<D1Driver["databaseConnection"]> {
    D1Guards.assertDriverInitialized(this.driver);
    
    if (this.driver.databaseConnection) {
      return this.driver.databaseConnection;
    }
    
    try {
      await this.driver.connect();
    } catch (error) {
      throw new D1ConnectionError(
        "Failed to connect to D1 database",
        error instanceof Error ? error : new Error(String(error))
      );
    }
    
    D1Guards.assertConnectionEstablished(this.driver.databaseConnection);
    
    return this.driver.databaseConnection;
  }

  /**
   * Releases used database connection.
   * 
   * For D1, there's no connection to release, but we clean up transaction state
   * to prevent state from persisting across tests or query runner reuse.
   */
  async release(): Promise<void> {
    if (this.isTransactionActive) {
      this.isTransactionActive = false;
      (this as any).isTransactionActive = false;
      this.transactionStatements.length = 0;
      this.transactionBindings.length = 0;
    }
  }

  /**
   * Executes a given SQL query.
   * 
   * @param query - SQL query string
   * @param parameters - Optional query parameters
   * @param useStructuredResult - Whether to return structured result format
   * @returns Query result (array or QueryResult object)
   */
  async query(query: string, parameters?: unknown[], useStructuredResult?: false): Promise<unknown>;
  async query(query: string, parameters: unknown[] | undefined, useStructuredResult: true): Promise<QueryResult>;
  async query(query: string, parameters?: unknown[], useStructuredResult?: boolean): Promise<QueryResult | unknown> {
    const database = await this.connect();
    const normalizedQuery = QueryNormalizer.normalizeQuery(query);
    const queryType = QueryNormalizer.determineQueryType(normalizedQuery);
    
    // For transactions, track the query but execute immediately for results
    if (this.isTransactionActive) {
      this.transactionStatements.push(normalizedQuery);
      this.transactionBindings.push(parameters || []);
    }
    
    return this.executeQuery(
      database,
      normalizedQuery,
      parameters,
      useStructuredResult,
      queryType.isSelect,
      queryType.isInsert
    );
  }

  /**
   * Executes a prepared query against the D1 database.
   * 
   * @param database - The D1 database instance
   * @param query - The normalized SQL query
   * @param parameters - Query parameters
   * @param useStructuredResult - Whether to return structured result format
   * @param isSelect - Whether this is a SELECT query
   * @param isInsert - Whether this is an INSERT query
   * @returns Query result
   * @internal
   */
  private async executeQuery(
    database: D1Driver["databaseConnection"],
    query: string,
    parameters: unknown[] | undefined,
    useStructuredResult: boolean | undefined,
    isSelect: boolean,
    isInsert: boolean
  ): Promise<QueryResult | unknown> {
    let stmt = database.prepare(query);
    if (parameters && parameters.length > 0) {
      // Convert undefined to null for D1 compatibility (D1 doesn't support undefined)
      const normalizedParameters = parameters.map(p => p === undefined ? null : p);
      stmt = stmt.bind(...normalizedParameters);
    }
    
    try {
      if (isSelect) {
        const result = await stmt.all();
        this.errorHandler.checkD1Error(result, query);
        return this.mapD1Result(result, useStructuredResult);
      } else {
        const result = await stmt.run();
        this.errorHandler.checkD1Error(result, query);
        return this.mapD1RunResult(result, useStructuredResult, isInsert);
      }
    } catch (error: unknown) {
      // D1 may throw exceptions directly (not just in result.error)
      // Wrap and re-throw with better context
      throw this.errorHandler.wrapD1Exception(error, query);
    }
  }

  /**
   * Maps D1 result to TypeORM format (for SELECT queries).
   * 
   * @param result - The D1 result object
   * @param useStructuredResult - Whether to return structured result format
   * @returns Mapped result in TypeORM format
   * @internal
   */
  private mapD1Result(result: D1Result, useStructuredResult?: boolean): unknown[] | {
    raw: unknown[];
    records: unknown[];
    affected: number;
  } {
    if (useStructuredResult) {
      return {
        raw: result.results || [],
        records: result.results || [],
        affected: 0,
      };
    }
    return result.results || [];
  }

  /**
   * Maps D1 run result to TypeORM format (for INSERT/UPDATE/DELETE queries).
   * 
   * @param result - The D1 result object
   * @param useStructuredResult - Whether to return structured result format
   * @param isInsert - Whether this is an INSERT query
   * @returns Mapped result in TypeORM format
   * @internal
   */
  private mapD1RunResult(
    result: D1Result, 
    useStructuredResult?: boolean, 
    isInsert?: boolean
  ): number | undefined | {
    raw?: number;
    records: unknown[];
    affected: number;
  } {
    const lastRowId = result.meta?.last_row_id || 0;
    const affected = result.meta?.rows_written || result.meta?.changes || 0;
    
    if (useStructuredResult) {
      return {
        raw: isInsert ? lastRowId : undefined,
        records: [],
        affected: affected,
      };
    } else {
      // For INSERT queries, return lastID directly (like SQLite driver)
      // For UPDATE/DELETE, return undefined
      return isInsert ? lastRowId : undefined;
    }
  }

  /**
   * Starts a new transaction.
   * 
   * Note: D1 doesn't support true rollback - once a query is executed, it's committed.
   * This method tracks transaction state for TypeORM compatibility.
   * 
   * @param isolationLevel - Isolation level (not used for D1)
   * @throws {D1TransactionError} If a transaction is already active
   */
  async startTransaction(isolationLevel?: unknown): Promise<void> {
    if (this.isTransactionActive || (this as any).isTransactionActive) {
      throw new D1TransactionError(
        "Cannot start transaction: a transaction is already active",
        {
          hint: "Commit or rollback the current transaction first",
        }
      );
    }
    this.isTransactionActive = true;
    (this as any).isTransactionActive = true;
    this.transactionStatements.length = 0;
    this.transactionBindings.length = 0;
  }

  /**
   * Commits the current transaction.
   * 
   * Note: For D1, queries are already executed individually during the transaction.
   * This method only cleans up transaction state.
   * 
   * @throws {D1TransactionError} If no transaction is active
   */
  async commitTransaction(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new D1TransactionError("No active transaction to commit");
    }

    try {
      // For D1, we've already executed all queries individually during the transaction
      // D1's transaction model is different - queries are atomic within the transaction
      this.isTransactionActive = false;
      (this as any).isTransactionActive = false;
      this.transactionStatements.length = 0;
      this.transactionBindings.length = 0;
    } catch (error: unknown) {
      this.isTransactionActive = false;
      (this as any).isTransactionActive = false;
      this.transactionStatements.length = 0;
      this.transactionBindings.length = 0;
      throw error;
    }
  }

  /**
   * Rolls back the current transaction.
   * 
   * Note: D1 doesn't support true rollback - once a query is executed, it's committed.
   * This is a limitation of D1's transaction model. This method only cleans up
   * transaction state.
   * 
   * @throws {D1TransactionError} If no transaction is active
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new D1TransactionError("No active transaction to rollback");
    }
    // Note: D1 doesn't support true rollback - once a query is executed, it's committed
    // This method just cleans up the transaction state
    this.isTransactionActive = false;
    (this as any).isTransactionActive = false;
    this.transactionStatements.length = 0;
    this.transactionBindings.length = 0;
  }

  // Schema builder methods

  /**
   * Gets a single table by name.
   * 
   * @param tableName - Name of the table
   * @returns Table metadata or undefined if not found
   */
  async getTable(tableName: string): Promise<Table | undefined> {
    const query = `SELECT name, sql FROM sqlite_master WHERE type='table' AND name = ?`;
    const result = await this.query(query, [tableName]);
    
    if (!result || !Array.isArray(result) || result.length === 0) {
      return undefined;
    }
    
    const row = result[0] as { name: string; sql: string };
    if (!row.sql) {
      return undefined;
    }
    
    try {
      return MetadataParser.parseTableSql(row.sql, row.name);
    } catch (error) {
      console.warn(`Failed to parse table SQL for ${tableName}:`, error);
      return undefined;
    }
  }

  /**
   * Gets all tables (optionally filtered by names).
   * 
   * @param tableNames - Optional array of table names to filter
   * @returns Array of table metadata
   */
  async getTables(tableNames?: string[]): Promise<Table[]> {
    const query = tableNames
      ? `SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN (${tableNames.map(() => '?').join(',')})`
      : `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
    
    const result = await this.query(query, tableNames || undefined);
    
    if (!result || !Array.isArray(result)) {
      return [];
    }
    
    const tables: Table[] = [];
    for (const row of result) {
      const tableRow = row as { name: string; sql: string };
      if (tableRow.sql) {
        try {
          const table = MetadataParser.parseTableSql(tableRow.sql, tableRow.name);
          tables.push(table);
        } catch (error) {
          console.warn(`Failed to parse table SQL for ${tableRow.name}:`, error);
        }
      }
    }
    
    return tables;
  }

  /**
   * Gets a single view by name.
   * 
   * Note: D1 doesn't fully support views, so this always returns undefined.
   * 
   * @param viewName - Name of the view
   * @returns Always undefined for D1
   */
  async getView(viewName: string): Promise<View | undefined> {
    const query = `SELECT name, sql FROM sqlite_master WHERE type='view' AND name = ?`;
    const result = await this.query(query, [viewName]);
    if (!result || !Array.isArray(result) || result.length === 0) {
      return undefined;
    }
    return undefined;
  }

  /**
   * Gets all views (optionally filtered by names).
   * 
   * Note: D1 doesn't fully support views, so this always returns an empty array.
   * 
   * @param viewNames - Optional array of view names to filter
   * @returns Always empty array for D1
   */
  async getViews(viewNames?: string[]): Promise<View[]> {
    const query = viewNames
      ? `SELECT name, sql FROM sqlite_master WHERE type='view' AND name IN (${viewNames.map(() => '?').join(',')})`
      : `SELECT name, sql FROM sqlite_master WHERE type='view'`;
    const result = await this.query(query, viewNames || undefined);
    return [];
  }

  /**
   * Creates a new table.
   * 
   * @param table - Table metadata
   * @param ifNotExist - Whether to use IF NOT EXISTS clause
   */
  async createTable(table: Table, ifNotExist?: boolean): Promise<void> {
    const sql = this.buildCreateTableSql(table, ifNotExist);
    await this.query(sql);
  }

  /**
   * Drops a table.
   * 
   * @param tableOrName - Table metadata or table name
   * @param ifExist - Whether to use IF EXISTS clause
   */
  async dropTable(tableOrName: Table | string, ifExist?: boolean): Promise<void> {
    const tableName = typeof tableOrName === "string" ? tableOrName : (tableOrName as Table).name;
    const sql = `DROP TABLE ${ifExist ? "IF EXISTS " : ""}${this.escape(tableName)}`;
    await this.query(sql);
  }

  /**
   * Creates a new view.
   * 
   * Note: D1 has limited view support.
   * 
   * @param view - View metadata
   * @param syncWithMetadata - Whether to sync with metadata
   */
  async createView(view: View, syncWithMetadata?: boolean): Promise<void> {
    const sql = `CREATE VIEW ${this.escape(view.name)} AS ${view.expression}`;
    await this.query(sql);
  }

  /**
   * Drops a view.
   * 
   * @param viewOrName - View metadata or view name
   */
  async dropView(viewOrName: View | string): Promise<void> {
    const viewName = typeof viewOrName === "string" ? viewOrName : viewOrName.name;
    const sql = `DROP VIEW IF EXISTS ${this.escape(viewName)}`;
    await this.query(sql);
  }

  /**
   * Adds a column to a table.
   * 
   * @param tableOrName - Table metadata or table name
   * @param column - Column metadata
   */
  async addColumn(tableOrName: Table | string, column: TableColumn): Promise<void> {
    const tableName = typeof tableOrName === "string" ? tableOrName : tableOrName.name;
    const sql = `ALTER TABLE ${this.escape(tableName)} ADD COLUMN ${this.buildCreateColumnSql(column)}`;
    await this.query(sql);
  }

  /**
   * Drops a column from a table.
   * 
   * Note: SQLite/D1 doesn't support DROP COLUMN directly.
   * 
   * @param tableOrName - Table metadata or table name
   * @param columnOrName - Column metadata or column name
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async dropColumn(tableOrName: Table | string, columnOrName: TableColumn | string): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 doesn't support DROP COLUMN",
      {
        hint: "Use a migration to recreate the table",
        operation: "dropColumn",
      }
    );
  }

  /**
   * Changes a column in a table.
   * 
   * Note: SQLite/D1 has limited ALTER TABLE support.
   * 
   * @param tableOrName - Table metadata or table name
   * @param oldColumnOrName - Old column metadata or name
   * @param newColumn - New column metadata
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async changeColumn(
    tableOrName: Table | string,
    oldColumnOrName: TableColumn | string,
    newColumn: TableColumn
  ): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 has limited ALTER TABLE support",
      {
        hint: "Use a migration to recreate the table",
        operation: "changeColumn",
      }
    );
  }

  /**
   * Renames a column in a table.
   * 
   * Note: SQLite/D1 may not support RENAME COLUMN.
   * 
   * @param tableOrName - Table metadata or table name
   * @param oldColumnOrName - Old column metadata or name
   * @param newColumnName - New column name
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async renameColumn(
    tableOrName: Table | string,
    oldColumnOrName: TableColumn | string,
    newColumnName: string
  ): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 may not support RENAME COLUMN",
      {
        hint: "Use a migration to recreate the table",
        operation: "renameColumn",
      }
    );
  }

  /**
   * Adds a column to a table (alias for addColumn).
   * 
   * @param tableOrName - Table metadata or table name
   * @param column - Column metadata
   */
  async addColumnToTable(tableOrName: Table | string, column: TableColumn): Promise<void> {
    await this.addColumn(tableOrName, column);
  }

  /**
   * Adds multiple columns to a table.
   * 
   * @param tableOrName - Table metadata or table name
   * @param columns - Array of column metadata
   */
  async addColumns(tableOrName: Table | string, columns: TableColumn[]): Promise<void> {
    for (const column of columns) {
      await this.addColumn(tableOrName, column);
    }
  }

  /**
   * Drops multiple columns from a table.
   * 
   * Note: SQLite/D1 doesn't support DROP COLUMN directly.
   * 
   * @param tableOrName - Table metadata or table name
   * @param columns - Array of column metadata
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async dropColumns(tableOrName: Table | string, columns: TableColumn[]): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 doesn't support DROP COLUMN",
      {
        hint: "Use a migration to recreate the table",
        operation: "dropColumns",
      }
    );
  }

  /**
   * Creates an index on a table.
   * 
   * @param tableOrName - Table metadata or table name
   * @param index - Index metadata
   */
  async createIndex(
    tableOrName: Table | string,
    index: TableIndex
  ): Promise<void> {
    const tableName = typeof tableOrName === "string" ? tableOrName : tableOrName.name;
    const sql = this.buildCreateIndexSql(tableName, index);
    await this.query(sql);
  }

  /**
   * Drops an index from a table.
   * 
   * @param tableOrName - Table metadata or table name
   * @param indexOrName - Index metadata or index name
   * @throws {D1ValidationError} If index name is missing
   */
  async dropIndex(tableOrName: Table | string, indexOrName: TableIndex | string): Promise<void> {
    const tableName = typeof tableOrName === "string" ? tableOrName : tableOrName.name;
    const indexName = typeof indexOrName === "string" ? indexOrName : (indexOrName as TableIndex).name;
    if (!indexName) {
      throw new D1ValidationError("Index name is required", {
        operation: "dropIndex",
      });
    }
    const sql = `DROP INDEX IF EXISTS ${this.escape(indexName)}`;
    await this.query(sql);
  }

  /**
   * Creates a foreign key constraint.
   * 
   * Note: SQLite/D1 doesn't support adding foreign keys to existing tables.
   * 
   * @param tableOrName - Table metadata or table name
   * @param foreignKey - Foreign key metadata
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async createForeignKey(
    tableOrName: Table | string,
    foreignKey: TableForeignKey
  ): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 doesn't support adding foreign keys to existing tables",
      {
        hint: "Define them in CREATE TABLE",
        operation: "createForeignKey",
      }
    );
  }

  /**
   * Drops a foreign key constraint.
   * 
   * Note: SQLite/D1 doesn't support dropping foreign keys.
   * 
   * @param tableOrName - Table metadata or table name
   * @param foreignKeyOrName - Foreign key metadata or name
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async dropForeignKey(
    tableOrName: Table | string,
    foreignKeyOrName: TableForeignKey | string
  ): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 doesn't support dropping foreign keys",
      {
        hint: "Use a migration to recreate the table",
        operation: "dropForeignKey",
      }
    );
  }

  /**
   * Creates a primary key constraint.
   * 
   * Note: SQLite/D1 doesn't support adding primary keys to existing tables.
   * 
   * @param tableOrName - Table metadata or table name
   * @param columnNames - Array of column names
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async createPrimaryKey(
    tableOrName: Table | string,
    columnNames: string[]
  ): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 doesn't support adding primary keys to existing tables",
      {
        hint: "Define them in CREATE TABLE",
        operation: "createPrimaryKey",
      }
    );
  }

  /**
   * Drops a primary key constraint.
   * 
   * Note: SQLite/D1 doesn't support dropping primary keys.
   * 
   * @param tableOrName - Table metadata or table name
   * @throws {D1ValidationError} Always throws, as operation is not supported
   */
  async dropPrimaryKey(tableOrName: Table | string): Promise<void> {
    throw new D1ValidationError(
      "SQLite/D1 doesn't support dropping primary keys",
      {
        hint: "Use a migration to recreate the table",
        operation: "dropPrimaryKey",
      }
    );
  }

  /**
   * Clears all data from a table.
   * 
   * @param tableName - Table name
   */
  async clearTable(tableName: string): Promise<void> {
    await this.query(`DELETE FROM ${this.escape(tableName)}`);
  }

  /**
   * Clears all data from all tables in the database.
   */
  async clearDatabase(): Promise<void> {
    const tables = await this.getTables();
    for (const table of tables) {
      await this.clearTable(table.name);
    }
  }

  // Helper methods

  /**
   * Escapes a database identifier (table name, column name, etc.).
   * 
   * @param name - Identifier name
   * @returns Escaped identifier
   */
  protected escape(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Builds CREATE TABLE SQL statement.
   * 
   * @param table - Table metadata
   * @param ifNotExist - Whether to use IF NOT EXISTS clause
   * @returns SQL statement
   */
  protected buildCreateTableSql(table: Table, ifNotExist?: boolean): string {
    const primaryKeys = table.columns.filter((col) => col.isPrimary);
    const isCompositePrimary = primaryKeys.length > 1;
    
    const columns = table.columns
      .map((col) => this.buildCreateColumnSql(col, isCompositePrimary))
      .join(", ");
    
    // Always use IF NOT EXISTS for safety in D1/SQLite
    let sql = `CREATE TABLE IF NOT EXISTS ${this.escape(table.name)} (${columns}`;
    
    if (isCompositePrimary) {
      const pkColumns = primaryKeys.map((col) => this.escape(col.name)).join(", ");
      sql += `, PRIMARY KEY (${pkColumns})`;
    }
    
    sql += ")";
    
    return sql;
  }

  /**
   * Builds CREATE COLUMN SQL fragment.
   * 
   * @param column - Column metadata
   * @param isCompositePrimary - Whether this is part of a composite primary key
   * @returns SQL fragment
   */
  protected buildCreateColumnSql(column: TableColumn, isCompositePrimary: boolean = false): string {
    const type = this.normalizeType(column);
    let sql = `${this.escape(column.name)} ${type}`;

    // For SQLite, AUTOINCREMENT only works with INTEGER PRIMARY KEY
    if (column.isPrimary && column.isGenerated && column.generationStrategy === "increment" && !isCompositePrimary) {
      if (type === "INTEGER") {
        sql = `${this.escape(column.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      } else {
        sql = `${this.escape(column.name)} ${type} PRIMARY KEY`;
      }
    } else if (column.isPrimary && !column.generationStrategy && !isCompositePrimary) {
      sql += " PRIMARY KEY";
    }

    if (column.isUnique && !column.isPrimary) {
      sql += " UNIQUE";
    }

    if (!column.isNullable && !column.isPrimary) {
      sql += " NOT NULL";
    }

    if (column.default !== null && column.default !== undefined && !(column.isGenerated && column.generationStrategy === "increment")) {
      sql += ` DEFAULT ${this.normalizeDefault(column.default)}`;
    }

    return sql;
  }

  /**
   * Normalizes TypeORM column type to SQLite type.
   * 
   * @param column - Column metadata
   * @returns SQLite type string
   */
  protected normalizeType(column: TableColumn): string {
    const type = column.type.toLowerCase();
    
    const typeMap: Record<string, string> = {
      "int": "INTEGER",
      "integer": "INTEGER",
      "bigint": "INTEGER",
      "smallint": "INTEGER",
      "tinyint": "INTEGER",
      "float": "REAL",
      "double": "REAL",
      "real": "REAL",
      "decimal": "REAL",
      "numeric": "REAL",
      "boolean": "INTEGER",
      "bool": "INTEGER",
      "text": "TEXT",
      "string": "TEXT",
      "varchar": "TEXT",
      "char": "TEXT",
      "blob": "BLOB",
      "date": "TEXT",
      "datetime": "TEXT",
      "timestamp": "TEXT",
      "time": "TEXT",
    };
    
    const mappedType = typeMap[type];
    if (mappedType) {
      return mappedType;
    }
    
    return column.type.toUpperCase();
  }

  /**
   * Normalizes default value to SQL string.
   * 
   * @param defaultValue - Default value
   * @returns SQL string representation
   */
  protected normalizeDefault(defaultValue: unknown): string {
    if (typeof defaultValue === "string") {
      return `'${defaultValue.replace(/'/g, "''")}'`;
    }
    if (typeof defaultValue === "number") {
      return String(defaultValue);
    }
    if (typeof defaultValue === "boolean") {
      return defaultValue ? "1" : "0";
    }
    if (defaultValue === null) {
      return "NULL";
    }
    return String(defaultValue);
  }

  /**
   * Builds CREATE INDEX SQL statement.
   * 
   * @param tableName - Table name
   * @param index - Index metadata
   * @returns SQL statement
   */
  protected buildCreateIndexSql(tableName: string, index: TableIndex): string {
    const columns = index.columnNames.map((name) => this.escape(name)).join(", ");
    const unique = index.isUnique ? "UNIQUE " : "";
    const indexName = index.name || `IDX_${tableName}_${index.columnNames.join("_")}`;
    return `CREATE ${unique}INDEX IF NOT EXISTS ${this.escape(indexName)} ON ${this.escape(tableName)} (${columns})`;
  }

  /**
   * Builds DROP TABLE SQL statement.
   * 
   * @param tableName - Table name
   * @param ifExist - Whether to use IF EXISTS clause
   * @returns SQL statement
   */
  buildDropTableSql(tableName: string, ifExist?: boolean): string {
    D1Guards.assertNonEmptyString(tableName, "Table name");
    return `DROP TABLE ${ifExist ? "IF EXISTS " : ""}${this.escape(tableName)}`;
  }
}

