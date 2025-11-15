// D1 schema builder implementation for TypeORM

import { RdbmsSchemaBuilder } from "typeorm/schema-builder/RdbmsSchemaBuilder";
import { DataSource } from "typeorm/data-source/DataSource";

/**
 * D1SchemaBuilder handles schema operations (migrations, synchronization).
 * 
 * Uses TypeORM's RdbmsSchemaBuilder which works with SQLite-based databases.
 * 
 * @public
 */
export class D1SchemaBuilder extends RdbmsSchemaBuilder {
  /**
   * Creates a new D1SchemaBuilder instance.
   * 
   * @param connection - TypeORM DataSource instance
   */
  constructor(connection: DataSource) {
    super(connection);
  }

  /**
   * Build and execute schema synchronization.
   */
  async build(): Promise<void> {
    // The parent RdbmsSchemaBuilder handles most of the logic
    // We just need to ensure queries are executed via our query runner
    await super.build();
  }
}

