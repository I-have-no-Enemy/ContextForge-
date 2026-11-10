-- Owner lookups (GET /servers/me, /skills/me) and latest-review batch lookup.
CREATE INDEX IF NOT EXISTS "idx_mcp_servers_submitted_by" ON "mcp_servers"("submitted_by");
CREATE INDEX IF NOT EXISTS "idx_ai_skills_submitted_by" ON "ai_skills"("submitted_by");
CREATE INDEX IF NOT EXISTS "idx_submission_reviews_item" ON "submission_reviews"("item_type", "item_id", "reviewed_at" DESC);

-- GIN indexes from spec section 3. Declared in schema.prisma now so `prisma db push`
-- keeps them; IF NOT EXISTS makes this safe on databases built by the init migration.
CREATE INDEX IF NOT EXISTS "idx_tool_input_schema" ON "tool_definitions" USING GIN ("input_schema");
CREATE INDEX IF NOT EXISTS "idx_client_config_servers" ON "client_configs" USING GIN ("selected_server_ids");
CREATE INDEX IF NOT EXISTS "idx_client_config_skills" ON "client_configs" USING GIN ("selected_skill_ids");
CREATE INDEX IF NOT EXISTS "idx_skills_tags" ON "ai_skills" USING GIN ("tags");
