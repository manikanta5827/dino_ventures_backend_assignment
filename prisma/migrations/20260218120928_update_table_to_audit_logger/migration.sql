/*
  Warnings:

  - You are about to drop the `ledger` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ledger" DROP CONSTRAINT "ledger_asset_type_id_fkey";

-- DropForeignKey
ALTER TABLE "ledger" DROP CONSTRAINT "ledger_user_id_fkey";

-- AlterTable
ALTER TABLE "asset_types" ADD COLUMN     "icon_url" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "ledger";

-- CreateTable
CREATE TABLE "audit_ledger" (
    "id" BIGSERIAL NOT NULL,
    "transaction_id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "asset_type_id" INTEGER NOT NULL,
    "entry_type" "entry_type" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_ledger_user_id_asset_type_id_idx" ON "audit_ledger"("user_id", "asset_type_id");

-- CreateIndex
CREATE INDEX "audit_ledger_transaction_id_idx" ON "audit_ledger"("transaction_id");

-- CreateIndex
CREATE INDEX "audit_ledger_created_at_idx" ON "audit_ledger"("created_at");

-- AddForeignKey
ALTER TABLE "audit_ledger" ADD CONSTRAINT "audit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_ledger" ADD CONSTRAINT "audit_ledger_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
