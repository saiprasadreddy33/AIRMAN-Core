-- =============================================================
-- Initial migration: full schema for AIRMAN-Core API
-- Includes all baseline tables + AuditLog, RefreshToken,
-- and Booking.escalation_required
-- =============================================================

-- CreateTable: Tenant
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Role
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable: User
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RefreshToken
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InstructorAvailability
CREATE TABLE "InstructorAvailability" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Booking
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "escalation_required" BOOLEAN NOT NULL DEFAULT false,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "correlation_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- =============================================================
-- Unique constraints
-- =============================================================

CREATE UNIQUE INDEX "Tenant_tenant_id_key" ON "Tenant"("tenant_id");

CREATE UNIQUE INDEX "Role_tenant_id_name_key" ON "Role"("tenant_id", "name");

CREATE UNIQUE INDEX "User_tenant_id_email_key" ON "User"("tenant_id", "email");

CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- =============================================================
-- Indexes
-- =============================================================

CREATE INDEX "Tenant_tenant_id_idx" ON "Tenant"("tenant_id");

CREATE INDEX "Role_tenant_id_idx" ON "Role"("tenant_id");

CREATE INDEX "User_tenant_id_idx" ON "User"("tenant_id");

CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

CREATE INDEX "InstructorAvailability_tenant_id_idx" ON "InstructorAvailability"("tenant_id");

CREATE INDEX "InstructorAvailability_instructor_id_idx" ON "InstructorAvailability"("instructor_id");

CREATE INDEX "Booking_tenant_id_idx" ON "Booking"("tenant_id");

CREATE INDEX "Booking_instructor_id_idx" ON "Booking"("instructor_id");

CREATE INDEX "Booking_student_id_idx" ON "Booking"("student_id");

CREATE INDEX "AuditLog_tenant_id_idx" ON "AuditLog"("tenant_id");

-- =============================================================
-- Foreign keys
-- =============================================================

ALTER TABLE "Role" ADD CONSTRAINT "Role_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorAvailability" ADD CONSTRAINT "InstructorAvailability_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorAvailability" ADD CONSTRAINT "InstructorAvailability_instructor_id_fkey"
    FOREIGN KEY ("instructor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_instructor_id_fkey"
    FOREIGN KEY ("instructor_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
