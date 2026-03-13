# Currotter — Local Development & DigitalOcean Deployment Guide

A comprehensive guide for migrating Currotter from Replit to a local development environment and deploying to DigitalOcean.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [AI Pipeline Architecture](#3-ai-pipeline-architecture)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema & ERD](#5-database-schema--erd)
6. [DDL (Data Definition Language)](#6-ddl-data-definition-language)
7. [API Reference](#7-api-reference)
8. [Environment Variables](#8-environment-variables)
9. [Authentication — Migration from Replit Auth](#9-authentication--migration-from-replit-auth)
10. [Google Drive Integration — Migration](#10-google-drive-integration--migration)
11. [Local Development Setup](#11-local-development-setup)
12. [DigitalOcean Deployment](#12-digitalocean-deployment)
13. [Dependencies](#13-dependencies)
14. [Build & Production](#14-build--production)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Project Overview

**Currotter** is an AI-powered photo curation web application with an otter mascot theme. It takes batches of event photos (up to 250) and uses a three-agent AI pipeline to:

- Remove duplicate photos using perceptual hashing
- Filter out blurry and poorly-lit shots
- Pre-rank photos by local quality (blur + brightness score)
- Apply a smart AI budget: only the top-ranked photos are sent to the vision API
- Score remaining photos synthetically using local metrics
- Cluster visually similar photos and select the best from each group
- Assign quality tiers (Hero / Great / Good) to every curated photo
- Return a curated album with explanations for why each photo was kept

### Key Features

| Feature | Description |
|---------|-------------|
| Multi-Agent AI Pipeline | 3-stage processing: Filtering → Analysis (with AI budget) → Decision |
| Up to 250 Photos | Per-session limit with estimated processing time shown on upload |
| Smart AI Budget | Social: top 100 → AI; Minimal: top 60 → AI; rest scored locally |
| Quality Tiers | Hero (top 15%), Great (top 35%), Good — shown as badges in gallery |
| Two Curation Modes | **Social** (more variety) and **Minimal** (only the best) |
| Real-time Progress | WebSocket primary; HTTP polling fallback |
| Google Drive Export | Save curated photos directly to Google Drive |
| ZIP Download | Download curated album as a compressed ZIP |
| Swagger API Docs | OpenAPI 3.0 documentation at `/api-docs` |
| Dark/Light Theme | Full theme support with otter-themed UI |
| Authentication | OpenID Connect (currently Replit Auth — needs migration for external deploy) |

---

## 2. Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite 7 |
| **UI Library** | Tailwind CSS 3 + shadcn/ui + Radix UI |
| **Animations** | Framer Motion |
| **State/Data** | TanStack React Query v5 |
| **Routing** | Wouter |
| **Backend** | Express 5 + TypeScript |
| **Database** | PostgreSQL (via Drizzle ORM) |
| **Object Storage** | DigitalOcean Spaces (S3-compatible) |
| **AI Service** | DigitalOcean Gradient AI (GPT-4.1-mini vision) |
| **Image Processing** | Sharp |
| **Auth** | Passport.js + OpenID Connect (currently Replit — needs replacement) |
| **Real-time** | Native WebSocket (ws library) |
| **API Docs** | Swagger/OpenAPI via swagger-jsdoc + swagger-ui-express |

### System Architecture Diagram

```mermaid
flowchart TD
    Browser["Browser\n(React + Vite)"]

    subgraph Client["Client Layer"]
        Landing["Landing Page\n(unauthenticated)"]
        Home["Home Page\nupload · progress · results"]
        Gallery["Results Gallery\ntier badges · lightbox · export"]
    end

    subgraph Server["Express Server  :5000"]
        Middleware["Middleware\nexpress-session · passport · request logger"]
        Auth["Auth Routes\n/api/login · /api/callback · /api/logout"]
        API["API Routes\n/api/curate · /api/sessions\n/api/download · /api/export-drive"]
        WS["WebSocket  /ws\nreal-time progress broadcast"]
        Swagger["Swagger UI  /api-docs"]
        Pipeline["Pipeline Orchestrator\nroutes.ts — AI budget logic"]

        subgraph Agents["Three-Agent Pipeline"]
            F["1 · Filtering Agent\nperceptual hash · blur · brightness\nlocalScore pre-rank"]
            Budget{{"AI Budget Router\nSocial cap 100\nMinimal cap 60"}}
            A["2 · Analysis Agent\nGradient AI GPT-4.1-mini\naesthetic score · scene desc\n76-dim embedding"]
            Synth["Synthetic Scorer\nlocalScore → aesthetic proxy\ncolor embedding\n(no API cost)"]
            D["3 · Decision Agent\ncosine clustering · weighted score\nqualityTier assignment"]
        end
    end

    subgraph DO["DigitalOcean"]
        Spaces["Spaces  S3-compatible\ntemporary image store"]
        GradientAI["Gradient AI\nGPT-4.1-mini vision API"]
        PG["Managed PostgreSQL\nusers + sessions tables"]
    end

    GDrive["Google Drive API"]

    Browser --> Client
    Client -->|"HTTPS"| Middleware
    Client -->|"WSS"| WS
    Middleware --> Auth & API & Swagger
    Auth --> PG
    API --> Pipeline
    Pipeline --> F --> Budget
    Budget -->|"top N by localScore"| A --> D
    Budget -->|"remaining"| Synth --> D
    A -->|"vision API call"| GradientAI
    Pipeline <-->|"upload · download"| Spaces
    API -->|"export"| GDrive
    WS -.->|"progress events"| Browser
```

### Request Flow Summary

```
Browser → Express Server (port 5000)
  ├── /api/*          → API Routes (require authentication)
  ├── /ws             → WebSocket (real-time progress updates)
  ├── /api-docs       → Swagger UI
  ├── /api/login      → OIDC auth flow
  └── /*              → Vite dev server (dev) or static files (prod)
```

---

## 3. AI Pipeline Architecture

### Pipeline Flow Diagram

```mermaid
flowchart LR
    Upload(["User uploads\n1–250 photos\n10 MB max each"])

    subgraph Stage1["Stage 1 · Filtering Agent  filtering.ts"]
        direction TB
        Hash["Perceptual Hash\nimage-hash 16-bit\nHamming distance at BIT level\nthreshold ≤ 30 bits = duplicate\ncanonical representative tracking"]
        Blur["Blur Detection\nLaplacian variance on 256×256 grey\nthreshold 100 — below = too blurry"]
        Bright["Brightness Check\nweighted RGB on 64×64\n< 0.08 too dark · > 0.95 overexposed"]
        LocalScore["Local Score\nblur × 0.60 + brightness × 0.40\nused to pre-rank for AI budget"]
    end

    subgraph Stage2["Stage 2 · Analysis Agent  analysis.ts"]
        direction TB
        BudgetSplit{{"AI Budget Split\n(per mode)"}}
        AIPath["AI Analysis\nresize to 512×512 JPEG q70\nGPT-4.1-mini vision API\nConcurrency: 3 parallel\nRetry: 2× with backoff\naesthetic score 0–1\nscene description\n76-dim embedding"]
        SynthPath["Synthetic Scoring\naesthetic = localScore×0.82+0.10\nreal 76-dim color embedding\nno API call · no cost"]
    end

    subgraph Stage3["Stage 3 · Decision Agent  decision.ts"]
        direction TB
        Embed["76-dim Visual Embedding\n24 color histogram bins R/G/B\n48 spatial grid 4×4\n3 HSL averages · 1 aesthetic dim\nL2-normalized"]
        Cluster["Cosine Similarity Clustering\nSocial threshold 0.90\nMinimal threshold 0.80"]
        WeightedScore["Weighted Scoring\nfocus quality\naesthetic score\nuniqueness\nbrightness"]
        Select["Best-per-Cluster Selection\nSocial: 2 per cluster\nMinimal: 1 per cluster"]
        Reason["Selection Reason\nhuman-readable explanation\nwhy each photo was kept"]
        Tiers["Quality Tier Assignment\nHero — top 15% by finalScore\nGreat — next 35%\nGood — remainder"]
    end

    Results(["Curated Album\nwith tiers · reasons\naiAnalyzed flag"])

    Upload --> Stage1
    Hash --> Blur --> Bright --> LocalScore
    LocalScore --> BudgetSplit
    BudgetSplit -->|"Social: top 100\nMinimal: top 60"| AIPath
    BudgetSplit -->|"remaining photos"| SynthPath
    AIPath --> Embed
    SynthPath --> Embed
    Embed --> Cluster --> WeightedScore --> Select --> Reason --> Tiers --> Results
```

### Stage 1 — Filtering Agent (`server/agents/filtering.ts`)

**Input:** Raw image buffers from multer upload (up to 250, 10 MB each)

| Step | Detail |
|------|--------|
| JPEG normalisation | Sharp converts to JPEG quality 85 |
| Perceptual hash | image-hash 16-bit; Hamming distance at **bit level** (hex→binary); duplicate threshold: 30 bits |
| Duplicate tracking | Canonical representative: if a duplicate is sharper than the current canonical, it replaces it |
| Blur score | Laplacian variance on 256×256 greyscale; below 100 = too blurry |
| Brightness | Weighted RGB average on 64×64; below 0.08 = too dark; above 0.95 = overexposed |
| Local score | `blur × 0.60 + brightness × 0.40` — used to rank photos before AI budget split |

**Output:** `FilterResult[]` — passed images with `localScore`, `buffer`, and quality flags

---

### Stage 2 — Analysis Agent (`server/agents/analysis.ts`)

**Input:** Passed images from Stage 1, sorted by `localScore` descending

**AI Budget split (in `server/routes.ts`):**
- Sort all passed images by `localScore` (highest first)
- `AI_ANALYSIS_CAP = { social: 100, minimal: 60 }`
- Top N → full AI analysis; remainder → synthetic scoring

| Path | Detail |
|------|--------|
| **AI path** | Resize to 512×512 JPEG q70; send to `https://inference.do-ai.run/v1/chat/completions` with model `openai-gpt-4.1-mini`; 3 concurrent requests; 2 retries with 1s/2s backoff |
| **Synthetic path** | `aestheticScore = min(0.92, localScore × 0.82 + 0.10)`; scene description = "Photo"; real 76-dim color embedding computed locally |
| **Embedding** | 24 color histogram bins (R/G/B 8 bins each) + 48 spatial grid (4×4 avg colors) + 3 HSL averages + 1 aesthetic score dim; L2-normalized |

**Output:** `AnalysisResult[]` merged from both paths; `aiAnalyzedIds` Set passed to decision agent

---

### Stage 3 — Decision Agent (`server/agents/decision.ts`)

**Input:** `FilterResult[]`, `AnalysisResult[]`, mode, `aiAnalyzedIds` Set

| Step | Detail |
|------|--------|
| Weighted score | `focus×w₁ + aesthetic×w₂ + uniqueness×w₃ + brightness×w₄` (weights differ by mode) |
| Cosine clustering | Pairwise cosine similarity on 76-dim embeddings; Social 0.90, Minimal 0.80 threshold |
| Selection | Social: 2 best per cluster; Minimal: 1 best per cluster |
| Selection reason | Generated from score components (sharpness, lighting, uniqueness, cluster comparison) |
| Quality tiers | Sort selected photos by `finalScore`; top 15% → `hero`, next 35% → `great`, rest → `good` |
| `aiAnalyzed` flag | `true` if photo ID is in `aiAnalyzedIds`, `false` for synthetic |

**Output:** `ScoredImage[]` with `qualityTier`, `aiAnalyzed`, `selectionReason`, `finalScore`, `clusterId`

---

## 4. Directory Structure

```
currotter/
├── client/                          # Frontend (React + Vite)
│   ├── public/
│   │   └── images/                  # Otter mascot images (static assets)
│   │       ├── otter-mascot.png     # Logo/nav icon
│   │       ├── otter-hero.png       # Landing page hero
│   │       ├── otter-welcome.png    # Upload state greeting
│   │       ├── otter-upload.png     # Upload zone illustration
│   │       ├── otter-processing.png # Processing animation
│   │       └── otter-success.png    # Results celebration
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components (auto-generated)
│   │   │   ├── upload-zone.tsx      # Drag-and-drop upload (250 files, time estimate)
│   │   │   ├── mode-selector.tsx    # Social vs Minimal mode picker
│   │   │   ├── pipeline-progress.tsx# Multi-stage progress visualization
│   │   │   ├── results-gallery.tsx  # Gallery: tier badges, lightbox, export
│   │   │   ├── theme-provider.tsx   # Dark/light mode provider
│   │   │   └── theme-toggle.tsx     # Theme switch button
│   │   ├── hooks/
│   │   │   ├── use-auth.ts          # Authentication state hook
│   │   │   ├── use-websocket.ts     # WebSocket progress hook
│   │   │   ├── use-toast.ts         # Toast notification hook
│   │   │   └── use-mobile.tsx       # Mobile detection hook
│   │   ├── lib/
│   │   │   ├── queryClient.ts       # TanStack Query setup + apiRequest
│   │   │   ├── auth-utils.ts        # Auth utility helpers
│   │   │   └── utils.ts             # General utilities (cn helper)
│   │   ├── pages/
│   │   │   ├── home.tsx             # Main app (authenticated)
│   │   │   ├── landing.tsx          # Landing page (unauthenticated)
│   │   │   ├── terms.tsx            # Terms & Conditions
│   │   │   ├── privacy.tsx          # Privacy Policy
│   │   │   └── not-found.tsx        # 404 page
│   │   ├── App.tsx                  # Root component + routing
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Global styles + theme variables
│   └── index.html
├── server/                          # Backend (Express)
│   ├── agents/
│   │   ├── filtering.ts             # Agent 1: pHash, blur, brightness, localScore
│   │   ├── analysis.ts              # Agent 2: Gradient AI vision + synthetic scoring
│   │   └── decision.ts              # Agent 3: clustering, scoring, quality tiers
│   ├── replit_integrations/auth/    # Auth module (NEEDS MIGRATION)
│   │   ├── index.ts                 # Re-exports
│   │   ├── replitAuth.ts            # OIDC setup, login/callback/logout
│   │   ├── routes.ts                # /api/auth/user endpoint
│   │   └── storage.ts               # User upsert/get via Drizzle
│   ├── db.ts                        # PostgreSQL connection (Drizzle)
│   ├── gdrive.ts                    # Google Drive integration (NEEDS MIGRATION)
│   ├── index.ts                     # App entry point
│   ├── routes.ts                    # API routes + WebSocket + AI budget orchestration
│   ├── spaces.ts                    # DigitalOcean Spaces (S3) operations
│   ├── static.ts                    # Production static file serving
│   ├── storage.ts                   # In-memory session/curation state
│   ├── swagger.ts                   # Swagger/OpenAPI setup
│   └── vite.ts                      # Vite dev server integration
├── shared/                          # Shared types (frontend + backend)
│   ├── schema.ts                    # Zod schemas (qualityTier + aiAnalyzed)
│   └── models/
│       └── auth.ts                  # Drizzle table definitions (users, sessions)
├── script/
│   └── build.ts                     # Production build (esbuild + Vite)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
└── components.json                  # shadcn/ui configuration
```

---

## 5. Database Schema & ERD

### Persisted Tables (PostgreSQL)

```
┌─────────────────────────────────────────────┐
│                   users                      │
├─────────────────────────────────────────────┤
│ PK  id              VARCHAR     NOT NULL     │ ← gen_random_uuid()
│     email           VARCHAR     UNIQUE       │
│     first_name      VARCHAR     NULLABLE     │
│     last_name       VARCHAR     NULLABLE     │
│     profile_image_url VARCHAR   NULLABLE     │
│     created_at      TIMESTAMP   DEFAULT now()│
│     updated_at      TIMESTAMP   DEFAULT now()│
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                  sessions                    │
├─────────────────────────────────────────────┤
│ PK  sid             VARCHAR     NOT NULL     │ ← express-session ID
│     sess            JSONB       NOT NULL     │ ← serialized session data
│     expire          TIMESTAMP   NOT NULL     │
├─────────────────────────────────────────────┤
│ IDX IDX_session_expire ON (expire)           │
└─────────────────────────────────────────────┘
```

### In-Memory Curation State

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  curation_sessions  (IN-MEMORY only, Map<string, Session>)  │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│  id              UUID string                                 │
│  status          uploading|processing|filtering|analyzing|   │
│                  deciding|completed|error                    │
│  mode            social | minimal                            │
│  totalImages     number (max 250)                            │
│  processedImages number                                      │
│  originalImages  ImageAnalysis[]                             │
│  curatedImages   ImageAnalysis[]  (qualityTier + aiAnalyzed) │
│  stats           SessionStats                                │
│  spacesKeys      string[]  (DO Spaces object keys)           │
│  createdAt       ISO timestamp string                        │
│  error           string (optional)                           │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
Note: lost on server restart — persist to PostgreSQL for production.
```

### Relationships

- **users ↔ sessions**: No foreign key. `sessions.sess` (JSONB) contains the serialised Passport user object with the user's `sub` claim.
- **Curation sessions**: In-memory only. Each session references DO Spaces keys for image blobs.

---

## 6. DDL (Data Definition Language)

### PostgreSQL DDL

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR     PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR     UNIQUE,
    first_name      VARCHAR,
    last_name       VARCHAR,
    profile_image_url VARCHAR,
    created_at      TIMESTAMP   DEFAULT now(),
    updated_at      TIMESTAMP   DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users USING btree (email);

-- Sessions table (connect-pg-simple)
CREATE TABLE IF NOT EXISTS sessions (
    sid     VARCHAR     PRIMARY KEY,
    sess    JSONB       NOT NULL,
    expire  TIMESTAMP   NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions USING btree (expire);
```

### Drizzle ORM Schema (`shared/models/auth.ts`)

```typescript
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Running Migrations

```bash
npm run db:push
# Force if there are conflicts:
npm run db:push --force
```

### Optional: Persistent Curation Sessions

```sql
-- For production — persist curation history
CREATE TABLE IF NOT EXISTS curation_sessions (
    id               VARCHAR     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          VARCHAR     REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR     NOT NULL DEFAULT 'uploading',
    mode             VARCHAR     NOT NULL DEFAULT 'social',
    total_images     INTEGER     NOT NULL DEFAULT 0,
    processed_images INTEGER     NOT NULL DEFAULT 0,
    curated_images   JSONB       DEFAULT '[]'::jsonb,
    stats            JSONB,
    spaces_keys      TEXT[]      DEFAULT '{}',
    error            TEXT,
    created_at       TIMESTAMP   DEFAULT now(),
    completed_at     TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_curation_user ON curation_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_curation_status ON curation_sessions (status);
```

---

## 7. API Reference

All endpoints require authentication except auth routes. Interactive docs at `/api-docs`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/login` | — | Initiates OIDC login flow |
| `GET` | `/api/callback` | — | OIDC callback handler |
| `GET` | `/api/logout` | — | Logs out, ends session |
| `GET` | `/api/auth/user` | Yes | Current authenticated user |
| `POST` | `/api/curate` | Yes | Upload images (≤250, 10 MB each) + start pipeline |
| `GET` | `/api/sessions/:id` | Yes | Session status, progress, and curated results |
| `GET` | `/api/sessions/:id/download` | Yes | Download curated images as ZIP |
| `POST` | `/api/sessions/:id/export-drive` | Yes | Export curated images to Google Drive |
| `WS` | `/ws` | Yes | WebSocket for real-time progress updates |

### `POST /api/curate` — Request

```
Content-Type: multipart/form-data
Fields:
  mode    string   "social" | "minimal"
  photos  File[]   up to 250 image files (JPEG, PNG, WebP; max 10 MB each)
```

### `GET /api/sessions/:id` — Response

```typescript
{
  id: string,
  status: "uploading"|"processing"|"filtering"|"analyzing"|"deciding"|"completed"|"error",
  mode: "social"|"minimal",
  totalImages: number,
  processedImages: number,
  curatedImages: ImageAnalysis[],  // only when completed
  stats: {
    totalInput: number,
    duplicatesRemoved: number,
    blurryRemoved: number,
    lowBrightnessRemoved: number,
    totalRemoved: number,
    clustersFound: number,
  },
}
```

### `ImageAnalysis` type

```typescript
{
  id: string,
  filename: string,
  spacesUrl: string,
  blurScore?: number,
  brightnessScore?: number,
  aestheticScore?: number,
  sceneDescription?: string,
  finalScore?: number,
  selectionReason?: string,
  qualityTier?: "hero" | "great" | "good",
  aiAnalyzed?: boolean,
  isDuplicate: boolean,
  isBlurry: boolean,
  isTooLow: boolean,
  isSelected: boolean,
}
```

---

## 8. Environment Variables

### Required for All Environments

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `SESSION_SECRET` | Express session encryption key | 32+ random chars |
| `DO_SPACES_KEY` | DigitalOcean Spaces access key ID | — |
| `DO_SPACES_SECRET` | DigitalOcean Spaces secret access key | — |
| `DO_SPACES_ENDPOINT` | Spaces region endpoint | `nyc3.digitaloceanspaces.com` |
| `DO_SPACES_BUCKET` | Spaces bucket name | `currotter-images` |
| `GRADIENT_API_KEY` | DigitalOcean Gradient AI API key | — |

### Required After Auth Migration (replacing Replit Auth)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (e.g. `https://yourdomain.com/api/callback`) |

### `.env` Template

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/currotter

# Session
SESSION_SECRET=change-me-to-a-long-random-string

# DigitalOcean Spaces
DO_SPACES_KEY=your_spaces_key
DO_SPACES_SECRET=your_spaces_secret
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=currotter-images

# DigitalOcean Gradient AI
GRADIENT_API_KEY=your_gradient_api_key

# Google OAuth (after Replit Auth migration)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/callback
```

---

## 9. Authentication — Migration from Replit Auth

### Current State

Authentication is handled by `server/replit_integrations/auth/replitAuth.ts` using Replit's OIDC provider. This will not work outside Replit.

### Files to Replace

| File | Action |
|------|--------|
| `server/replit_integrations/auth/replitAuth.ts` | Replace OIDC config with Google OAuth |
| `server/replit_integrations/auth/storage.ts` | No changes needed |
| `server/replit_integrations/auth/routes.ts` | No changes needed |

### Option A: Google OAuth via passport-google-oauth20

```bash
npm install passport-google-oauth20
npm install -D @types/passport-google-oauth20
```

Replace `replitAuth.ts`:

```typescript
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
import { authStorage } from "./storage";
import type { Express, RequestHandler } from "express";

const PgSession = connectPg(session);

export function setupAuth(app: Express) {
  app.use(
    session({
      store: new PgSession({ pool, tableName: "sessions" }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_REDIRECT_URI!,
        scope: ["openid", "email", "profile"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await authStorage.upsertUser({
            id: profile.id,
            email: profile.emails?.[0]?.value || null,
            firstName: profile.name?.givenName || null,
            lastName: profile.name?.familyName || null,
            profileImageUrl: profile.photos?.[0]?.value || null,
          });
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => cb(null, user.id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user || false);
    } catch (err) {
      cb(err);
    }
  });

  app.get("/api/login", passport.authenticate("google"));

  app.get(
    "/api/callback",
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/api/login",
    })
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/"));
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Unauthorized" });
};
```

### Option B: Email/Password Auth

Add `bcrypt` for password hashing and implement local auth with `passport-local`. Requires adding a `password_hash` column to the `users` table.

---

## 10. Google Drive Integration — Migration

### Current State

`server/gdrive.ts` uses the Replit connector system (`REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`) to obtain OAuth tokens. This will not work outside Replit.

### Migration: Direct Google OAuth for Drive

Replace `server/gdrive.ts`:

```typescript
import { google } from "googleapis";

export async function uploadToDrive(
  files: Array<{ filename: string; buffer: Buffer; mimeType: string }>,
  folderName: string,
  accessToken: string  // Pass from the authenticated user's session
): Promise<{ folderId: string; folderUrl: string; fileCount: number }> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, webViewLink",
  });

  const folderId = folder.data.id!;

  // Upload files
  for (const file of files) {
    const { Readable } = await import("stream");
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);

    await drive.files.create({
      requestBody: { name: file.filename, parents: [folderId] },
      media: { mimeType: file.mimeType, body: stream },
      fields: "id",
    });
  }

  return {
    folderId,
    folderUrl: folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
    fileCount: files.length,
  };
}
```

**Required steps:**

1. Enable the Google Drive API in Google Cloud Console
2. Add `https://www.googleapis.com/auth/drive.file` to your OAuth scopes (in the Google Strategy config)
3. Store the user's Drive access token (from the OAuth flow) in the session or database
4. Pass it when calling `uploadToDrive(files, folderName, req.session.driveAccessToken)`

---

## 11. Local Development Setup

### Prerequisites

- Node.js 20+ (LTS recommended)
- PostgreSQL 14+
- npm

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone <your-repo-url> currotter
cd currotter

# 2. Install dependencies
npm install

# 3. Create PostgreSQL database
createdb currotter
# Or: psql -U postgres -c "CREATE DATABASE currotter;"

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your actual values (see Section 8)

# 5. Push database schema
npm run db:push

# 6. Create DigitalOcean Spaces bucket
# GO: DO Control Panel → Spaces → Create bucket (e.g., "currotter-images")
# GO: Spaces → Manage Keys → Create new key
# Add keys to .env

# 7. Set up Google OAuth (after auth migration)
# GO: console.cloud.google.com → APIs & Services → Credentials
# Create OAuth 2.0 Client ID (Web application)
# Authorized redirect URI: http://localhost:5000/api/callback
# Add client ID + secret to .env

# 8. Get DigitalOcean Gradient AI key
# GO: DO Control Panel → API → Tokens → Generate new token
# Add to .env as GRADIENT_API_KEY

# 9. Migrate auth code
# Replace server/replit_integrations/auth/replitAuth.ts (see Section 9)

# 10. Migrate Google Drive code
# Replace server/gdrive.ts (see Section 10)

# 11. Remove Replit-specific Vite plugins
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-dev-banner

# 12. Start development server
npm run dev
# App runs at http://localhost:5000
```

### Vite Config After Migration

Remove Replit-specific plugins from `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
});
```

---

## 12. DigitalOcean Deployment

### Option A: App Platform (Recommended)

1. **Create App** in DO Control Panel → App Platform
2. **Source**: Connect your GitHub/GitLab repo
3. **Build settings**: Build command `npm run build`, Run command `npm run start`, Port `5000`
4. **Environment**: Set all env vars from Section 8
5. **Database**: Attach a Managed PostgreSQL cluster
6. **Spaces**: Already set up — just provide the env vars

#### App Spec (`app.yaml`)

```yaml
name: currotter
services:
  - name: web
    github:
      repo: your-username/currotter
      branch: main
    build_command: npm run build
    run_command: npm run start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-s
    http_port: 5000
    envs:
      - key: DATABASE_URL
        scope: RUN_AND_BUILD_TIME
        value: "${db.DATABASE_URL}"
      - key: SESSION_SECRET
        scope: RUN_TIME
        type: SECRET
        value: "your-session-secret"
      - key: DO_SPACES_KEY
        scope: RUN_TIME
        type: SECRET
        value: "your-spaces-key"
      - key: DO_SPACES_SECRET
        scope: RUN_TIME
        type: SECRET
        value: "your-spaces-secret"
      - key: DO_SPACES_ENDPOINT
        scope: RUN_TIME
        value: "nyc3.digitaloceanspaces.com"
      - key: DO_SPACES_BUCKET
        scope: RUN_TIME
        value: "currotter-images"
      - key: GRADIENT_API_KEY
        scope: RUN_TIME
        type: SECRET
        value: "your-gradient-key"
      - key: GOOGLE_CLIENT_ID
        scope: RUN_TIME
        value: "your-google-client-id"
      - key: GOOGLE_CLIENT_SECRET
        scope: RUN_TIME
        type: SECRET
        value: "your-google-client-secret"
      - key: GOOGLE_REDIRECT_URI
        scope: RUN_TIME
        value: "https://currotter.ondigitalocean.app/api/callback"
      - key: NODE_ENV
        scope: RUN_TIME
        value: "production"
      - key: PORT
        scope: RUN_TIME
        value: "5000"
databases:
  - name: db
    engine: PG
    version: "14"
```

### Option B: Droplet (Full Control)

```bash
# 1. Create Ubuntu 22.04 Droplet

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createdb currotter
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"

# 4. Clone and build
git clone <repo> /opt/currotter
cd /opt/currotter
npm install
npm run build

# 5. Set up environment
cp .env.example .env
# Edit .env with production values

# 6. Push database schema
npm run db:push

# 7. Set up systemd service
sudo tee /etc/systemd/system/currotter.service << 'EOF'
[Unit]
Description=Currotter AI Photo Curator
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/currotter
EnvironmentFile=/opt/currotter/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable currotter
sudo systemctl start currotter

# 8. Set up Nginx with WebSocket + large upload support
sudo apt-get install -y nginx
sudo tee /etc/nginx/sites-available/currotter << 'EOF'
server {
    listen 80;
    server_name currotter.yourdomain.com;

    # WebSocket proxy (required for real-time progress)
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 2600M;  # 250 files × 10 MB + buffer
        proxy_read_timeout 600s;      # 250-photo jobs can take ~5 min
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/currotter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 9. Set up SSL
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d currotter.yourdomain.com
```

---

## 13. Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | 5.0.1 | Web framework |
| `express-session` | 1.19.0 | Session management |
| `connect-pg-simple` | 10.0.0 | PostgreSQL session store |
| `passport` | 0.7.0 | Authentication framework |
| `openid-client` | 6.8.2 | OIDC client (Replit Auth — replace on migration) |
| `drizzle-orm` | 0.39.3 | Database ORM |
| `pg` | 8.16.3 | PostgreSQL driver |
| `@aws-sdk/client-s3` | 3.995.0 | DigitalOcean Spaces (S3) client |
| `sharp` | 0.34.5 | Image processing (resize, blur detection, brightness) |
| `image-hash` | 7.0.1 | Perceptual hashing for duplicate detection |
| `multer` | 2.0.2 | File upload middleware (250 files, 10 MB each) |
| `jszip` | 3.10.1 | ZIP archive creation |
| `googleapis` | 148.0.0 | Google Drive API |
| `ws` | 8.18.0 | WebSocket server |
| `swagger-jsdoc` | 6.2.8 | Swagger spec generation |
| `swagger-ui-express` | 5.0.1 | Swagger UI |
| `zod` | 3.24.2 | Schema validation |
| `react` | 18.3.1 | UI library |
| `react-dom` | 18.3.1 | React DOM renderer |
| `wouter` | 3.3.5 | Client-side routing |
| `@tanstack/react-query` | 5.60.5 | Data fetching + caching |
| `framer-motion` | 11.13.1 | Animations |
| `lucide-react` | 0.453.0 | Icon library |
| `react-icons` | 5.4.0 | Additional icons (Google Drive logo) |

### Dev Dependencies to Remove (Replit-specific)

```bash
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-dev-banner
```

### Dependencies to Add (after auth migration)

```bash
npm install passport-google-oauth20
npm install -D @types/passport-google-oauth20
```

---

## 14. Build & Production

### Build Process

```bash
npm run build

# This runs script/build.ts which:
# 1. Builds React app with Vite → dist/public/
# 2. Bundles Express server with esbuild → dist/index.cjs
```

### Production Start

```bash
npm run start
# Equivalent to: NODE_ENV=production node dist/index.cjs
```

### Production Behaviour

- Express serves static files from `dist/public/`
- SPA fallback: all non-API routes serve `index.html`
- Server binds to `0.0.0.0:PORT` (default 5000)

---

## 15. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `DATABASE_URL must be set` | Missing env var | Set `DATABASE_URL` in `.env` |
| `OIDC discovery failed` | Replit Auth not available | Migrate to Google OAuth (Section 9) |
| `Gradient API error 401` | Invalid or expired key | Check `GRADIENT_API_KEY` |
| `Spaces upload failed` | Wrong credentials or bucket | Verify all `DO_SPACES_*` env vars |
| `Google Drive not connected` | Replit connector unavailable | Migrate Drive integration (Section 10) |
| `sharp` build errors | Missing native dependencies | Run `npm rebuild sharp` |
| WebSocket not connecting | Nginx not proxying WS | Add WebSocket location block (Section 12) |
| Session cookie not setting | `secure: true` without HTTPS | Use HTTPS in production; set `secure: false` for local dev |
| Upload rejected (too many files) | Client sends >250 files | Enforce 250-file limit on client before submitting |
| Very slow processing (250 photos) | Expected — AI budget applies | Social ~4–5 min; Minimal ~3–4 min; advise batching by date |

### Key Files to Modify for Migration

| File | What to change |
|------|----------------|
| `server/replit_integrations/auth/replitAuth.ts` | Replace Replit OIDC with Google OAuth (Section 9) |
| `server/gdrive.ts` | Replace Replit connector with direct Google API (Section 10) |
| `vite.config.ts` | Remove `@replit/*` plugins |
| `package.json` | Remove Replit dev dependencies; add `passport-google-oauth20` |
| `script/build.ts` | No changes needed |

### AI Budget Tuning

If you want to change the number of photos sent to the AI API, edit `server/routes.ts`:

```typescript
const AI_ANALYSIS_CAP: Record<"social" | "minimal", number> = {
  social: 100,   // increase for more thorough AI coverage
  minimal: 60,   // decrease for lower API cost
};
```

---

*Last updated: March 2026. Reflects 250-photo support, smart AI budget system, and quality tier (Hero/Great/Good) features.*
