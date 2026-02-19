/*
  Warnings:

  - The primary key for the `idempotency_keys` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `idempotency_keys` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idempotency_keys_user_id_method_path_idempotency_key_key";

-- AlterTable
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_pkey",
DROP COLUMN "id",
ALTER COLUMN "idempotency_key" SET DATA TYPE VARCHAR(50),
ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("user_id", "method", "path", "idempotency_key");
