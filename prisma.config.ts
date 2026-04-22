import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI doesn't know about Next.js's .env.local convention; load it
// explicitly so `prisma db push`, `prisma migrate`, and `prisma studio` all
// pick up the same DATABASE_URL the Next.js dev server uses.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Read DATABASE_URL directly instead of prisma's env<T>() helper — the helper
// fails config loading when the var is unset, which breaks `prisma generate`
// on CI (generate doesn't connect; it only needs the provider). Fall back to
// a placeholder so generate works; real commands (db push, migrate) still
// require a real URL and will fail clearly at connect time.
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: DATABASE_URL,
  },
});
