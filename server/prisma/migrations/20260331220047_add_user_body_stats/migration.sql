-- AlterTable
ALTER TABLE "User" ADD COLUMN     "heightCm" DOUBLE PRECISION,
ADD COLUMN     "heightUnit" TEXT NOT NULL DEFAULT 'cm',
ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sex" TEXT;
