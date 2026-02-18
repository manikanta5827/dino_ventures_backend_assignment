import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    url: process.env.ENV === "dev" ? process.env.DEV_DATABASE_URL! : process.env.PROD_DATABASE_URL!,
  },
});
