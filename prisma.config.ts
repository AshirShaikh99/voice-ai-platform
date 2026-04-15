import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma CLI doesn't know about Next.js's .env.local convention; load it
// explicitly so `prisma db push`, `prisma migrate`, and `prisma studio` all
// pick up the same DATABASE_URL the Next.js dev server uses.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
