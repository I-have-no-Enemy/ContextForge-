-- ==============================================================================
-- ContextForge Initial Schema Migration: 20260912000001_init_contextforge_schema
-- PostgreSQL 16+ DDL with Relational FKs, Enums, B-Tree & GIN Indexes
-- ==============================================================================

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('public', 'developer', 'admin');

-- CreateEnum
CREATE TYPE "ToolRiskLevel" AS ENUM ('read_only', 'network', 'filesystem', 'destructive');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('server', 'skill');

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'developer',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mcp_servers
CREATE TABLE "mcp_servers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "repository_url" VARCHAR(255),
    "install_command" VARCHAR(255) NOT NULL,
    "required_env_vars" JSONB NOT NULL DEFAULT '[]',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "submitted_by" UUID NOT NULL,
    "downloads_count" INTEGER NOT NULL DEFAULT 0,
    "github_stars" INTEGER NOT NULL DEFAULT 0,
    "github_contributors" INTEGER NOT NULL DEFAULT 0,
    "github_last_synced_at" TIMESTAMPTZ,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tool_definitions
CREATE TABLE "tool_definitions" (
    "id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "input_schema" JSONB NOT NULL DEFAULT '{}',
    "risk_level" "ToolRiskLevel" NOT NULL DEFAULT 'read_only',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tool_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_skills
CREATE TABLE "ai_skills" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "skill_content" TEXT NOT NULL,
    "compatible_clients" JSONB NOT NULL DEFAULT '["claude_desktop", "cursor", "cline", "antigravity"]',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "scan_flags" JSONB NOT NULL DEFAULT '{}',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "submitted_by" UUID NOT NULL,
    "downloads_count" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: client_configs
CREATE TABLE "client_configs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "client_type" VARCHAR(50) NOT NULL,
    "selected_server_ids" JSONB NOT NULL DEFAULT '[]',
    "selected_skill_ids" JSONB NOT NULL DEFAULT '[]',
    "generated_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: submission_reviews
CREATE TABLE "submission_reviews" (
    "id" UUID NOT NULL,
    "item_type" "ReviewItemType" NOT NULL,
    "item_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "flagged_by_scan" BOOLEAN NOT NULL DEFAULT false,
    "review_notes" TEXT,
    "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraints
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "mcp_servers_name_key" ON "mcp_servers"("name");
CREATE UNIQUE INDEX "ai_skills_name_key" ON "ai_skills"("name");

-- CreateIndex: B-Tree Indexes
CREATE INDEX "idx_mcp_servers_verified" ON "mcp_servers"("is_verified", "is_deleted", "downloads_count" DESC);
CREATE INDEX "idx_tool_server_id" ON "tool_definitions"("server_id");
CREATE INDEX "idx_ai_skills_verified" ON "ai_skills"("is_verified", "is_deleted", "downloads_count" DESC);
CREATE INDEX "idx_client_configs_user_id" ON "client_configs"("user_id");
CREATE INDEX "idx_submission_reviews_pending" ON "submission_reviews"("status", "item_type");

-- CreateIndex: PostgreSQL GIN Indexes for high-performance JSONB queries
CREATE INDEX "idx_tool_input_schema" ON "tool_definitions" USING gin ("input_schema");
CREATE INDEX "idx_client_config_servers" ON "client_configs" USING gin ("selected_server_ids");
CREATE INDEX "idx_client_config_skills" ON "client_configs" USING gin ("selected_skill_ids");
CREATE INDEX "idx_skills_tags" ON "ai_skills" USING gin ("tags");

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tool_definitions" ADD CONSTRAINT "tool_definitions_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_skills" ADD CONSTRAINT "ai_skills_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "client_configs" ADD CONSTRAINT "client_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
