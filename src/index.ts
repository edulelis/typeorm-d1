/**
 * TypeORM Driver for Cloudflare D1
 * 
 * This package provides a custom TypeORM driver that enables using
 * Cloudflare D1 (SQLite-based serverless database) with TypeORM.
 * 
 * @example
 * ```typescript
 * import { createD1DataSource } from "typeorm-d1";
 * import { User } from "./entity/User";
 * 
 * export default {
 *   async fetch(request: Request, env: Env): Promise<Response> {
 *     const dataSource = createD1DataSource({
 *       database: env.DB, // D1 database instance from Cloudflare
 *       entities: [User],
 *       synchronize: true,
 *     });
 * 
 *     await dataSource.initialize();
 *     
 *     // Use TypeORM as normal
 *     const userRepo = dataSource.getRepository(User);
 *     const users = await userRepo.find();
 *     
 *     return new Response(JSON.stringify(users), {
 *       headers: { "Content-Type": "application/json" },
 *     });
 *   }
 * };
 * ```
 */

// Driver exports
export { D1Driver, D1QueryRunner, D1DriverFactory, D1SchemaBuilder } from "./driver/d1";

// Factory exports
export { createD1DataSource } from "./factory";

// Type exports
export * from "./types";

// Error exports
export * from "./errors";

// Utils exports (internal, but exported for advanced usage)
export { D1DriverRegistry } from "./utils/driver-registry";
export { D1ErrorHandler } from "./utils/error-handler";
export { QueryNormalizer } from "./utils/query-normalizer";
export { MetadataParser } from "./utils/metadata-parser";
export { D1Guards } from "./utils/guards";
export { CONSTANTS } from "./utils/constants";
