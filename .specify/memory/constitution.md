# ContextForge Constitution
<!-- Unified Governance, Security & Config Registry for MCP Tools and AI Skills -->

## Core Principles

### I. Dual-Ecosystem Governance (Tools & Skills as Equal Citizens)
ContextForge treats MCP Servers (executable tools) and AI Skills (`SKILL.md` knowledge packs) as unified AI extensions with distinct risk profiles:
- **MCP Tools**: Mandatory Input Schema validation, Risk Level rating (`read_only`, `network`, `filesystem`, `destructive`), and Environment Variable masking.
- **AI Skills**: Mandatory Indirect Prompt Injection scanning (detecting exfiltration, stealth system prompts, credential leaks), Markdown format validation, and Client Compatibility checks.
- Neither entity may be published to the public marketplace or generated into configs without passing Admin Verification (`is_verified = true`).

### II. Zero-Trust Security & Authentication (OWASP Top 10 + LLM Top 10)
- **Identity & Token Integrity**: JWT authentication is mandatory for all mutating operations. Endpoints must extract identity directly from verified JWT claims (`req.user.id`). Never trust `user_id` or `submitted_by` from request bodies or headers.
- **Strict Role-Based Access Control (RBAC)**: Enforce 3 distinct permission boundaries (`Public`, `Developer`, `Admin`). Admin endpoints (e.g., `/tools/:id/verify`, takedowns, reviews) require explicit role-check middleware.
- **Row-Level Security (RLS) & Authorization**: Developers may only edit, update, or soft-delete assets they own. Public users have read-only access to verified items.
- **Abuse Prevention**: Rate limiting is strictly enforced on unauthenticated endpoints (especially `POST /api/v1/configs/generate` and search endpoints) to prevent automated scraping and DoS.

### III. Database Architecture & Contract Integrity (PostgreSQL)
- **Relational + JSONB Hybrid**: PostgreSQL is the single source of truth. Relational foreign keys govern Server-Tool hierarchies; JSONB governs dynamic parameter schemas and client configuration snapshots.
- **GIN Indexing**: All JSONB columns queried during search or filtering (`input_schema`, `selected_server_ids`, `selected_skill_ids`) must have GIN indexes.
- **Polymorphic Safety**: `submission_reviews` using `item_type` (`server` | `skill`) + `item_id` must be guarded by strict Application Layer validation middlewares and database transactions before commit.
- **Soft Delete & Snapshot Stability**: All deletion endpoints perform Soft Delete. Existing generated client configs (`client_configs.generated_json`) must remain immutable snapshots and never break if a referenced server or skill is later deprecated.

### IV. Anti-Vibe Testing Discipline (2026 Enterprise QA Checklist)
- **TDD Mandatory (Red-Green-Refactor)**: Write failing test assertions before implementation. No feature is accepted without runnable automated tests.
- **Anti-False Success**: Assertions must validate actual database state, HTTP status codes, and JSON response bodies. Mocking must be minimal and never obscure database contract violations.
- **Traceability & Edge Coverage**: Test positive paths, negative unauthorized paths, boundary partitions, JSONB schema mismatches, and race conditions during simultaneous config generation.
- **Definition of Done (DoD)**: A task is only complete when implementation passes automated tests, zero lint warnings exist, and verification evidence is documented.

### V. Ponytail Minimalist Engineering (The Lazy Senior Dev Framework)
- **Stdlib & Native First**: Rely on Node.js/Python stdlib and PostgreSQL native constraints (Triggers, Constraints, JSONB functions) before introducing third-party packages.
- **Deep Modules, Simple Interface**: Encapsulate complex validation (Prompt Injection heuristics, schema parsers) behind concise, single-purpose controller handlers.
- **Deliberate Debt Tracking**: Any temporary shortcut or deferral taken during fast delivery must be documented with `// ponytail: [rationale and upgrade ceiling]` for debt auditing.

---

## Technical Stack & Constraints

- **Backend Runtime**: Node.js (Express / Fastify) or Python (FastAPI) with TypeScript / Type Hints.
- **Database**: PostgreSQL 16+ with native JSONB, GIN indexing, and connection pooling.
- **Security Protocols**: Helmet headers, CORS whitelist, bcrypt password hashing, JWT RS256/HS256 tokens, and rate-limiter-flexible storage.
- **External Integration**: GitHub API sync jobs must run as decoupled background workers using GitHub Personal Access Tokens and respecting the 5,000 req/hr rate limit with cache fallback.

---

## Governance & Quality Gates

1. **Constitution Primacy**: This Constitution supersedes loose prompting and informal feature requests.
2. **Amendments**: Modifying this document requires documenting the architectural rationale in an Architectural Decision Record (`docs/ADR.md`).
3. **Pre-commit Gate**: All Pull Requests and commits must pass automated test runs (`npm test` / `pytest`) and security linting before merge.

**Version**: 1.0.0 | **Ratified**: 2026-09-12 | **Status**: Active Baseline
