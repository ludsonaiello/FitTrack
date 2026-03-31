-- AlterTable: add rawKey as nullable (existing keys have no recoverable raw value)
ALTER TABLE "ApiKey" ADD COLUMN "rawKey" TEXT;
