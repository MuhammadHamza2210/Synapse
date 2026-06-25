---
title: Synapse API
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# 🧠 Synapse — AI Study/Research OS with a 3D Mind Palace

> 🔴 **Live demo:** **https://synapse-eight-ruby.vercel.app/**
>
> The 3D Mind Palace frontend is on Vercel; the FastAPI/RAG backend runs on
> Hugging Face. AI answers are powered by Google Gemini (with a local-Ollama
> fallback for development).

> Upload your knowledge → an AI maps it into a **3D galaxy of concepts** → ask questions and watch the relevant nodes **pulse** while a tutor answers, grounded in *your* documents with real citations.

Synapse turns a pile of PDFs and notes into a living, explorable knowledge graph you can *fly through* and *talk to*. It's a full **RAG (Retrieval-Augmented Generation)** pipeline wrapped in a cinematic, glassmorphism UI.

![stack](https://img.shields.io/badge/React-18-22d3ee) ![ts](https://img.shields.io/badge/TypeScript-5-3b82f6) ![three](https://img.shields.io/badge/Three.js-r169-a855f7) ![fastapi](https://img.shields.io/badge/FastAPI-0.115-7c5cff) ![python](https://img.shields.io/badge/Python-3.12-f472b6)

---

## ✨ What makes it special

| Feature | What it proves |
|---|---|
| **3D Mind Palace** — force-directed concept graph in Three.js | Real-time 3D data-viz (rare in portfolios) |
| **RAG with real citations** — answers quote your docs by page | The #1 in-demand AI skill |
| **Streaming answers** — tokens type out live (SSE over fetch) | Real streaming UX, not a spinner |
| **Live pulse** — cited concepts light up in 3D the instant you ask (WebSocket) | Full-stack real-time wiring |
| **JWT auth + cross-device sync** — optional sign-in saves your progress server-side | Real product auth, graceful when signed out |
| **Background ingestion** — large files upload instantly, process async with live status | Non-blocking UX + SQLite WAL concurrency |
| **Study Studio** — auto flashcards & quizzes per concept cluster | Turns the graph into a real learning tool |
| **Learning Path** — guided, foundations-first roadmap with progress tracking | Product thinking, not just a demo |
| **Runs offline, zero keys** — deterministic embedding + extractive fallback | Robust engineering, graceful degradation |
| **Free local LLM** via Ollama (no API key, no cost) — Claude optional | Modern LLM integration without lock-in |

---

## 🏗️ Architecture

```
┌──────────────── FRONTEND (React + TS + Vite) ────────────────┐
│  Three.js / R3F  →  Mind Palace (force graph, pulse on cite)  │
│  Framer Motion   →  glassmorphism UI, page transitions        │
│  Zustand         →  shared pulse / active-concept state       │
│  React Query     →  data fetching & cache                     │
│  Recharts        →  dashboard analytics                       │
└───────────────────────────┬──────────────────────────────────┘
                REST + WebSocket (/ws)
┌───────────────────────────┴──────────────────────────────────┐
│  BACKEND (FastAPI + SQLAlchemy + SQLite)                      │
│  ingest    → parse PDF/text · chunk · embed                   │
│  embeddings→ numpy hashing-TF  (or sentence-transformers)     │
│  vectorstore→ SQLite + cosine search (or ChromaDB)            │
│  rag       → retrieve top-K → Ollama/Claude/extractive → cite │
│  graph     → concept + co-occurrence edge extraction          │
└───────────────────────────────────────────────────────────────┘
```

### The RAG flow
`question → embed → cosine search → top-K passages → local LLM (or extractive) → answer + citations → matching concepts pulse in 3D`

---

## 🚀 Quick start (Windows / PowerShell)

You need **Python 3.10+** and **Node 18+**. Two terminals.

### 1) Backend

```powershell
cd synapse\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# (optional) point at config — works with defaults even without this
copy .env.example .env

python seed.py                      # loads a sample knowledge base
uvicorn app.main:app --reload --port 8000
```

API now live at **http://127.0.0.1:8000** · interactive docs at **/docs**.

### 2) Frontend

```powershell
cd synapse\frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

> Tip: go to **AI Tutor**, ask *"How does backpropagation relate to gradient descent?"*, and watch the nodes pulse in the palace beside the chat. ✨

---

## 🔌 Turning on a real LLM (free & local — recommended)

Without any LLM, Synapse answers by **extracting and citing** the most relevant sentences from your documents — the RAG retrieval and citations are 100% real, only the prose is mechanical.

For **fully-written answers and richer flashcards at zero cost**, run a local model with [**Ollama**](https://ollama.com) — no API key, no bill:

```powershell
# 1. install Ollama from https://ollama.com, then pull a lightweight model
ollama pull llama3.2:1b        # ~1.3 GB, fast on CPU

# 2. that's it — Ollama serves on http://localhost:11434 automatically.
#    Synapse auto-detects it. Restart the backend and the sidebar flips to "Ollama".
```

Provider selection lives in `backend/.env` (`LLM_PROVIDER=auto`, `OLLAMA_MODEL=llama3.2:1b`). `auto` prefers a running Ollama, then Claude if a key is set, then the offline extractive answerer.

> Prefer a bigger model? `ollama pull llama3.2:3b` (or `qwen2.5:3b`, `phi3:mini`) and set `OLLAMA_MODEL` to match.

### Optional: paid Claude instead
Set `ANTHROPIC_API_KEY=sk-ant-...` in `backend/.env` (and `LLM_PROVIDER=auto` or `claude`).

### Optional upgrades (auto-detected if installed)
```powershell
pip install sentence-transformers   # real semantic embeddings
pip install chromadb                 # dedicated vector DB
```

---

## 👤 Accounts & cross-device sync (optional)

The app works fully **signed out** — learning-path progress is stored in your browser. Click **Sign in** (top-right) to create an account; your progress is then saved server-side and **follows you to any device**, with local progress merged up on first sign-in.

Auth is JWT-based (passwords hashed with PBKDF2). For production, set a strong secret:

```
JWT_SECRET=<a long random string>
```

---

## 📡 API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | status + active backends |
| GET | `/api/documents` | list documents |
| POST | `/api/documents/upload` | upload a PDF / text file |
| POST | `/api/documents/paste` | ingest pasted text |
| DELETE | `/api/documents/{id}` | remove a document |
| GET | `/api/graph?limit=` | concept graph `{nodes, links}` |
| POST | `/api/chat/query` | RAG answer + citations + pulse ids |
| POST | `/api/chat/stream` | streamed answer (SSE: meta → tokens → done) |
| GET | `/api/study/clusters` | concept clusters (topics) |
| GET | `/api/study/clusters/{id}` | flashcards + quiz for a cluster |
| GET | `/api/path` | ordered learning-path modules |
| POST | `/api/auth/register` · `/login` | get a JWT |
| GET | `/api/auth/me` | current user (auth) |
| GET·PUT | `/api/progress` | per-user learning-path progress (auth) |
| WS | `/ws` | `concepts.pulse` events |

---

## 🗂️ Project structure

```
synapse/
├─ backend/
│  ├─ app/
│  │  ├─ core/         config + database + security (JWT, hashing)
│  │  ├─ models/       Document, Chunk, Concept, Edge, Chat, User, ProgressItem
│  │  ├─ services/     ingest · embeddings · vectorstore · rag · llm · graph · study · path
│  │  ├─ api/          documents · graph · chat · study · path · auth · progress · health
│  │  ├─ realtime.py   WebSocket hub
│  │  └─ main.py
│  └─ seed.py
└─ frontend/
   └─ src/
      ├─ components/    layout (shell/sidebar/topbar) + ui primitives
      ├─ features/      graph (MindPalace) · chat · upload · study · auth
      ├─ hooks/         useGraph · useDocuments · useChat · useRealtime · useStudy · useProgress
      ├─ lib/           api client (+ SSE stream) · query client
      ├─ store/         Zustand (pulse store + auth store)
      └─ pages/         Dashboard · Palace · Path · Study · Library · Chat
```

---

## 🧭 Roadmap (next steps)

- [x] Flashcards & auto-quizzes generated per concept cluster
- [x] "Learning path" — foundations-first study roadmap with progress tracking
- [x] Free local LLM via Ollama (no API key)
- [x] Streaming token-by-token answers (SSE)
- [x] JWT auth + saved progress synced across devices
- [ ] Optional Java/Spring ingestion microservice for heavy PDFs
- [ ] Auth + multi-user saved sessions (JWT)
- [ ] Streaming token-by-token answers

---

Built as a portfolio project. The design language (glass + aurora + dark-default) and feature-based structure mirror a real production SaaS.
