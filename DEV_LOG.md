# 📋 ContextForge Development Action Log (`DEV_LOG.md`)

> **Project**: ContextForge (Unified MCP Tools & AI Skills Governance Registry)  
> **Course**: 06016418 Server-Side Web Development (KMITL IT)  
> **Repository**: [ContextForge on GitHub](https://github.com/I-have-no-Enemy/ContextForge-.git)  
> **Created**: 2026-09-12  
> **Status**: In Active Development  

บันทึกประวัติการกระทำ การแก้ไขโค้ด สถาปัตยกรรม และคำสั่งสำคัญทั้งหมดในโปรเจกต์ เรียงตามวันและเวลา พร้อมรายละเอียดไฟล์ที่ถูกสร้างหรือแก้ไข

---

## 🕒 สรุปประวัติการดำเนินงาน (Timeline Overview)

| ลำดับ | วันที่ & เวลา (GMT+7) | หัวข้อการดำเนินการ                                                   |    หมวดหมู่    | Commit Hash |
| :---: | :-------------------- | :------------------------------------------------------------------- | :------------: | :---------: |
|   1   | 2026-09-12 10:45:00   | Initialize Git repo, Spec Kit, & Constitution                        |  Architecture  |  `4ba44c7`  |
|   2   | 2026-09-12 11:05:00   | Scaffold Feature Specification `001-mcp-skills-registry/spec.md`     | Specification  |  `1f1b07d`  |
|   3   | 2026-09-12 11:22:00   | Add `UX.md`, `DESIGN.md`, CSS tokens, & `tailwind.config.js`         |    UX / UI     |  `f63e82a`  |
|   4   | 2026-09-12 11:55:00   | Complete Grilling Interview & Finalize Architecture Decisions        | ADR / Grilling |      -      |
|   5   | 2026-09-12 11:58:00   | Scaffold Root Monorepo, Docker Compose, Backend & Frontend Skeletons | Implementation |  `7b9ce6f`  |
|   6   | 2026-09-12 12:08:00   | Create Initial SQL Migration, GIN Indexes & Comprehensive Seed Script (`seed.ts`) |    Database    |  `eaf83c8`  |
|   7   | 2026-09-12 12:13:00   | Implement Slice 1: Authentication & Identity Engine (`/api/v1/auth/*`) | Authentication |  `8f2abff`  |
|   8   | 2026-09-12 12:19:00   | Implement Slice 2: MCP Server & Tool Registry Endpoints (`/api/v1/servers/*`) |  MCP & Tools   |  `e897b4e`  |
|   9   | 2026-09-12 12:24:00   | Implement Slice 3: AI Skills Registry & Security Scanner Endpoints (`/api/v1/skills/*`) | AI Skills & LLM01 |  *Pending*  |

---

## 📝 บันทึกรายละเอียดการกระทำรายขั้นตอน (Detailed Action Entries)

### 📌 Entry #001: ตั้งค่า Repository, Spec Kit และ Constitution
- **วันและเวลา**: `2026-09-12 10:45:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - ติดตั้งและตั้งค่า Spec Kit ในโปรเจกต์ `ContextForge`
  - กำหนดกฎบัตรวิศวกรรมระบบ (System Constitution) ใน `.specify/memory/constitution.md`
  - เชื่อมโยง Git Remote ไปยัง `https://github.com/I-have-no-Enemy/ContextForge-.git`
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `.specify/memory/constitution.md`
  - `.specify/templates/*`
  - `.gitignore`
  - `README.md`
- **ผลการทดสอบ/ยืนยัน**: Commit `4ba44c7` pushed successfully

---

### 📌 Entry #002: ร่างข้อกำหนดทางเทคนิคฉบับสมบูรณ์ (Feature Specification)
- **วันและเวลา**: `2026-09-12 11:05:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - วิเคราะห์ไฟล์งานวิชา Server-Side ทั้งหมด (`SDLC Project.md`, `Testing Checklist 2026`, `MCP_Hub_Project_Full.docx`)
  - ร่างเอกสาร Specification 364 บรรทัด ครอบคลุม:
    - 4 Core User Stories + 1 Background Sync Story
    - ER Diagram 6 ตาราง (Users, McpServers, ToolDefinitions, AiSkills, ClientConfigs, SubmissionReviews)
    - สัญญาระดับ API 20 Endpoints พร้อม JSON Envelope Format
    - มาตรการความปลอดภัย OWASP Top 10 + LLM Top 10 (LLM01 Prompt Injection)
    - กรอบการทดสอบ TDD และ Definition of Done (DoD)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `specs/001-mcp-skills-registry/spec.md`
- **ผลการทดสอบ/ยืนยัน**: Commit `1f1b07d` pushed successfully

---

### 📌 Entry #003: ออกแบบ UX Specification และนำเข้า Hyperstudio Design System
- **วันและเวลา**: `2026-09-12 11:22:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - เขียน `UX.md` วิเคราะห์ 4 Persona Journey อย่างละเอียด, Responsive Layout, Empty States ที่ Actionable ได้จริง, และ WCAG 2.2 AA Checklist
  - ดึง Design Tokens และ Styling จากโฟลเดอร์ `UXUI/` เข้าสู่ `ContextForge/`:
    - ธีม **Hyperstudio (Obsidian/Hairline Grid)** ไม่ใช้ AI-Slop (ไม่มี Neon gradients, ไม่มี Fuzzy Glassmorphism)
    - ปรับแก้ไวยากรณ์ CSS Custom Properties ใน `variables.css` ให้ถูกต้องสมบูรณ์
    - สร้าง `tailwind.config.js` แมป Token เข้ากับ Tailwind CSS
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `UX.md`
  - `DESIGN.md`
  - `styles/theme.css`
  - `styles/variables.css`
  - `styles/tokens.json`
  - `tailwind.config.js`
- **ผลการทดสอบ/ยืนยัน**: Commit `f63e82a` pushed successfully

---

### 📌 Entry #004: ผ่านการซักฟอกสถาปัตยกรรม (Grilling Interview & ADR)
- **วันและเวลา**: `2026-09-12 11:55:00 +07:00`
- **ผู้ดำเนินการ**: Tawan (User) & Antigravity AI (Pair Programming)
- **การกระทำ (Action)**:
  - ดำเนินการสัมภาษณ์เจาะลึก 2 รอบ (10 คำถามสำคัญ) ผ่าน Grilling Skill
  - บรรลุข้อตกลงและตัดสินใจเลือกสถาปัตยกรรม (Shared Understanding):
    1. **Architecture**: Express.js 5 TypeScript REST API + Decoupled Vite React Frontend
    2. **Monorepo**: npm workspaces จัดการ `backend/` และ `frontend/` ใน repo เดียว
    3. **Database**: PostgreSQL 16 บน `docker-compose.yml` (พร้อมสลับต่อ Cloud DB ผ่าน `.env`)
    4. **Data Layer**: Prisma ORM + `$queryRaw` สำหรับ JSONB GIN Index / RLS
    5. **Authentication**: Stateless JWT (24 ชม.) รองรับทั้ง `Bearer` Header และ HttpOnly Cookie
    6. **Security Scanner**: In-process Heuristic Regex สแกน <5ms (Soft flag `flagged_by_scan: true` ไม่บล็อก 201 แต่ส่งเข้าคิว Admin)
    7. **Testing**: Vitest + Supertest สำหรับ TDD
    8. **Data Seeding**: Script `npm run seed` สเกลข้อมูลตัวแทน 3 Roles, 5 Servers, 5 Skills
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/plan.md` (Living Implementation Plan)
- **ผลการทดสอบ/ยืนยัน**: ได้รับความเห็นชอบ 100% จากผู้ใช้เพื่อเริ่ม Scaffolding

---

### 📌 Entry #005: สร้างโครงสร้าง Monorepo, Docker Compose, Backend & Frontend Skeletons
- **วันและเวลา**: `2026-09-12 12:00:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - วางโครงสร้าง Root Monorepo ด้วย `npm workspaces` (`backend`, `frontend`) พร้อมคำสั่ง `npm run dev` ผ่าน concurrently
  - สร้าง `docker-compose.yml` คุม Container PostgreSQL 16 (พอร์ต 5432) พร้อม Healthcheck
  - สร้าง `.env.example` รองรับทั้ง Local Docker DB และ Cloud PostgreSQL (Neon/Supabase)
  - ติดตั้งโครงสร้างฝั่ง `backend/`:
    - `package.json` & `tsconfig.json` (Express 5, Prisma, Vitest, Supertest, TS strict)
    - `prisma/schema.prisma` บรรจุ 6 ตารางครบตามข้อกำหนด (`users`, `mcp_servers`, `tool_definitions`, `ai_skills`, `client_configs`, `submission_reviews`)
    - ร่าง Seams โค้ดหลัก: `src/config/prisma.ts`, `src/utils/response.ts`, `src/middlewares/auth.middleware.ts` (Dual Bearer/Cookie), `src/middlewares/error.middleware.ts`, `src/services/scanner.service.ts` (LLM01 Defense), `src/services/configGenerator.service.ts`, `src/routes/index.ts`, `src/app.ts`, `src/server.ts`
    - เพิ่ม Unit & Integration Test Stubs: `src/__tests__/scanner.test.ts`, `src/__tests__/configGenerator.test.ts`, `src/__tests__/health.test.ts`
  - ติดตั้งโครงสร้างฝั่ง `frontend/`:
    - `package.json`, `vite.config.ts`, `tsconfig.json`
    - `index.html`, `src/index.css` (เชื่อมโยง Hyperstudio Tokens), `src/main.tsx`, `src/App.tsx` (Dashboard UI สไตล์ Obsidian/Hairline พร้อม Live Healthcheck)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `package.json` (Root Monorepo)
  - `docker-compose.yml`
  - `.env.example`
  - `DEV_LOG.md`
  - `backend/package.json`
  - `backend/tsconfig.json`
  - `backend/prisma/schema.prisma`
  - `backend/src/config/prisma.ts`
  - `backend/src/utils/response.ts`
  - `backend/src/services/scanner.service.ts`
  - `backend/src/services/configGenerator.service.ts`
  - `backend/src/middlewares/auth.middleware.ts`
  - `backend/src/middlewares/error.middleware.ts`
  - `backend/src/routes/index.ts`
  - `backend/src/app.ts`
  - `backend/src/server.ts`
  - `backend/src/__tests__/scanner.test.ts`
  - `backend/src/__tests__/configGenerator.test.ts`
  - `backend/src/__tests__/health.test.ts`
  - `frontend/package.json`
  - `frontend/vite.config.ts`
  - `frontend/tsconfig.json`
  - `frontend/index.html`
  - `frontend/src/index.css`
  - `frontend/src/main.tsx`
  - `frontend/src/App.tsx`
- **ผลการทดสอบ/ยืนยัน**:
  - `prisma format`: ตรวจสอบ Schema โหลดและจัดรูปแบบสำเร็จ 100% 🚀

---

### 📌 Entry #006: สร้างไฟล์ Migration แรก (PostgreSQL DDL + GIN Indexes) และสคริปต์ Seeding ข้อมูล
- **วันและเวลา**: `2026-09-12 12:08:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - สกัดไฟล์ SQL DDL Migration ตั้งต้นผ่าน `prisma migrate diff` เก็บไว้ที่ `backend/prisma/migrations/20260912000001_init_contextforge_schema/migration.sql`
  - เสริมคำสั่งสร้าง GIN Indexes บนคอลัมน์ JSONB ทุกตาราง (`input_schema`, `selected_server_ids`, `selected_skill_ids`, `tags`) เพื่อรองรับการสืบค้นข้อมูลเชิงลึกความเร็วสูง
  - เขียนสคริปต์ `backend/prisma/seed.ts` สร้างข้อมูลจำลองสำหรับทดสอบครบถ้วน:
    - **3 Users**: Admin (`admin@contextforge.dev`), Developer (`developer@contextforge.dev`), Visitor (`visitor@contextforge.dev`) พร้อมแฮชรหัสผ่านด้วย `bcrypt`
    - **5 MCP Servers**: `postgres-mcp-server`, `filesystem-mcp-server`, `brave-search-mcp`, `memory-graph-mcp`, และ `terminal-exec-mcp` (Pending Review)
    - **5 AI Skills**: `tdd-mastery`, `security-auditor`, `ponytail-minimalist`, `academic-deep-dive`, และ `stealth-exfiltrator-test` (Flagged จากการตรวจจับ Prompt Injection)
    - **2 Submission Reviews**: ใน Admin Queue (1 Server ตรวจสอบสิทธิ์ + 1 Malicious Skill ที่ติด Flag ความเสี่ยง 100%)
    - **1 Client Config**: ตัวอย่าง JSON Snapshot ที่สร้างสำเร็จสำหรับ Claude Desktop
  - ทำการ Generate `@prisma/client` v5.22.0
  - แก้ไขการตั้งค่า TypeScript ใน `backend/package.json` (`"type": "module"`) และ `backend/tsconfig.json`
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `backend/prisma/migrations/20260912000001_init_contextforge_schema/migration.sql`
  - `backend/prisma/seed.ts`
  - `backend/.env`
  - `backend/package.json`
  - `backend/tsconfig.json`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run test --workspace=backend`: ผ่านการทดสอบ Vitest ครบ 8/8 Tests (100% Pass Rate) 🧪
  - `tsc --noEmit`: คอมไพล์ TypeScript ผ่านฉลุย ไม่มี Type Errors (Exit code 0) 🚀

---

### 📌 Entry #007: พัฒนา Slice 1 — Authentication & Identity Engine (`/api/v1/auth/*`)
- **วันและเวลา**: `2026-09-12 12:13:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แตก Ticket รายละเอียดย่อยลง `scratch/tickets.md` (Ticket-001 Validation, Ticket-002 Controller/Routes, Ticket-003 Integration Tests)
  - สร้าง Input Validator ด้วย Zod ใน `backend/src/validators/auth.validator.ts`:
    - `registerSchema`: ตรวจสอบรูปแบบ Email, รหัสผ่าน $\ge 8$ ตัวอักษรพร้อมตัวอักษรและตัวเลข, Role (`developer` หรือ `public`)
    - `loginSchema`: ตรวจสอบความถูกต้องของ Email และ Password
    - `validateBody`: Middleware คืน HTTP 400 Bad Request พร้อมระบุ Field และสาเหตุชัดเจนเมื่อ Validation ผิดพลาด
  - สร้าง Controller ใน `backend/src/controllers/auth.controller.ts`:
    - `POST /api/v1/auth/register`: ตรวจจับอีเมลซ้ำ (HTTP 409), แฮชรหัสผ่านด้วย `bcrypt` (10 rounds), สร้าง User ใหม่ และคืน User Object (ตัด `password_hash` ออกอย่างปลอดภัย)
    - `POST /api/v1/auth/login`: ตรวจสอบรหัสผ่าน, ออก stateless JWT Token (อายุ 24 ชม.), เซ็ต `token` ลงใน HttpOnly Cookie (`sameSite: strict`), และคืน Bearer Token ใน JSON Response (Dual-Delivery)
    - `GET /api/v1/auth/me`: คุ้มกันด้วย `requireAuth` Middleware, คืน Profile ของ User ตาม Token
    - `POST /api/v1/auth/logout`: สั่งเคลียร์ HttpOnly Cookie
  - สร้างและเชื่อมต่อ Route ใน `backend/src/routes/auth.routes.ts` และเชื่อมเข้ากับ `apiRouter.use('/auth', authRouter)` ใน `backend/src/routes/index.ts`
  - แก้ไข Type Assertion ของ `expiresIn` ใน `auth.controller.ts` ให้เข้ากันได้กับ TypeScript Strict Mode
  - เขียน Integration Test Suite ครบวงจรใน `backend/src/__tests__/auth.test.ts` ครอบคลุม 10 Test Cases (Positive, Validation error, Duplicate email, Wrong password, Missing token, Logout)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/tickets.md`
  - `backend/src/validators/auth.validator.ts`
  - `backend/src/controllers/auth.controller.ts`
  - `backend/src/routes/auth.routes.ts`
  - `backend/src/routes/index.ts`
  - `backend/src/__tests__/auth.test.ts`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run test --workspace=backend`: ผ่านฉลุย **18/18 Tests (100% Pass Rate)** ครอบคลุมทั้ง 4 Test Files 🧪
  - `npx tsc --noEmit`: ผ่านฉลุย **0 Type Errors** (Exit code 0) 🚀

---

### 📌 Entry #008: พัฒนา Slice 2 — MCP Server & Tool Registry Endpoints (`/api/v1/servers/*`)
- **วันและเวลา**: `2026-09-12 12:19:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แตก Ticket รายละเอียดย่อยลง `scratch/tickets.md` (Ticket-004 Validation, Ticket-005 Controller/Ownership RBAC, Ticket-006 Integration Tests)
  - สร้าง Input Validator ด้วย Zod ใน `backend/src/validators/server.validator.ts`:
    - `createServerSchema`: ตรวจสอบชื่อ Server (alphanumeric, hyphens), URL repository, คำสั่ง install, และ array ของ env var names
    - `updateServerSchema`: Partial updates สำหรับแก้ไขข้อมูล
    - `createToolSchema`: ตรวจสอบ `name`, `description`, `input_schema` (JSON Schema object), และ `risk_level` enum (`read_only`, `network`, `filesystem`, `destructive`)
  - สร้าง Controller ใน `backend/src/controllers/server.controller.ts`:
    - `GET /api/v1/servers`: รองรับ Public Discovery แบบ Pagination (`page`, `limit`), Full-text search (case-insensitive ILIKE), และกรองเฉพาะ `is_verified: true, is_deleted: false`
    - `GET /api/v1/servers/:id`: ดึงรายละเอียด Server พร้อมรายชื่อ Tools ย่อย และ Submitter (คัดกรองความปลอดภัย: Server ที่ยังไม่ Verified จะเปิดให้ดูได้เฉพาะเจ้าของหรือ Admin เท่านั้น)
    - `POST /api/v1/servers`: ตรวจสอบสิทธิ์ผู้ใช้, ตั้งค่า `is_verified: false` เริ่มต้น, และผูกเข้ากับ `submission_reviews` แบบ Database Transaction (`$transaction`) เพื่อส่งเข้าคิว Admin อัตโนมัติ
    - `PATCH /api/v1/servers/:id`: **ป้องกันช่องโหว่ OWASP A01: Broken Access Control (IDOR)** โดยตรวจสอบ `submitted_by === req.user.id` อย่างเข้มงวด หาก User อื่นพยายามแก้ไขจะถูกปฏิเสธด้วย HTTP 403 Forbidden ทันที
    - `DELETE /api/v1/servers/:id`: ตรวจสอบความเป็นเจ้าของ และทำ Soft Delete (`is_deleted: true, deleted_at: new Date()`) เพื่อรักษาความถูกต้องของ Client Config ในอดีต
    - `GET /api/v1/servers/:id/tools`: แสดงรายการ Tool Definitions ของ Server
    - `POST /api/v1/servers/:id/tools`: ตรวจสอบสิทธิ์เจ้าของ Server ก่อนอนุญาตให้เพิ่ม Tool Definition ใหม่
  - สร้าง Route ใน `backend/src/routes/server.routes.ts` และเชื่อมเข้ากับ `apiRouter.use('/servers', serverRouter)` ใน `backend/src/routes/index.ts`
  - เขียน Integration Test Suite ครบวงจรใน `backend/src/__tests__/servers.test.ts` (10 Test Cases ครอบคลุม Public Listing, Pagination, Unverified Gating, Review Queueing, IDOR Prevention, Soft Delete, และ Tool Definition)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/tickets.md`
  - `backend/src/validators/server.validator.ts`
  - `backend/src/controllers/server.controller.ts`
  - `backend/src/routes/server.routes.ts`
  - `backend/src/routes/index.ts`
  - `backend/src/__tests__/servers.test.ts`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run test --workspace=backend`: ผ่านฉลุย **28/28 Tests (100% Pass Rate)** ครอบคลุมทั้ง 5 Test Files 🧪
  - `npx tsc --noEmit`: คอมไพล์ TypeScript ผ่านฉลุย **0 Type Errors** (Exit code 0) 🚀

---

### 📌 Entry #009: พัฒนา Slice 3 — AI Skills Registry & Security Scanner Endpoints (`/api/v1/skills/*`)
- **วันและเวลา**: `2026-09-12 12:24:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แตก Ticket รายละเอียดย่อยลง `scratch/tickets.md` (Ticket-007 Validation, Ticket-008 Controller/Scanning Pipeline, Ticket-009 Integration Tests)
  - สร้าง Input Validator ด้วย Zod ใน `backend/src/validators/skill.validator.ts`:
    - `createSkillSchema`: ตรวจสอบชื่อ Skill (lowercase, numbers, hyphens/underscores), เนื้อหา Markdown (`skill_content` $\ge 10$ ตัวอักษร), array ของ `compatible_clients`, และ `tags`
    - `updateSkillSchema`: Partial updates สำหรับแก้ไขเนื้อหา Skill
  - สร้าง Controller ใน `backend/src/controllers/skill.controller.ts`:
    - `GET /api/v1/skills`: Public Discovery แบบ Pagination (`page`, `limit`), Full-text search (ILIKE), และรองรับ Filter ตาม Client (`?client=cursor`)
    - `GET /api/v1/skills/:id`: แสดงเนื้อหา Markdown ฉบับเต็มของ `SKILL.md` (หากยังไม่ Verified จะอนุญาตให้เฉพาะเจ้าของหรือ Admin เข้าดูได้)
    - `POST /api/v1/skills`: **เชื่อมโยงเข้ากับ `SecurityScanner.scanSkillContent()` อัตโนมัติ (LLM01 Defense)** ตรวจจับ Pattern อันตราย (System prompt override, Webhook exfiltration, Secret harvesting, Obfuscation) ภายในเวลา <5ms หากพบจะทำการ Soft-flag บันทึกผลลง `scan_flags` และสร้าง Record ใน `submission_reviews` พร้อม Flag แจ้งเตือนแอดมินโดยไม่ขัดขวาง HTTP 201
    - `PATCH /api/v1/skills/:id`: ตรวจสอบสิทธิ์ความเป็นเจ้าของ (ป้องกัน IDOR 403) และหากมีการแก้ไข `skill_content` จะทำการรัน Security Scanner ซ้ำให้อัตโนมัติ
    - `DELETE /api/v1/skills/:id`: ตรวจสอบสิทธิ์ และทำ Soft Delete (`is_deleted: true`)
  - สร้าง Route ใน `backend/src/routes/skill.routes.ts` และเชื่อมเข้ากับ `apiRouter.use('/skills', skillRouter)` ใน `backend/src/routes/index.ts`
  - เขียน Integration Test Suite ครบวงจรใน `backend/src/__tests__/skills.test.ts` (8 Test Cases ครอบคลุม Discovery, Pagination, Benign submission, Malicious prompt injection soft-flagging, IDOR 403 prevention, และ Soft delete)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/tickets.md`
  - `backend/src/validators/skill.validator.ts`
  - `backend/src/controllers/skill.controller.ts`
  - `backend/src/routes/skill.routes.ts`
  - `backend/src/routes/index.ts`
  - `backend/src/__tests__/skills.test.ts`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run test --workspace=backend`: ผ่านฉลุย **36/36 Tests (100% Pass Rate)** ครอบคลุมทั้ง 6 Test Files 🧪
  - `npx tsc --noEmit`: คอมไพล์ TypeScript ผ่านฉลุย **0 Type Errors** (Exit code 0) 🚀

---

### 📌 Entry #010: พัฒนา Slice 4 — Multi-Client Config Generation Endpoints (`/api/v1/configs/*`)
- **วันและเวลา**: `2026-09-12 12:27:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แตก Ticket รายละเอียดย่อยลง `scratch/tickets.md` (Ticket-010 Validation, Ticket-011 Controller/Transaction, Ticket-012 Integration Tests)
  - สร้าง Input Validator ด้วย Zod ใน `backend/src/validators/config.validator.ts`:
    - `generateConfigSchema`: ตรวจสอบ `client_type` enum (`claude_desktop`, `cursor`, `cline`, `antigravity`), Arrays of UUIDs สำหรับ `selected_server_ids` และ `selected_skill_ids`, พร้อม Custom Refinement ป้องกันการส่ง Array ว่างเปล่าทั้งคู่
    - `configIdParamSchema`: ตรวจสอบ UUID ของ snapshot configuration
  - สร้าง Controller ใน `backend/src/controllers/config.controller.ts`:
    - `POST /api/v1/configs/generate`:
      - รองรับทั้ง Anonymous user และ Authenticated user (`optionalAuth` แนบ `user_id` หากล็อกอิน)
      - ตรวจสอบความถูกต้องของ Server IDs และ Skill IDs ในฐานข้อมูลอย่างเข้มงวด (ต้องเป็น `is_verified = true` และ `is_deleted = false`) หากพบ ID ปลอม/ไม่ผ่านการยืนยันจะตีกลับด้วย HTTP 400 (`INVALID_SELECTION`) ทันที ป้องกันการแอบสอดไส้ Tools อันตราย
      - ประมวลผล JSON snapshot ด้วย Deep Module `ConfigGenerator.generate()`
      - รัน Database `$transaction` เพื่อบันทึก Snapshot ลงตาราง `client_configs` และเพิ่มค่า `downloads_count` (+1) ให้แก่ MCP Servers และ AI Skills ทุกตัวที่ถูกเลือกพร้อมกันแบบ Atomic
    - `GET /api/v1/configs/:id`: ดึง Immutable snapshot ตาม UUID (HTTP 200 หรือ HTTP 404 หากไม่พบ)
  - เชื่อมโยง Routes ใน `backend/src/routes/config.routes.ts` และเปิดใช้งาน Mount `apiRouter.use('/configs', configRouter)` ใน `backend/src/routes/index.ts`
  - พัฒนา Integration Test Suite ใน `backend/src/__tests__/configs.test.ts` (9 Test Cases ครอบคลุม Anonymous generation, Authenticated user with user_id, Empty selection validation rejection, Invalid client_type rejection, Unverified/missing server rejection, Unverified/missing skill rejection, Snapshot retrieval, 404 not found, และ 400 invalid UUID)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/tickets.md`
  - `backend/src/validators/config.validator.ts`
  - `backend/src/controllers/config.controller.ts`
  - `backend/src/routes/config.routes.ts`
  - `backend/src/routes/index.ts`
  - `backend/src/__tests__/configs.test.ts`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run test --workspace=backend`: ผ่านฉลุย **45/45 Tests (100% Pass Rate)** ครอบคลุมทั้ง 7 Test Files 🧪
  - `npx tsc --noEmit`: คอมไพล์ TypeScript ผ่านฉลุย **0 Type Errors** (Exit code 0) 🚀

---

### 📌 Entry #011: พัฒนา Slice 5 — Governance & Admin Review Endpoints (`/api/v1/admin/*`)
- **วันและเวลา**: `2026-09-12 12:28:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แตก Ticket รายละเอียดย่อยลง `scratch/tickets.md` (Ticket-013 Admin Validation, Ticket-014 Admin Controller/Polymorphic RBAC, Ticket-015 Governance Test Suite)
  - สร้าง Input Validator ด้วย Zod ใน `backend/src/validators/admin.validator.ts`:
    - `listSubmissionsQuerySchema`: Query params รองรับ pagination, `status` enum, `flagged_by_scan` boolean, และ `item_type` filter
    - `reviewSubmissionSchema`: ตรวจสอบ `item_type` (`server` | `skill`), UUID, `status` (`approved` | `rejected`), และ `review_notes`
    - `emergencyTakedownSchema`: ตรวจสอบ `item_type`, UUID, และ `reason` ($\ge 5$ ตัวอักษร)
  - สร้าง Controller ใน `backend/src/controllers/admin.controller.ts`:
    - `GET /api/v1/admin/submissions`: ดึงรายการคิวตรวจสอบ submissions พร้อม Pagination Metadata และ Relation กับผู้รีวิว
    - `POST /api/v1/admin/submissions/review`:
      - **Enforce Polymorphic Integrity (2026 Critical Testing Requirement)**: ตรวจสอบ Referential Integrity ข้ามตาราง หากส่ง `item_type = 'server'` แต่ระบุ ID ที่ไม่มีใน `mcp_servers` หรือระบุ ID ของ Skill ระบบจะปฏิเสธด้วย HTTP 400 (`POLYMORPHIC_REFERENCE_ERROR`) ทันที ป้องกัน Data Corruption
      - ดำเนินการอัปเดต Database Transactionally: บันทึกประวัติการรีวิวลง `submission_reviews` และสลับสถานะ `is_verified` ของ MCP Server หรือ AI Skill ตามผลการอนุมัติ
    - `POST /api/v1/admin/takedown`: คำสั่งฉุกเฉินสำหรับแอดมินในการเพิกถอนและระงับการใช้งานเครื่องมือที่ตรวจพบช่องโหว่รุนแรง ทำการ Soft Delete (`is_deleted = true, is_verified = false, deleted_at = now()`) และบันทึก Audit Trail ลงในตารางรีวิว
  - สร้าง Routes ใน `backend/src/routes/admin.routes.ts` ปกป้องทุก Endpoint ด้วย `requireAuth` และ `requireRole(['admin'])`
  - เปิดใช้งาน Mount `apiRouter.use('/admin', adminRouter)` ใน `backend/src/routes/index.ts`
  - พัฒนา Integration Test Suite ครบวงจรใน `backend/src/__tests__/admin.test.ts` (9 Test Cases ครอบคลุม RBAC 401/403, Submissions queue with scan flags, Polymorphic integrity rejection 400, Server approval transaction, Skill rejection transaction, Emergency takedown soft-delete, 404 not found, และ 400 validation error)
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/tickets.md`
  - `backend/src/validators/admin.validator.ts`
  - `backend/src/controllers/admin.controller.ts`
  - `backend/src/routes/admin.routes.ts`
  - `backend/src/routes/index.ts`
  - `backend/src/__tests__/admin.test.ts`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run test --workspace=backend`: ผ่านฉลุย **54/54 Tests (100% Pass Rate)** ครอบคลุมทั้ง 8 Test Files 🧪
  - `npx tsc --noEmit`: คอมไพล์ TypeScript ผ่านฉลุย **0 Type Errors** (Exit code 0) 🚀

---

### 📌 Entry #012: พัฒนา Slice 6 — Frontend Dashboard & 1-Click Multi-Client Exporter (`frontend/`)
- **วันและเวลา**: `2026-09-12 12:29:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แตก Ticket รายละเอียดย่อยลง `scratch/tickets.md` (Ticket-016 API Client, Ticket-017 Interactive Catalog UI, Ticket-018 1-Click Config Generator Tray/Modal, Ticket-019 Production Build)
  - พัฒนา Type-Safe API Client ใน `frontend/src/services/api.ts`:
    - ฟังก์ชันเชื่อมต่อ `/api/v1/servers`, `/api/v1/skills`, `/api/v1/configs/generate`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/admin/submissions`, และ `/api/v1/admin/submissions/review`
    - รองรับการส่ง Bearer Token และจัดการ Error Response Envelope อย่างเป็นระบบ
  - พัฒนา UI ครบวงจรใน `frontend/src/App.tsx` ตามหลัก Hyperstudio Aesthetic Tokens:
    - **Header & Navigation**: แสดงสถานะ API Health แบบเรียลไทม์, แท็บสลับหน้า (MCP Servers, AI Skills, Admin Queue), และ Quick Login สลับโปรไฟล์ Admin/Developer
    - **MCP Tool Catalog Tab**: แสดงการ์ดเครื่องมือ, คำสั่งติดตั้ง `npx` พร้อมปุ่มคลิกคัดลอกใน 1 วินาที, สถิติ GitHub Stars / Downloads, และ Checkbox เลือกเพื่อ Compile
    - **AI Skills Engine Tab**: แถบฟิลเตอร์แยกตาม Client (`Claude Desktop`, `Cursor`, `Cline`, `Antigravity`), แสดง Badge ผลการสแกนความปลอดภัย (Scanned Clean vs Flagged), และ Drawer ตรวจสอบเนื้อหา `SKILL.md`
    - **Admin Governance Queue Tab**: คิวตรวจรับรอง Submissions สำหรับแอดมิน พร้อมปุ่มกด Approve & Verify / Reject และไฮไลต์คำเตือนจาก LLM01 Heuristic Scanner
    - **Floating Sticky Action Tray**: แถบเครื่องมือลอยตัวด้านล่าง แสดงจำนวน Servers & Skills ที่เลือก พร้อม Dropdown ให้เลือก Client ปลายทาง และปุ่ม 1-Click Export
    - **Generated Config Modal**: แสดงผลลัพธ์ JSON Snapshot พร้อมปุ่ม Copy to Clipboard และ Download File
  - ทดสอบการคอมไพล์ Frontend Production Bundle: `npm run build --workspace=frontend`
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/tickets.md`
  - `frontend/src/services/api.ts`
  - `frontend/src/App.tsx`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run build --workspace=frontend`: คอมไพล์ผ่านสมบูรณ์ **0 Errors** (Vite v6.4.3 production bundle สร้างไฟล์ `dist/` ในเวลาเพียง 2.41s) 🚀
  - `npm run test --workspace=backend`: ผ่านฉลุย **54/54 Tests (100% Pass Rate)** ครอบคลุมทั้ง 8 Test Files 🧪
  - `npx tsc --noEmit` (ทั้ง frontend & backend): **0 Type Errors** 🎯

---

### 📌 Entry #013: แก้ไข Environment Resolution, รัน Prisma DB Push, Database Seeding และปรับแต่ง Hyperstudio Design Tokens
- **วันและเวลา**: `2026-09-12 12:41:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แก้ไขปัญหา Prisma Schema Validation Error (`P1012 Environment variable not found: DATABASE_URL`) โดยสร้างไฟล์ `.env` ที่ Root Directory ของ ContextForge เพื่อให้คำสั่ง `npx prisma db push` ที่รันจากโฟลเดอร์ Root ค้นพบตัวแปรสภาพแวดล้อมได้ถูกต้อง
  - ดำเนินการรัน `npx prisma db push --schema=backend/prisma/schema.prisma` สำเร็จ ซิงค์ตารางทั้ง 6 ตาราง (`users`, `mcp_servers`, `tool_definitions`, `ai_skills`, `client_configs`, `submission_reviews`) เข้าสู่ PostgreSQL Container เรียบร้อย
  - ดำเนินการรัน `npm run seed --workspace=backend` สำเร็จ ใส่ข้อมูลเริ่มต้นครบ 100%:
    - 3 บัญชีผู้ใช้: `admin@contextforge.dev` (Admin), `developer@contextforge.dev` (Dev), `visitor@contextforge.dev` (Public)
    - 5 MCP Servers & Tools
    - 5 AI Skills (รวม 1 Flagged Security Sample เพื่อทดสอบระบบตรวจจับ)
    - 2 Submission Reviews ในคิวตรวจสอบแอดมิน
    - 1 Sample ClientConfig
  - แก้ไขปัญหา Frontend Tailwind v4 & Design Tokens:
    - เชื่อมโยงปลั๊กอิน `@tailwindcss/vite` เข้าสู่ `frontend/vite.config.ts` ในอาร์เรย์ `plugins: [react(), tailwindcss()]`
    - เพิ่มคำสั่ง `@import "tailwindcss";` ใน `frontend/src/index.css` เพื่อให้ Tailwind v4 คอมไพล์ Utilities ครบถ้วน (ขนาด CSS Bundle เพิ่มขึ้นจาก 3.30 kB เป็น 25.76 kB)
    - อัปเดต `frontend/src/App.tsx` ให้ประยุกต์ใช้ Design Tokens จาก `styles/tokens.json` อย่างสมบูรณ์:
      - พื้นหลัง Obsidian (`#101010`), การ์ด Carbon (`#080808`), ขอบ Graphite (`#212121`), ข้อความ Chalk (`#f3f3f3`) และ Smoke (`#9c9c9c`)
      - ปุ่ม Action สไตล์ `.btn-pill` (Signal White `#ffffff` ตัด Obsidian `#101010`)
      - อัปเดตข้อมูล Quick Login ให้ตรงกับ Database Seed จริง (`admin@contextforge.dev` / `AdminPassword123!` และ `developer@contextforge.dev` / `DevPassword123!`)
      - เพิ่มแบนเนอร์แจ้งเตือนพร้อมปุ่ม Retry อัตโนมัติหาก Database ขัดข้อง
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `.env` (ContextForge Root)
  - `frontend/vite.config.ts`
  - `frontend/src/index.css`
  - `frontend/src/App.tsx`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npx prisma db push`: ซิงค์ตารางสำเร็จ Done in 249ms 🚀
  - `npm run seed --workspace=backend`: Seeded successfully 100% ฐานข้อมูลพร้อมใช้งานเต็มรูปแบบ 📦
  - `npm run build --workspace=frontend`: ผ่านฉลุย 0 Errors (25.76 kB CSS พร้อม Tailwind v4 utilities) 🎨
  - `npm run test --workspace=backend`: 54/54 Tests ผ่านฉลุย 100% 🧪

---

### 📌 Entry #014: ยกระดับ UI ด้วย shadcn/ui Components และรองรับการเชื่อมต่อ Supabase Database
- **วันและเวลา**: `2026-09-12 12:56:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - ติดตั้ง `clsx` และ `tailwind-merge` ใน `frontend/` และสร้าง Standard Utility Helper `cn()` ใน `frontend/src/lib/utils.ts` ตามสเปก shadcn/ui Open Code Architecture
  - สร้างชุด Flat-file Component Primitives ใน `frontend/src/components/ui/` โดยผสาน Hyperstudio Design Tokens เข้ากับ shadcn UI APIs:
    - `Button` (`frontend/src/components/ui/button.tsx`): รองรับ Variants `default` (Signal White), `secondary`, `outline`, `ghost`, `destructive`, และ `pill`
    - `Badge` (`frontend/src/components/ui/badge.tsx`): รองรับ Variants `default`, `secondary`, `success`, `warning` (LLM01 Flagged), `destructive`
    - `Card` (`frontend/src/components/ui/card.tsx`): Primitives ครบชุด `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
    - `TabsList` (`frontend/src/components/ui/tabs.tsx`): Accessible Tab switcher สำหรับสลับ Servers, Skills และ Admin Queue
    - `Dialog` (`frontend/src/components/ui/dialog.tsx`): Modal Dialog สำหรับแสดงผลลัพธ์ Config JSON และ Inspect `SKILL.md`
  - ปรับปรุง `frontend/src/App.tsx` ให้ใช้ Component Primitives จาก shadcn/ui ทั้งหมด ส่งผลให้หน้าตาแอประดับ Production มีมิติ สวยงาม สะอาดตา และคงไว้ซึ่งคอนเซปต์ Hyperstudio (Obsidian, Carbon, Graphite, Chalk, Smoke, Compass Gold)
  - จัดเตรียมสถาปัตยกรรม Database Connection ให้รองรับทั้ง Local Docker PostgreSQL และ Supabase Cloud PostgreSQL เพียงแค่เปลี่ยน Connection String ใน `.env`
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `frontend/package.json`
  - `frontend/src/lib/utils.ts`
  - `frontend/src/components/ui/button.tsx`
  - `frontend/src/components/ui/badge.tsx`
  - `frontend/src/components/ui/card.tsx`
  - `frontend/src/components/ui/tabs.tsx`
  - `frontend/src/components/ui/dialog.tsx`
  - `frontend/src/App.tsx`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npm run build --workspace=frontend`: ผ่านฉลุย **0 Errors** (Bundle size: 26.91 kB CSS, 202.57 kB JS) 🚀
  - `npm run test --workspace=backend`: ผ่านฉลุย **54/54 Tests (100% Pass Rate)** 🧪

---

### 📌 Entry #015: เชื่อมต่อ Supabase Cloud PostgreSQL ผ่าน IPv4 Session Pooler, ซิงค์ Schema และ Seed ข้อมูลสำเร็จ 100%
- **วันและเวลา**: `2026-09-12 13:08:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - วินิจฉัยและแก้ไขปัญหาการเชื่อมต่อ Supabase Database จาก Direct Connection (`db.yliruhaqkbeatlfayzrr.supabase.co:5432`):
    - เนื่องจาก Supabase Direct Host เป็น IPv6-only (AAAA Record) ทำให้เครื่องลูกข่าย Windows บนเครือข่ายอินเทอร์เน็ตที่ไม่มี IPv6 Routing เกิดข้อผิดพลาด `P1001: Can't reach database server`
    - ดำเนินการสลับมาใช้ **Supabase Connection Pooler (Session Mode)** ผ่าน Host IPv4 ของ AWS Singapore Region (`aws-0-ap-southeast-1.pooler.supabase.com:5432`) และระบุ Username ตามแพทเทิร์น `postgres.yliruhaqkbeatlfayzrr`
  - อัปเดต `DATABASE_URL` ใน `.env` และ `backend/.env` ให้ชี้ไปยัง Supabase Session Pooler อย่างปลอดภัย
  - รันคำสั่ง `npx prisma db push --schema=backend/prisma/schema.prisma` สำเร็จ ซิงค์ Schema ทั้ง 6 ตาราง (`users`, `mcp_servers`, `tool_definitions`, `ai_skills`, `client_configs`, `submission_reviews`) ขึ้นบน Supabase Cloud ได้ครบถ้วนภายใน 1.77s
  - รันคำสั่ง `npm run seed --workspace=backend` ดำเนินการ Seed ข้อมูลตั้งต้นเข้า Supabase Table Editor สำเร็จครบ 100%:
    - 3 บัญชีผู้ใช้ (`admin@contextforge.dev`, `developer@contextforge.dev`, `visitor@contextforge.dev`)
    - 5 MCP Servers & Tools definitions
    - 5 AI Skills (รวม Malicious prompt injection sample สำหรับทดสอบ Security Scanner)
    - 2 Submission Reviews สำหรับ Admin Queue
    - 1 Sample ClientConfig
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `.env`
  - `backend/.env`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npx prisma db push`: ซิงค์โครงสร้างตารางขึ้น Supabase สำเร็จ (1.77s) 🚀
  - `npm run seed --workspace=backend`: Seeded successfully 100% บน Supabase Table Editor 📦
  - `npm run test --workspace=backend`: ผ่านฉลุย **54/54 Tests (100% Pass Rate)** ครบทั้ง 8 Test Files 🧪
  - `npm run build --workspace=frontend`: ผ่านฉลุย **0 Errors** (Bundle size: 26.91 kB CSS, 202.57 kB JS) 🎨

---

### 📌 Entry #016: รีแฟกเตอร์ Primary Key ให้ตรงตามชื่อแต่ละ Table (`user_id`, `server_id`, `tool_id`, `skill_id`, `config_id`, `review_id`)
- **วันและเวลา**: `2026-09-12 13:20:00 +07:00`
- **ผู้ดำเนินการ**: Antigravity AI Pair Programmer
- **การกระทำ (Action)**:
  - แก้ไข `backend/prisma/schema.prisma` เปลี่ยนชื่อฟิลด์ Primary Key จาก `id` ทั่วไปให้เป็นชื่อเฉพาะที่บ่งบอกตารางอย่างชัดเจนตามข้อกำหนดของวิชา Server-Side Web Development:
    - `users.user_id`
    - `mcp_servers.server_id`
    - `tool_definitions.tool_id`
    - `ai_skills.skill_id`
    - `client_configs.config_id`
    - `submission_reviews.review_id`
  - ปรับปรุง Foreign Key Relations ใน Prisma Models ทั้งหมดให้เชื่อมโยงผ่าน PK ใหม่ (`submitted_by` -> `user_id`, `server_id` -> `server_id`, `reviewer_id` -> `user_id`)
  - รัน `npx prisma db push --schema=backend/prisma/schema.prisma --force-reset` ซิงค์ Schema ขึ้น Supabase Cloud PostgreSQL ผ่าน IPv4 Session Pooler สำเร็จ (1.50s)
  - อัปเดต `backend/prisma/seed.ts` ให้เรียกใช้ PK ใหม่ และรัน `npm run seed --workspace=backend` รีเซ็ตข้อมูลตั้งต้นเข้าตารางใน Supabase ครบ 100%
  - ปรับปรุง Backend Middlewares, Controllers, และ Services:
    - `backend/src/middlewares/auth.middleware.ts`: อัปเดต `AuthenticatedUser` ให้มี `user_id` และ alias `id`
    - `backend/src/controllers/auth.controller.ts`: อัปเดตการเลือกและค้นหาด้วย `user_id`
    - `backend/src/controllers/server.controller.ts`: อัปเดตการค้นหา, เพิ่ม Tool, และ soft-delete ด้วย `server_id`
    - `backend/src/controllers/skill.controller.ts`: อัปเดตการค้นหาและอัปเดตด้วย `skill_id`
    - `backend/src/controllers/config.controller.ts`: อัปเดตการค้นหาและสร้าง Snapshot ด้วย `config_id`, `server_id`, `skill_id`
    - `backend/src/controllers/admin.controller.ts`: อัปเดตการรีวิวและ takedown ด้วย `review_id`, `server_id`, `skill_id`
  - ปรับปรุง Frontend Interfaces ใน `frontend/src/services/api.ts` รองรับ PK เฉพาะตารางร่วมกับ `id`
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `scratch/plan.md`
  - `scratch/tickets.md`
  - `backend/prisma/schema.prisma`
  - `backend/prisma/seed.ts`
  - `backend/src/middlewares/auth.middleware.ts`
  - `backend/src/services/configGenerator.service.ts`
  - `backend/src/controllers/auth.controller.ts`
  - `backend/src/controllers/server.controller.ts`
  - `backend/src/controllers/skill.controller.ts`
  - `backend/src/controllers/config.controller.ts`
  - `backend/src/controllers/admin.controller.ts`
  - `frontend/src/services/api.ts`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npx prisma db push --force-reset`: ฐานข้อมูล Supabase รีเซ็ตและซิงค์โครงสร้างตารางใหม่สำเร็จ (1.50s) 🚀
  - `npm run seed --workspace=backend`: Seeded successfully 100% 📦
  - `npm run test --workspace=backend`: ผ่านฉลุย **54/54 Tests (100% Pass Rate)** ครอบคลุมทั้ง 8 Test Files 🧪
  - `npm run build --workspace=frontend`: ผ่านฉลุย **0 Errors** (Vite build 2.43s) 🎨

---

### 📌 Entry #017: ปรับหน้าเว็บให้ตรงตาม DESIGN.md และ UX.md (Obsidian / Hairline design system)
- **วันและเวลา**: `2026-09-28 11:00:00 +07:00`
- **ผู้ดำเนินการ**: Claude Code
- **การกระทำ (Action)**:
  - แทนที่ primitives แบบ shadcn ใน `frontend/src/components/ui/` ด้วยชุด component ของ design system: `Button` (primary pill / ghost / quiet), `StatusBadge`, `Tag`, `RiskMeter`, `Tabs`, `SearchField`, `RegistryCard`, `ScanReport`, `ConfigRail`, `EmptyState`, `Dialog` และลบ `card.tsx`
  - ตัดสิ่งที่ขัดกับ DESIGN.md ออก: สี emerald/amber/red, drop shadow, `rounded-xl`/`rounded-2xl`, `font-semibold`, ไอคอน Sparkles และตัวเลข "100% Verified"
  - แสดงระดับความเสี่ยงด้วย `RiskMeter` (แท่ง 1–4 + ชื่อระดับ + code) แทนจุดสี เพื่อไม่พึ่งสีอย่างเดียว (WCAG 1.4.1)
  - Hero แสดง tool ทุกตัวจัดเป็น 4 คอลัมน์ตามระดับความเสี่ยงจากข้อมูลจริง
  - Config cart ตรวจ `compatible_clients` และปิดปุ่ม Generate จนกว่าจะแก้ความไม่เข้ากัน (UX.md ขั้นที่ 4)
  - Admin review queue เรียง flagged ก่อน, แสดงผลสแกน LLM01 และบังคับกรอก review note ก่อน reject (UX.md Persona D)
  - Backend: `GET /api/v1/servers` คืน `tools { name, risk_level }` และ `is_verified` เพื่อให้การ์ดแสดงระดับความเสี่ยงได้
  - แก้บั๊ก Inspect SKILL.md แสดงค่าว่าง: list endpoint ไม่คืน `skill_content` จึงเพิ่ม `fetchSkill()` ดึงจาก `GET /skills/:id`
  - ฟอนต์: ใช้ Geist และ IBM Plex Mono แทน Aeonik / Input ที่ไม่มีไฟล์ใน repo
- **ไฟล์ที่สร้าง/แก้ไข**:
  - `backend/src/controllers/server.controller.ts`
  - `backend/src/__tests__/servers.test.ts`
  - `frontend/index.html`
  - `frontend/src/index.css`
  - `frontend/src/App.tsx`
  - `frontend/src/services/api.ts`
  - `frontend/src/components/ui/*`
  - `DEV_LOG.md`
- **ผลการทดสอบ/ยืนยัน**:
  - `npx vitest run` (backend): 55/55 tests ผ่าน (เพิ่ม 1 test ตรวจว่า list คืน risk level ของ tool)
  - `tsc --noEmit` และ `vite build` (frontend): 0 errors
  - ทดสอบ end-to-end ด้วย Playwright บน build จริงโดย mock `/api/v1` จาก seed data: 16/16 checks ผ่าน (เพิ่มลง cart, คำเตือน client, generate, Esc ปิด dialog, `/` focus search, empty state, admin reject ต้องมี note, mobile 390px ไม่มี horizontal scroll)
  - ยังไม่ได้ทดสอบกับฐานข้อมูล Supabase จริง


---

### Entry #018: ปิดงานตามข้อกำหนดวิชา, เลิกใช้ mock, ทดสอบกับ PostgreSQL จริง (branch `feat/final-polish`)
- **วันที่**: `2026-11-10` ถึง `2026-11-11`
- **ผู้ดำเนินการ**: Claude Code (แผนงาน `contextforge-final`, ตะวันอนุมัติทุก Gate)
- **Backend**
  - owner แก้ server หรือ skill ที่อนุมัติแล้ว: `is_verified = false` และเข้าคิวรีวิวใหม่ (กัน bait-and-switch), skill สแกนใหม่ทุกครั้ง
  - generate config ตรวจ verified ภายใน transaction ด้วย `updateMany` แบบมีเงื่อนไข; takedown ที่แทรกกลาง request ทำให้ rollback และตอบ id ที่ถูกปฏิเสธ
  - rate limit 60/นาที ทั่วไป, 10/นาที สำหรับ login/register และ generate (429 + `Retry-After`)
  - `JWT_SECRET` บังคับใน production (32 ตัวขึ้นไป), bcrypt cost 12, DELETE ตอบ 204, path id ผิดรูปตอบ 400 `INVALID_ID`
  - endpoint ใหม่: `/servers/me`, `/skills/me`, `/configs/me`, `/admin/metrics`, `/admin/sync/github`, `/skills/scan`, `DELETE /servers/:id/tools/:toolId`
  - error handler: DB ล่มตอบ 503, P2002 เป็น 409, P2025 เป็น 404, 500 ไม่ส่งรายละเอียดภายใน; `/health` ถาม DB จริง
  - config ที่ generate เป็นรูปแบบไฟล์จริงของแต่ละ client และ skill ออกเป็นไฟล์ตาม path ของ client
- **บั๊กที่เจอ**: `dotenv.config()` รันหลัง ESM import ทำให้ไม่เคยอ่าน `JWT_SECRET` จริง; route async ของ admin/config ไม่มี try/catch ทำให้ process ปิดเมื่อ DB error
- **Frontend**: แยกหน้าเป็น Browse / Server / Skill / Workspace / Admin, session ผ่าน HttpOnly cookie, ฟอร์มส่ง/แก้/ลบ, สแกนก่อนส่ง, admin metrics, takedown, pagination, toast aria-live, error boundary; ลบปุ่มบัญชีเดโม
- **ข้อมูล**: seed เป็น MCP server ที่มีอยู่จริง 10 ตัว (35 tools) และ skill 5 ตัว, ดาว GitHub sync จาก api.github.com, รหัสผ่านบัญชีสุ่มลงไฟล์ local ที่ไม่อยู่ใน git; ใส่ index 12 ตัว (GIN 4 ตัว) เข้า Supabase
- **การทดสอบ**: เลิก mock Prisma ทั้งหมด, 111 integration test ยิง PostgreSQL จริงใน schema `ctxforge_test` (ไม่แตะ `public`), มี test race ด้วย row lock จริง; `npm run e2e` รัน Postman 50 request / 74 assertion ผ่านหมด
- **เอกสาร**: `docs/API.md` (29 endpoint), `docs/postman/`, `docs/DEMO.md`, `CASE_STUDY.md`, README ใหม่
- **ผลการตรวจ**: `npm test --workspace=backend` 111/111, `tsc` backend/frontend ผ่าน, `vite build` ผ่าน, `node scripts/check-docs.mjs` ผ่าน

---

### Entry #019: แก้ finding จาก UX/UI audit และระบบ import จาก GitHub (branch `feat/audit-fixes-and-import`)
- **วันที่**: `2026-11-11`
- **ผู้ดำเนินการ**: Claude Code (แผนงาน `contextforge-import-fixes`)
- **UX/UI audit (วัดด้วย Playwright บน production build)**
  - Dialog มี focus trap (Tab วน 21 ครั้งไม่หลุด, Esc ปิดแล้ว focus กลับปุ่มเดิม)
  - Footer ไม่ถูก dock มือถือทับ (footer bottom 716px <= dock top 732px); เดิมทับ 48px ซ่อนบรรทัดเปิดเผยว่าวิดีโอสร้างด้วย AI
  - มือถือมีลิงก์ API docs ใน dock และไม่มี Sign in ซ้ำ; ปลายทางสัมผัสเล็กกว่า 24px เหลือ 0; วันที่ใช้ "11 Nov 2026"; ป้าย "runs" เปลี่ยนเป็น "exports"; cursor ของ chip เป็น pointer
  - `/auth/me` ตอบ 401 ครั้งเดียวบน production build (ซ้ำสองครั้งเฉพาะ dev เพราะ React StrictMode)
- **Import จาก GitHub**
  - คอลัมน์ `source_url`, `source_license`, `source_ref` (migration `20261111000001`, ใส่ Supabase แล้ว)
  - `githubImport.service.ts`, `POST /admin/import/github`, `POST /admin/submissions/approve-clean`, ฟอร์มใน Admin, CLI `npm run import:github`
  - กฎที่ test ล็อกไว้: host allowlist, install_command ต้องเป็น npx/uvx/docker run ไม่มี shell syntax, ข้าม MCP ที่ไม่มี tool list, ไม่สร้างซ้ำ (ชื่อ, package, เนื้อหาเหมือนกัน), โฟลเดอร์ที่มี SKILL.md เกิน 50 ไฟล์เอาแค่ 3, หยุดแบบ partial เมื่อโควตาหมด
  - ผลจริงรอบแรก (ไม่มี token): skills 59 และ servers 15 อยู่ในคิว pending
  - ผลจริงหลังใส่ `GITHUB_PAT` (โควตา 5,000/ชม.): skills 139 (จาก 10 repo ดาว 759 ถึง 451,523) และ servers 34 (ดาว 112 ถึง 33,859, มัธยฐาน 358) ทั้งหมด pending, scanner ไม่พบ flag
  - เพิ่มตัวกรอง `min_stars` และให้ awesome list เรียงตามดาวก่อน import (ค้นสูงสุด 1,200 ลิงก์เมื่อมี token) หลังพบว่ารอบแรกได้ MCP มัธยฐานแค่ 4 ดาว; ลบ MCP ที่ import เองและต่ำกว่า 200 ดาว 70 แถว
  - MCP ส่วนใหญ่ถูกข้าม (ราว 60% ไม่มี tool list, ราว 30% ไม่มีคำสั่งติดตั้งที่ปลอดภัยใน README) เพราะไม่เดา risk level
- **บั๊กที่เจอระหว่างทาง**: `safeInstallCommand` ยุบบรรทัดใหม่เป็นช่องว่างก่อนตรวจ (test จับได้); run แรกกับ topic ล้มทั้งรอบเพราะ README ยาวเกิน 100,000 ตัวอักษร (ตอนนี้ตัดแทนปฏิเสธ); import สร้างรายการซ้ำกับ seed (`memory-modelcontextprotocol`, `context7-upstash`) และสกิล `*-automation` 35 ตัวจากเทมเพลต ลบเฉพาะแถวที่ import เองและยัง pending แล้ว
- **ผลการตรวจ**: `npm test` 159/159, `npm run e2e` Postman 55 request / 81 assertion ผ่านหมด, `tsc` และ `vite build` ผ่าน, `check-docs` ผ่าน, `db:check` 12/12
- **ข้อจำกัด**: โควตา GitHub แบบไม่ใช้ token คือ 60 call/ชม. ไม่มี `GITHUB_PAT` จะได้ 60 call/ชม. และ awesome list ไม่ถูกจัดอันดับตามดาว; รายการ tool และระดับความเสี่ยงของ MCP ที่ import มาอ่านจาก README ด้วยคีย์เวิร์ด ยังไม่ผ่านการยืนยัน (บางตัวได้ 40 tools ซึ่งเป็นเพดาน อาจรวมบรรทัดที่ไม่ใช่ tool)

---

### Entry #020: หน้าแรกสั้นลง, อ่านสกิลได้, กดการ์ดแล้วเปิดรายละเอียด (branch `feat/audit-fixes-and-import`)
- **วันที่**: `2026-11-11`
- **ผู้ดำเนินการ**: Claude Code (แผนงาน `contextforge-import-fixes`)
- **ปัญหา** หลังตะวันอนุมัติรายการที่ import (44 servers, 139 skills) ส่วน "Four kinds of reach" แสดงครบ 539 tools จนต้องเลื่อนไกลกว่าจะถึงแท็บ MCP/Skills
- **แก้**
  - แต่ละ lane แสดง 8 tools (ไล่จาก server ดาวสูงสุด สลับทีละ server) พร้อม "N more in the registry" และตัวเลขรวมยังเป็นของจริง (539 tools, 44 servers); ปุ่ม "Browse 44 MCP servers" และ "Browse 139 skills" เลื่อนไปที่รายการและเปลี่ยนแท็บให้
  - ระยะจาก lanes ถึงรายการ: desktop 926px (1 หน้าจอ), มือถือ 1,076px (1.3 หน้าจอ)
  - หน้า detail ของสกิลมีโหมด Read (จัดรูปหัวข้อ รายการ โค้ด ลิงก์ https) กับ SKILL.md source; สร้างจาก React element เท่านั้น ไม่ฉีด HTML
  - การ์ดสกิลแสดงแท็กต้นทาง (github, เจ้าของ repo) แทนป้าย client ที่เหมือนกันทุกใบ; คำอธิบายตัดที่ 4 บรรทัด; กดตรงไหนของการ์ดก็เปิดหน้ารายละเอียด
  - รายการเรียง `downloads_count`, `github_stars`, `name` (ทุกรายการมี downloads 0 ลำดับเดิมไม่แน่นอนและแบ่งหน้าอาจซ้ำ/ตกหล่น)
- **บั๊กข้อมูลที่เจอ**: parser อ่านชื่อตัวแปร env `IDA_MCP_MAX_WORKERS` เป็น tool ของ `ida-pro-mcp` ที่ถูกอนุมัติแล้ว ถอนออกจากหน้าสาธารณะแบบ takedown (บันทึก review) และแก้ parser ให้ปฏิเสธชื่อ ALL_CAPS พร้อม test
- **ที่ยังเหลือ**: สกิล 5 รายการที่ scanner ติด flag ยังอยู่ในคิว (browser-testing-with-devtools, create-agent-adapter, paperclip, security-and-hardening, source-driven-development) ให้ admin อ่านก่อนตัดสิน
- **ผลการตรวจ**: `npm test` 160/160, `tsc` และ `vite build` ผ่าน, `check-docs` ผ่าน, วัดด้วย Playwright บนข้อมูลจริง (อ่านอย่างเดียว) ที่ 1440 และ 375

---

### Entry #021: popup ล็อกหน้าหลัง และกลับมาตำแหน่งเดิมหลังอ่านรายละเอียด (branch `feat/audit-fixes-and-import`)
- **วันที่**: `2026-11-11`
- **ผู้ดำเนินการ**: Claude Code (แผนงาน `contextforge-import-fixes`)
- **Popup**: ทุก popup ใช้ `Dialog` ตัวเดียว เมื่อเปิดจะล็อกการเลื่อนของหน้าหลัง (`html.is-scroll-locked` + `lenis.stop()`, นับจำนวน popup ที่เปิดซ้อนกัน) ล้อเมาส์บนฉากเบลอไม่ขยับหน้า ส่วนในตัว popup เลื่อนเนื้อหาข้างใน (`data-lenis-prevent`) ปิดแล้วหน้าเลื่อนได้ตามเดิม
- **กลับมาตำแหน่งเดิม**: หน้าแรกจำตำแหน่งเลื่อน แท็บ คำค้น ตัวกรองและหน้าที่เลือก รวมถึงข้อมูลรายการที่แสดง (`lib/browseMemory.ts`) ใช้ได้ทั้งปุ่ม back ของเบราว์เซอร์และลิงก์ "Registry" ส่วน "Browse" และโลโก้ในแถบนำทางเริ่มใหม่ที่บนสุดตามความตั้งใจ
- **บั๊กที่เจอ**: (1) เมื่อออกจากหน้าแรก เอกสารหดและเบราว์เซอร์บีบตำแหน่งเลื่อน ทำให้ค่าที่จดไว้ถูกทับ (จดเฉพาะตอน URL ยังเป็นหน้าแรก) (2) Lenis จำระยะเลื่อนสูงสุดของหน้าก่อนหน้าและบีบ `scrollTo` ลงเหลือ 260px (เรียก `lenis.resize()` ก่อนเลื่อน)
- **ผลการตรวจ** (Playwright, ข้อมูลจริงแบบอ่านอย่างเดียว): ปุ่ม back กลับ y 2318 -> 2318 แท็บ Skills หน้า 2 จาก 12 (desktop และ 375px); ลิงก์ Registry 2617 -> 2617; ล็อกหน้าหลัง popup: ล้อบนฉากเบลอ 1080 -> 1080, ล้อในตัว popup เลื่อนข้างใน 0 -> 111, ปิดแล้วเลื่อนหน้าได้อีก (1080 -> 1440); focus trap และ contrast ยังผ่าน; `npm test` 160/160

---

### Entry #022: แก้จาก code review และ UX/UI audit รอบ 2 (branch `fix/review-round2`)
- **วันที่**: `2026-11-12`
- **ผู้ดำเนินการ**: Claude Code (แผนงาน `contextforge-review-fixes`)
- **ชุดตรวจ UI ใน repo**: `npm run ui:check` (playwright-core) 8 เคส อ่านอย่างเดียว: dialog (focus ไม่ถึงหน้าหลังฉาก, ล้อบนฉากไม่ขยับหน้า, เลื่อนข้างใน, Esc คืน focus), กลับตำแหน่งเดิม (ปุ่ม back และลิงก์ Registry, desktop/มือถือ), focus หลังปุ่มกระโดด, `h1` ของหน้าเต็ม, เลย์เอาต์มือถือ, เป้าสัมผัส >= 24px, ยอด lanes ตรงกับ API, "1 export" วิธีใช้อยู่ที่ `docs/UI_CHECKS.md` เคส 3, 4, 6, 8 แดงก่อนแก้และเขียวหลังแก้
- **ข้อมูลที่ import**: `isLikelyTool` ตัดหมวด/พารามิเตอร์/ชื่อไฟล์/หัวตาราง ออกจากรายการ tool; `classifyRisk` สองชั้น (ชื่อ tool จับตาม stem, คำอธิบายจับเฉพาะกริยาเต็ม เพราะ stem ทำให้ "Editor", "merged", "evaluate and rank" กลายเป็น destructive); เนื้อหา MCP ผ่าน scanner จริง (เดิม `flagged_by_scan` เป็น false ตายตัว); เพดาน tool 150; กันสกิลที่คำอธิบายซ้ำกัน; `approve-clean` เริ่มจากรายการ import จึงไม่ถูกรายการอื่นกินโควตา 500 และบอก `capped`
- **UI**: `h1` ของ 6 หน้าเต็ม, focus ไปที่ `#browse-h` หลังปุ่มกระโดด, ลิงก์ภายนอกขีดเส้นใต้และสูง >= 24px, plural, license บนการ์ด, สารบัญของสกิลยาว, "40+" ของ server ที่ถูกตัดที่ 40 เดิม
- **Dialog**: เปลี่ยนเป็น `<dialog>.showModal()` เนทีฟ (ถอด focus trap/focusin ที่เขียนเอง ~45 บรรทัด) คงตัวล็อกการเลื่อนของหน้าไว้ เพราะ modal dialog ไม่ล็อกการเลื่อนของหน้าเอง ที่ขอบ dialog Tab ส่งต่อให้ UI ของเบราว์เซอร์ (ไม่ใช่หน้าหลังฉาก) ตามธรรมชาติของ modal เนทีฟ
- **สคริปต์ข้อมูลเดิม**: `npm run reclassify:imported` (dry-run, `--apply` สำรอง JSON ก่อน, ไม่แตะ `is_verified`, ไม่ลดระดับ) ผล dry-run บนข้อมูลจริง: 81 รายการที่ไม่ใช่ tool, 15 รายการยกระดับ, 4 server เหลือ 0 tool (alibaba-cloud-ops-mcp-server, desktopcommandermcp, ffmpeg-skill, k8s-mcp-server) ยังไม่ได้ apply รอตะวัน
- **ผลการตรวจ**: `npm test` 175/175, `npm run e2e` 81 assertion ผ่าน, `tsc` และ `vite build` ผ่าน, `check-docs` ผ่าน, `ui:check` 8/8 เขียว

---

### Entry #023: ข้อมูลจริงหลัง review: ลบ tool ปลอม ยกระดับความเสี่ยง takedown (branch `fix/review-round2`)
- **วันที่**: `2026-11-12`
- **ผู้ดำเนินการ**: Claude Code ตามที่ตะวันอนุมัติตาราง dry-run และสั่งให้ takedown `template-skill` กับสกิลซ้ำเพิ่ม
- **ที่ apply กับ Supabase `public`**:
  - `reclassify:imported --apply`: ลบ 81 รายการที่ไม่ใช่ tool และยกระดับ 15 รายการ (สำรองที่ `06_RESOURCES/02_REFERENCE_ASSETS/Generated_Media/2026-11-12_review-fixes/reclassify-backup.json`)
  - takedown 4 server ที่เหลือ tool 0 ตัว: `alibaba-cloud-ops-mcp-server`, `desktopcommandermcp`, `ffmpeg-skill`, `k8s-mcp-server`
  - takedown 4 สกิล: `template-skill` (คำอธิบายยังเป็น "Replace with description..."), `artifacts-builder` และ `mcp-builder` (สำเนา mirror ของ ComposioHQ; ฉบับต้นทาง `web-artifacts-builder` และ `mcp-builder-anthropics` ยังอยู่), `impeccable-pbakaus` (คู่ของ `impeccable` จาก repo เดียวกัน เก็บชื่อที่สะอาดกว่า)
  - ทุก takedown เป็น soft delete + `is_verified = false` + review สถานะ rejected ขึ้นต้น `[TAKEDOWN]` (ทำด้วย SQL เพราะไม่มีรหัส admin)
- **ผลบนหน้าเว็บ**: 39 servers, 135 skills, 457 tools (lanes 9/319/40/89 จาก 9/402/47/80), ไม่มี server ที่ไม่มี tool, dry-run รอบสุดท้ายไม่เหลือรายการ
- **หมายเหตุกระบวนการ**: คำสั่ง takedown 4 server ชุดแรกถูกรายงานว่า "ปฏิเสธ" แต่ถูกรันไปแล้ว (ตรวจพบจากการนับแถวที่ได้ 0 ในคำสั่งถัดมา) ผลตรงกับที่ตะวันอนุมัติ ไม่มีรายการซ้ำ

---

### Entry #024: เตรียม deploy บน Render (branch `feat/deploy-prep`)
- **วันที่**: `2026-11-12`
- **ผู้ดำเนินการ**: Claude Code (แผนงาน `contextforge-deploy-prep`) ตามที่ตะวันสั่ง "deploy บน Render ทำข้อ 1-5"
- **สิ่งที่แก้ในโค้ด**:
  - `TRUST_PROXY` (ค่าเริ่มต้น 0) ตั้ง `trust proxy` ของ Express; หลัง load balancer ของ host ผู้ใช้แต่ละคนได้โควตา rate limit แยกกัน และเมื่อเป็น 0 ส่วนหัว `X-Forwarded-For` ที่ปลอมมาไม่มีผล (test ทั้งสองทิศ)
  - API เสิร์ฟ `frontend/dist` เอง (`/assets` cache แบบ immutable, path ที่ไม่มีนามสกุลและไม่ใช่ `/api` ได้ `index.html`, ไฟล์หายและ `/api/*` ที่ไม่มีได้ JSON 404) จึงอยู่ origin เดียวกับ cookie `SameSite=strict`
  - สคริปต์ธีมใน `index.html` ย้ายไป `frontend/public/theme-init.js` เพราะ CSP ของ helmet ห้าม inline script (มี test กันไม่ให้ใส่กลับ)
  - ไอคอนแท็บชี้ `/vite.svg` ซึ่งไม่มีไฟล์ (404) เปลี่ยนเป็น `favicon.svg` ที่เพิ่มใหม่
  - `npm run seed` ล้าง 6 ตาราง ตอนนี้ต้องใส่ `--confirm-wipe` เว้นแต่ schema เป็น `ctxforge_test` (`config/seedGuard.ts`, error ไม่พิมพ์ connection string)
  - `npm audit fix` + `bcrypt` 5 -> 6 + `express` 4.22.3: ช่องโหว่ production จาก 7 เหลือ 1 (`zod` ต้องข้ามเป็น major 4; body จำกัด 2 MB จึงเลื่อนไปทำแยก)
  - `render.yaml`, `docs/DEPLOY.md`, `npm run db:deploy`, `TRUST_PROXY` ใน `.env.example`
- **ผลการตรวจ**: `npm test` 197/197, `npm run e2e` 81 assertion ผ่าน, build ทั้งสอง workspace ผ่าน, `check-docs` ผ่าน; บูต `NODE_ENV=production` origin เดียว: health 200, ไม่มี CSP violation ใน Chromium 7 route + dialog, deep link หลัง reload ผ่าน, `ui:check` 8/8 เขียว (ต้องตั้ง `RATE_LIMIT_PER_MIN` สูงเพราะโควตา 60/นาทีหมดกลางชุดตรวจ)
- **ยังไม่ได้ตรวจ**: build บน Render จริง (ในเครื่องใช้ Node 26, `render.yaml` ตั้ง Node 22), จำนวน proxy hop หน้า Render (ถ้า rate limit ล็อกทุกคนพร้อมกันให้ตั้ง `TRUST_PROXY=2`), ความเร็ว cold start ของแผนฟรี
- **เทียบกับ Vercel** (ข้อมูลจากเอกสาร Vercel ที่ค้นวันนี้ + การวิเคราะห์โค้ดของเราเอง):
  - รองรับ: Express ทำงานเป็น Vercel Function ได้เมื่อมี entrypoint ชื่อที่ระบบรู้จัก (เช่น `src/index.ts`); Fluid compute เปิดเป็นค่าเริ่มต้นสำหรับโปรเจกต์ใหม่; ตั้ง `maxDuration` ได้ใน `vercel.json`; แผน Hobby เลือกได้ 1 region
  - ต้องแก้โค้ดก่อน (วิเคราะห์จากโค้ดนี้ ยังไม่ได้ลองบน Vercel): (1) rate limiter เป็น `Map` ในโปรเซส ใช้ไม่ได้เมื่อมีหลาย instance ต้องย้ายไปที่เก็บร่วมหรือ rate limiting ของ Vercel; (2) Prisma ต่อ Supabase ต้องใช้ pooler และตั้ง `binaryTargets` ให้ตรง runtime; (3) admin import ยิง GitHub หลายสิบ request ต่อครั้ง ต้องตั้ง `maxDuration` ให้พอ; (4) แยก frontend เป็น static output และ rewrite `/api/*` ไปที่ function เพื่อให้คง origin เดียว
  - สรุป: ขึ้น Vercel ได้ แต่เป็นงานแก้โค้ดเพิ่ม 4 จุดข้างบน ขณะที่ Render ใช้ service เดียวได้เลยโดยไม่แก้โค้ด จึงเลือก Render ก่อน

