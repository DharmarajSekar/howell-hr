# Howell HR — AI-Enabled Recruitment Platform (Demo)

A fully self-contained demo. **No API keys. No database setup. No cloud services.**

---

## One-Click Start

| Platform | Action |
|---|---|
| **Mac / Linux** | Double-click `start.command` — or run `./start.sh` in Terminal |
| **Windows** | Double-click `start.bat` |

The script will:
1. Check for Node.js (18+)
2. Install npm packages (first run only, ~1 min)
3. Build the Next.js app (first run only, ~1 min)
4. Start the server at **http://localhost:3000**
5. Open your browser automatically

---

## Login

| Field | Value |
|---|---|
| Email | `demo@howell.com` |
| Password | `demo123` |

---

## What to Demo

| Screen | Wow Moment |
|---|---|
| **Dashboard** | Live pipeline chart with AI match scores |
| **Jobs → New Job** | Click "Generate with AI" — full JD in ~1s |
| **Candidates** | Kanban board across all 7 pipeline stages |
| **Candidate Detail** | Run AI Match Score → strengths & gaps in real-time |
| **Apply Page** | `/apply/job-1` → click "Auto-fill from Resume (AI)" |
| **Interviews** | Scheduled & completed interviews with feedback & star ratings |
| **Notifications** | Send mock email / WhatsApp with live log |

---

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — Howell red brand (#b91c1c)
- **Recharts** — pipeline visualisation
- **JSON file database** — zero setup, all data in `/data/*.json`
- **Mocked AI** — keyword-matched JD templates, realistic scoring

---

## Prerequisites

- **Node.js 18+** — download from https://nodejs.org
