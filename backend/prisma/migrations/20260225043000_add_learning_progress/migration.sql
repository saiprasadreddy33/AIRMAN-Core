-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleProgress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ModuleProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseProgress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "CourseProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_tenant_id_student_id_lesson_id_key" ON "LessonProgress"("tenant_id", "student_id", "lesson_id");

-- CreateIndex
CREATE INDEX "LessonProgress_tenant_id_idx" ON "LessonProgress"("tenant_id");

-- CreateIndex
CREATE INDEX "LessonProgress_student_id_idx" ON "LessonProgress"("student_id");

-- CreateIndex
CREATE INDEX "LessonProgress_lesson_id_idx" ON "LessonProgress"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleProgress_tenant_id_student_id_module_id_key" ON "ModuleProgress"("tenant_id", "student_id", "module_id");

-- CreateIndex
CREATE INDEX "ModuleProgress_tenant_id_idx" ON "ModuleProgress"("tenant_id");

-- CreateIndex
CREATE INDEX "ModuleProgress_student_id_idx" ON "ModuleProgress"("student_id");

-- CreateIndex
CREATE INDEX "ModuleProgress_module_id_idx" ON "ModuleProgress"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "CourseProgress_tenant_id_student_id_course_id_key" ON "CourseProgress"("tenant_id", "student_id", "course_id");

-- CreateIndex
CREATE INDEX "CourseProgress_tenant_id_idx" ON "CourseProgress"("tenant_id");

-- CreateIndex
CREATE INDEX "CourseProgress_student_id_idx" ON "CourseProgress"("student_id");

-- CreateIndex
CREATE INDEX "CourseProgress_course_id_idx" ON "CourseProgress"("course_id");

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleProgress" ADD CONSTRAINT "ModuleProgress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "LearningModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseProgress" ADD CONSTRAINT "CourseProgress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
