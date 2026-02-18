import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
    connectionString: process.env.ENV === "dev" ? process.env.DEV_DATABASE_URL! : process.env.PROD_DATABASE_URL!,
});

export const prisma = new PrismaClient({
    adapter,
});