import { DataSource } from "typeorm";
import { D1BatchStatement, D1Result } from "../types";
import { D1QueryRunner } from "../driver/d1";
import { D1ValidationError } from "../errors";

/**
 * Executes an explicit atomic D1 batch using a DataSource.
 *
 * This is not a TypeORM transaction replacement. It is a convenience wrapper
 * around D1Database.batch() for callers that can express their work as prepared
 * SQL statements up front.
 *
 * @public
 */
export async function executeD1Batch(
  dataSource: DataSource,
  statements: D1BatchStatement[]
): Promise<D1Result[]> {
  const queryRunner = dataSource.createQueryRunner();
  try {
    if (!(queryRunner instanceof D1QueryRunner)) {
      throw new D1ValidationError("executeD1Batch requires a D1QueryRunner");
    }
    return await queryRunner.executeBatch(statements);
  } finally {
    await queryRunner.release();
  }
}
