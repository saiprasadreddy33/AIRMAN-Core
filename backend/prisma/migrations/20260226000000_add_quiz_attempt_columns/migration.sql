-- AlterTable: add total, source, external_id to QuizAttempt
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "total" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'online';
ALTER TABLE "QuizAttempt" ADD COLUMN IF NOT EXISTS "external_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuizAttempt_source_idx" ON "QuizAttempt"("source");
