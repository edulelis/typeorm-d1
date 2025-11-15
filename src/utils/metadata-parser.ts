import { Table } from "typeorm/schema-builder/table/Table";
import { TableColumn } from "typeorm/schema-builder/table/TableColumn";
import { TableIndex } from "typeorm/schema-builder/table/TableIndex";
import { TableForeignKey } from "typeorm/schema-builder/table/TableForeignKey";
import { D1ValidationError } from "../errors";

/**
 * Parses CREATE TABLE SQL statements to build TypeORM Table objects.
 * Handles SQLite/D1 CREATE TABLE syntax.
 */
export class MetadataParser {
  /**
   * Parses a CREATE TABLE SQL statement into a Table object.
   * 
   * @param sql - The CREATE TABLE SQL statement
   * @param tableName - The name of the table
   * @returns A Table object representing the parsed table
   */
  static parseTableSql(sql: string, tableName: string): Table {
    // Remove CREATE TABLE IF NOT EXISTS / CREATE TABLE prefix
    const normalizedSql = sql
      .replace(/^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?/i, "")
      .trim();
    
    // Extract table name and column definitions
    const match = normalizedSql.match(/^"?(.+?)"?\s*\((.+)\)/s);
    if (!match) {
      throw new D1ValidationError(
        "Invalid CREATE TABLE SQL",
        {
          sql: sql.substring(0, 200), // Preview only
          tableName,
        }
      );
    }
    
    const extractedTableName = match[1].replace(/"/g, "");
    const columnDefinitions = match[2];
    
    // Parse columns
    const columns = this.parseColumns(columnDefinitions);
    
    // Parse indexes (from separate queries - not in CREATE TABLE)
    const indexes: TableIndex[] = [];
    
    // Parse foreign keys (from column definitions)
    const foreignKeys: TableForeignKey[] = [];
    
    return new Table({
      name: extractedTableName,
      columns,
      indices: indexes,
      foreignKeys,
    });
  }

  /**
   * Parses column definitions from CREATE TABLE SQL.
   * 
   * @param columnDefinitions - The column definitions string
   * @returns Array of TableColumn objects
   */
  private static parseColumns(columnDefinitions: string): TableColumn[] {
    const columns: TableColumn[] = [];
    
    // Split by comma, but respect parentheses (for CHECK constraints, etc.)
    const parts = this.splitColumnDefinitions(columnDefinitions);
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      // Skip table-level constraints (PRIMARY KEY, FOREIGN KEY, etc.)
      if (trimmed.toUpperCase().startsWith("PRIMARY KEY") ||
          trimmed.toUpperCase().startsWith("FOREIGN KEY") ||
          trimmed.toUpperCase().startsWith("UNIQUE") ||
          trimmed.toUpperCase().startsWith("CHECK")) {
        continue;
      }
      
      const column = this.parseColumnDefinition(trimmed);
      if (column) {
        columns.push(column);
      }
    }
    
    return columns;
  }

  /**
   * Parses a single column definition.
   * 
   * @param definition - The column definition string
   * @returns A TableColumn object or null if parsing fails
   */
  private static parseColumnDefinition(definition: string): TableColumn | null {
    // Pattern: "columnName" TYPE [CONSTRAINTS]
    const match = definition.match(/^"?(.+?)"?\s+(\w+)/);
    if (!match) {
      return null;
    }
    
    const columnName = match[1].replace(/"/g, "");
    const type = match[2].toUpperCase();
    
    // Determine column properties
    const isPrimary = /PRIMARY\s+KEY/i.test(definition);
    const isUnique = /UNIQUE/i.test(definition) && !isPrimary;
    const isNullable = !/NOT\s+NULL/i.test(definition);
    const isGenerated = /AUTOINCREMENT/i.test(definition);
    const generationStrategy = isGenerated ? "increment" : undefined;
    
    // Extract default value
    const defaultMatch = definition.match(/DEFAULT\s+(.+?)(?:\s|$)/i);
    const defaultValue = defaultMatch ? this.parseDefaultValue(defaultMatch[1]) : undefined;
    
    return new TableColumn({
      name: columnName,
      type: this.normalizeType(type),
      isPrimary,
      isUnique,
      isNullable,
      isGenerated,
      generationStrategy,
      default: defaultValue,
    });
  }

  /**
   * Normalizes SQLite type to TypeORM type.
   * 
   * @param sqliteType - The SQLite type string
   * @returns The normalized TypeORM type
   */
  private static normalizeType(sqliteType: string): string {
    const typeMap: Record<string, string> = {
      "INTEGER": "int",
      "REAL": "float",
      "TEXT": "text",
      "BLOB": "blob",
      "NUMERIC": "numeric",
    };
    
    return typeMap[sqliteType.toUpperCase()] || sqliteType.toLowerCase();
  }

  /**
   * Parses a default value from SQL.
   * 
   * @param value - The default value string from SQL
   * @returns The parsed default value
   */
  private static parseDefaultValue(value: string): unknown {
    const trimmed = value.trim();
    
    // NULL
    if (trimmed.toUpperCase() === "NULL") {
      return null;
    }
    
    // String (quoted)
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1).replace(/''/g, "'");
    }
    
    // Number
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    
    if (/^-?\d+\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // Boolean (SQLite uses 0/1)
    if (trimmed === "0" || trimmed === "1") {
      return trimmed === "1";
    }
    
    // Function calls (e.g., datetime('now'))
    if (/^\w+\(/.test(trimmed)) {
      return trimmed; // Return as string, TypeORM will handle
    }
    
    return trimmed;
  }

  /**
   * Splits column definitions respecting parentheses.
   * 
   * @param definitions - The column definitions string
   * @returns Array of individual column definition strings
   */
  private static splitColumnDefinitions(definitions: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    
    for (let i = 0; i < definitions.length; i++) {
      const char = definitions[i];
      
      if (char === "(") {
        depth++;
        current += char;
      } else if (char === ")") {
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts;
  }
}

