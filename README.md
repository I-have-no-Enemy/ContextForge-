# ⚡ ContextForge

> **Unified Governance, Security & Config Registry for MCP Tools and AI Skills**

ContextForge is a centralized platform designed to manage, secure, evaluate, and generate client configurations for **Model Context Protocol (MCP) Servers** and **AI Skills (`SKILL.md`)** across AI Agent ecosystems (Claude Desktop, Cursor, Cline, Antigravity).

---

## 🌟 Core Features

- **Dual-Ecosystem Registry**: First-class governance for both executable MCP tools and reusable AI instruction skills.
- **Security & Threat Governance**:
  - MCP Risk Rating (`read_only`, `network`, `filesystem`, `destructive`) with environment variable credential masking.
  - Indirect Prompt Injection Scanning & Validation for AI skills.
- **One-Click Config Generator**: Compose verified MCP servers and skills into ready-to-use client JSON configurations.
- **Zero-Trust JWT RBAC**: Strict role boundaries (`Public`, `Developer`, `Admin`) with token-claim extraction and Row-Level Security (RLS).
- **PostgreSQL JSONB + Relational Foundation**: Relational integrity for entities with GIN-indexed JSONB for dynamic parameter schemas.
- **Spec-Driven Architecture**: Grounded in GitHub Spec Kit (SDD), 2026 Enterprise Testing Checklist, and Ponytail Minimalist Engineering.

---

## 📂 Architecture & Spec-Kit Workflows

ContextForge is built using **GitHub Spec Kit** (`.specify/`):

- **Constitution**: [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
- **Workflows**:
  - `/speckit-specify` - Define feature specifications
  - `/speckit-plan` - Architecture & implementation planning
  - `/speckit-tasks` - Atomic task breakdowns
  - `/speckit-implement` - Test-Driven Implementation
  - `/speckit-converge` - Verification against spec
  - `/speckit-bug-*` - Bug Triage (Assess → Fix → Test)
  - `/speckit-assess-*` - Idea Assessment Pipeline

---

## 📄 License
MIT
