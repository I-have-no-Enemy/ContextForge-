-- Provenance for listings imported from GitHub (additive, nullable; existing rows are untouched).
-- Rollback: ALTER TABLE ... DROP COLUMN source_url, source_license, source_ref on both tables.
ALTER TABLE "mcp_servers"
  ADD COLUMN "source_url" VARCHAR(512),
  ADD COLUMN "source_license" VARCHAR(64),
  ADD COLUMN "source_ref" VARCHAR(64);

ALTER TABLE "ai_skills"
  ADD COLUMN "source_url" VARCHAR(512),
  ADD COLUMN "source_license" VARCHAR(64),
  ADD COLUMN "source_ref" VARCHAR(64);
