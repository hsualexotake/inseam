# 🧵 Inseam AI

> Inseam is a fullstack AI-powered system designed to **automate outdated workflows for production coordinators in the fashion industry**.  
> Built with **Convex**, **Next.js**, **React**, **Expo**, and **Clerk**, Inseam combines real-time collaboration, user-friendly design, and agentic automation to help teams work faster and smarter.

---

## 🚀 Highlights

### 🧠 AI Agent System
Inseam includes an **agentic automation system** that assists production coordinators by:
- 📅 Managing production timelines & deadlines  
- 📦 Tracking samples and factory communication  
- 📈 Generating updates and summaries automatically  
- 🧾 Extracting key data from emails and documents  

These agents integrate seamlessly into Inseam's dashboard, allowing coordinators to focus on decisions, not manual work.

---

### ⚙️ Tech Stack

| Layer | Technology | Purpose |
|-------|-------------|----------|
| **Frontend (Web)** | Next.js 15, React 19, Tailwind CSS v4 | Modern UI with App Router |
| **Backend** | Convex | Realtime DB, server functions, scheduling |
| **Auth** | Clerk | Authentication (Email, Google, Apple) |
| **AI** | OpenAI API | Powering agentic workflows |
| **Infra** | Turborepo | Monorepo management |

---

## 🧱 Project Structure

This is a **Turborepo** monorepo organized as follows:

```
inseam/
├── apps/
│   ├── web/         # Next.js 15 web dashboard
│   └── native/      # Expo React Native app (in development)
├── packages/
│   └── backend/     # Convex backend (DB + functions)
└── package.json
```

Each app shares the same **Convex backend**, **types**, and **auth layer**, ensuring end-to-end consistency.

---

## ⚙️ Setup Instructions

### 1. Prerequisites
Make sure you have the following installed:
- **Node.js** v18+
- **Corepack** (comes with Node 16+)
- **Yarn** (managed via Corepack)
- **Convex CLI** (`npm install -g convex`)
- **Expo CLI** (`npm install -g expo`)

Enable Corepack:
```bash
corepack enable
corepack prepare yarn@1.22.19 --activate
```

### 2. Install Dependencies
From the root directory:
```bash
yarn
```

### 3. Configure Convex
Set up Convex (backend + DB):
```bash
yarn workspace @packages/backend setup
```

Follow the prompts to create a Convex project.  
Then, in your Convex dashboard, set the following environment variables:

| Variable | Description |
|----------|-------------|
| `CLERK_ISSUER_URL` | Found in Clerk JWT Templates |
| `OPENAI_API_KEY` | From OpenAI Dashboard |

### 4. Configure Clerk
Create a Clerk project and enable **Email**, **Google**, and **Apple** sign-ins.  
Then, in both the web and native apps, add your Clerk environment variables:

```ini
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### 5. Configure Web & Native Apps
In each app directory (`apps/web` and `apps/native`), create a `.env.local` file using `.example.env` as a template:

```ini
NEXT_PUBLIC_CONVEX_URL=your_convex_url
EXPO_PUBLIC_CONVEX_URL=your_convex_url
CLERK_PUBLISHABLE_KEY=your_clerk_key
```

### 6. Run the Apps
To run all apps (web, native, backend):
```bash
yarn dev
```

Use arrow keys (⬆⬇) to switch logs between services.  
If you want to see all logs together, remove `"ui": "tui"` from `turbo.json`.

Run individual apps:
```bash
# Web
yarn workspace @apps/web dev

# Mobile
yarn workspace @apps/native start

# Backend
yarn workspace @packages/backend dev
```

### 7. Deploy
To deploy Convex and build your frontend (Vercel ready):
```bash
cd apps/web
cd ../../packages/backend && yarn convex deploy --cmd 'cd ../../apps/web && turbo run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
```

There's a `vercel.json` file in `apps/web` with the correct configuration.

---

## 🧠 Product Vision

Inseam was built from dozens of conversations with fashion production coordinators to solve real problems:

❌ **Manual tracking via spreadsheets**  
❌ **Endless email threads for approvals**  
❌ **Outdated sample tracking tools**  

✅ **One system for production visibility**  
✅ **AI agents that surface insights & automate tasks**  
✅ **Collaborative dashboard for teams**  

---

## 🧩 What's Inside

✅ AI agent system automating key workflows  
✅ Web dashboard (Next.js 15 + Tailwind)  
✅ Realtime backend (Convex)  
✅ Authentication (Clerk)  
✅ Type safety end-to-end  
✅ OpenAI integration for automation and summarization  

