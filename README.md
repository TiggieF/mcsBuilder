# mcsBuilder

A 2D pixel-style management sim (Canvas) for COMP3751.  
You coordinate two AI workers (Builder + Delivery) and collect resources to construct the Durham MCS Building floor by floor.

---

## 🎮 Quick Start

1. Open `stages/stage-00-scaffold/index.html` directly in a browser.
2. Use:
   - **WASD** to move
   - **Space** to interact (pickup/drop/serve)

---

## 📘 Folder Map

| Folder | Description |
|--------|--------------|
| `docs/` | All documentation (PRD, architecture, roadmap, etc.) |
| `docs/stages/` | Each stage’s goals and acceptance criteria |
| `stages/` | Code organized by implementation stage |
| `prompts/` | Codex prompt templates for implementation, review, testing |
| `logs/` | Approvals, decisions, and known issues |
| `.env.example` | Template (no secrets) |

---

## 🚀 Build Process
No build tools needed.  
Each stage is an **HTML file runnable directly** in your browser — similar to COMP3751 lectures.

---

## 🧱 Stages Overview
1. **Stage 00** – Scaffold (grid, player, collisions, UI shell)
2. **Stage 02** – Domain model & state
3. **Stage 04** – Frontend UI + FSMs
4. **Stage 05** – Analytics + polish
5. **Stage 06** – Deployment packaging

Auth/API stages skipped (frontend-only project).

---

## 📜 License
Educational coursework — non-commercial use only.

# Stages — Overview

Each stage is incremental and playable independently.  
Codex will implement one stage per commit.

| Stage | Focus |
|--------|-------|
| 00 | Scaffold (Grid + Player + UI) |
| 01 | Auth (Skipped) |
| 02 | Domain Model |
| 03 | API CRUD (Skipped) |
| 04 | Frontend UI + FSM |
| 05 | Analytics |
| 06 | Deployment |
