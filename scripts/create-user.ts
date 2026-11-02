/** Usage: npm run user:create -- <email> "<name>" <owner|acquisitions|viewer>   (password read from NEW_USER_PASSWORD) */
import "./env";
import postgres from "postgres";
import bcrypt from "bcryptjs";

const [email, name, role = "acquisitions"] = process.argv.slice(2);
const password = process.env.NEW_USER_PASSWORD;
if (!email || !name || !password || password.length < 12) {
  console.error('Usage: NEW_USER_PASSWORD=<12+ chars> npm run user:create -- <email> "<name>" <owner|acquisitions|viewer>');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
await sql`insert into users (email, name, password_hash, role) values (${email.toLowerCase()}, ${name}, ${await bcrypt.hash(password, 12)}, ${role})`;
console.log(`✓ created ${role} ${email}`);
await sql.end();
