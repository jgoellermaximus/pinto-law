import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema/legal";

// ---------------------------------------------------------------------------
// Neon Postgres connection via serverless driver (HTTP)
// Works on Vercel Edge and Node.js runtimes.
// ---------------------------------------------------------------------------

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });

// Re-export schema for convenience
export { schema };
