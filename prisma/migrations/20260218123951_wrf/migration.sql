/*
  Warnings:

  - You are about to alter the column `balance` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `Decimal(20,2)` to `BigInt`.

*/
-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "balance" SET DATA TYPE BIGINT;
