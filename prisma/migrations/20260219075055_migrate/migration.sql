/*
  Warnings:

  - You are about to alter the column `balance` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Decimal(20,2)`.

*/
-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DEFAULT 0,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(20,2);
