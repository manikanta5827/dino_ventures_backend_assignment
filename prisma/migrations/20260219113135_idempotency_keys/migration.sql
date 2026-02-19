/*
  Warnings:

  - The values [FAILED] on the enum `IdempotencyStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `endpoint` on the `idempotency_keys` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `idempotency_keys` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_id,method,path,idempotency_key]` on the table `idempotency_keys` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotency_key` to the `idempotency_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `idempotency_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `idempotency_keys` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "IdempotencyStatus_new" AS ENUM ('IN_PROGRESS', 'COMPLETED');
ALTER TABLE "idempotency_keys" ALTER COLUMN "status" TYPE "IdempotencyStatus_new" USING ("status"::text::"IdempotencyStatus_new");
ALTER TYPE "IdempotencyStatus" RENAME TO "IdempotencyStatus_old";
ALTER TYPE "IdempotencyStatus_new" RENAME TO "IdempotencyStatus";
DROP TYPE "public"."IdempotencyStatus_old";
COMMIT;

-- DropIndex
DROP INDEX "idempotency_keys_expires_at_idx";

-- DropIndex
DROP INDEX "idempotency_keys_key_method_endpoint_key";

-- AlterTable
ALTER TABLE "idempotency_keys" DROP COLUMN "endpoint",
DROP COLUMN "key",
ADD COLUMN     "idempotency_key" UUID NOT NULL,
ADD COLUMN     "path" TEXT NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL,
ALTER COLUMN "response_body" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_method_path_idempotency_key_key" ON "idempotency_keys"("user_id", "method", "path", "idempotency_key");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
