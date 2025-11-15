import { D1Database } from "../src/types";
export declare function getTestDatabase(): Promise<D1Database>;
export declare function cleanupDatabase(): Promise<void>;
export declare function closeDatabase(): Promise<void>;
