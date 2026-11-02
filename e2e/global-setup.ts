import { execSync } from "node:child_process";

export default function setup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://acq:acq_dev@localhost:5432/acq_os_test", ALLOW_SAMPLE_DATA: "true" };
  for (const s of ["scripts/reset.ts", "scripts/migrate.ts", "scripts/seed.ts"]) execSync(`npx tsx ${s}`, { env, stdio: "inherit" });
}
