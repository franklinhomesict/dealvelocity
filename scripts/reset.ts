import "./env";
import postgres from "postgres";
if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
console.log("✓ database reset");
await sql.end();
