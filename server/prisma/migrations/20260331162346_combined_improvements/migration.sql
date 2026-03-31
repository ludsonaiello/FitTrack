-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('WEIGHT', 'FREQUENCY', 'EXERCISE_PR');

-- Migrate existing Goal.type values from lowercase strings to uppercase enum values
-- (safe even on empty tables)
UPDATE "Goal" SET "type" = 'WEIGHT'      WHERE "type" = 'weight';
UPDATE "Goal" SET "type" = 'FREQUENCY'   WHERE "type" = 'frequency';
UPDATE "Goal" SET "type" = 'EXERCISE_PR' WHERE "type" = 'exercise_pr';
-- Handle any rows with unexpected values by defaulting to WEIGHT
UPDATE "Goal" SET "type" = 'WEIGHT' WHERE "type" NOT IN ('WEIGHT', 'FREQUENCY', 'EXERCISE_PR');

-- AlterTable: cast the string column to the new enum type
ALTER TABLE "Goal" ALTER COLUMN "type" TYPE "GoalType" USING "type"::"GoalType";

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "BodyWeight_userId_idx" ON "BodyWeight"("userId");

-- CreateIndex
CREATE INDEX "BodyWeight_userId_loggedAt_idx" ON "BodyWeight"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "ExerciseSet_sessionId_idx" ON "ExerciseSet"("sessionId");

-- CreateIndex
CREATE INDEX "ExerciseSet_tutorialId_idx" ON "ExerciseSet"("tutorialId");

-- CreateIndex
CREATE INDEX "ExerciseSet_sessionId_tutorialId_idx" ON "ExerciseSet"("sessionId", "tutorialId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_achieved_idx" ON "Goal"("userId", "achieved");

-- CreateIndex
CREATE INDEX "Goal_tutorialId_idx" ON "Goal"("tutorialId");

-- CreateIndex
CREATE INDEX "PlanDay_planId_idx" ON "PlanDay"("planId");

-- CreateIndex
CREATE INDEX "PlanDay_planId_dayOfWeek_idx" ON "PlanDay"("planId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "PlanExercise_dayId_idx" ON "PlanExercise"("dayId");

-- CreateIndex
CREATE INDEX "PlanExercise_tutorialId_idx" ON "PlanExercise"("tutorialId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_idx" ON "WorkoutPlan"("userId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_isActive_idx" ON "WorkoutPlan"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_idx" ON "WorkoutSession"("userId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_planId_idx" ON "WorkoutSession"("planId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
