# Currotter - Local Development & DigitalOcean Deployment Guide

A comprehensive preparation document for migrating Currotter from Replit to a local development environment with DigitalOcean deployment.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [System Architecture Diagram](#3-system-architecture-diagram)
4. [Directory Structure](#4-directory-structure)
5. [Database Schema & ERD](#5-database-schema--erd)
6. [DDL (Data Definition Language)](#6-ddl-data-definition-language)
7. [AI Pipeline Architecture](#7-ai-pipeline-architecture)
8. [API Reference](#8-api-reference)
9. [Environment Variables](#9-environment-variables)
10. [Authentication - Migration from Replit Auth](#10-authentication---migration-from-replit-auth)
11. [Google Drive Integration - Migration](#11-google-drive-integration---migration)
12. [Local Development Setup](#12-local-development-setup)
13. [DigitalOcean Deployment](#13-digitalocean-deployment)
14. [Dependencies](#14-dependencies)
15. [Build & Production](#15-build--production)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Project Overview

**Currotter** is an AI-powered photo curation web application with an otter mascot theme. It takes batches of event photos and uses a three-agent AI pipeline to:

- Remove duplicate photos (perceptual hashing)
- Filter out blurry and poorly-lit shots
- Score remaining photos using AI vision (DigitalOcean Gradient AI / GPT-4.1-mini)
- Cluster visually similar photos and pick the best from each group
- Return a curated album with explanations for why each photo was selected

### Key Features

| Feature | Description |
|---------|-------------|
| Multi-Agent AI Pipeline | 3-stage processing: Filtering → Analysis → Decision |
| Two Curation Modes | **Social** (more variety) and **Minimal** (only the best) |
| Real-time Progress | WebSocket-based live progress updates |
| Google Drive Export | Save curated photos directly to Google Drive |
| ZIP Download | Download curated album as a compressed ZIP |
| Swagger API Docs | OpenAPI 3.0 documentation at `/api-docs` |
| Dark/Light Theme | Full theme support with otter-themed UI |
| Authentication | OpenID Connect (currently Replit Auth — needs migration) |

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

### Request Flow

```
Browser → Express Server (port 5000)
  ├── /api/* → API Routes (authenticated)
  ├── /ws → WebSocket (progress updates)
  ├── /api-docs → Swagger UI
  ├── /api/login → Auth flow
  └── /* → Vite dev server (dev) or Static files (prod)
```

### Data Flow

```
User uploads images
  → Multer (memory storage, max 20MB/file, max 50 files)
  → DigitalOcean Spaces (temporary storage)
  → Filtering Agent (perceptual hash, blur, brightness)
  → Analysis Agent (Gradient AI vision scoring)
  → Decision Agent (clustering + selection)
  → Curated results returned via API/WebSocket
  → User downloads ZIP or exports to Google Drive
```

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React + Vite)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ Landing   │  │ Home Page    │  │ Results       │  │ Terms/    │ │
│  │ Page      │  │ (Upload +   │  │ Gallery +     │  │ Privacy   │ │
│  │           │  │  Mode Select)│  │ Lightbox      │  │           │ │
│  └──────────┘  └──────────────┘  └───────────────┘  └───────────┘ │
│        │              │                  │                          │
│  ┌─────┴──────────────┴──────────────────┴────────────────────┐    │
│  │              Hooks: useAuth, useWebSocket                   │    │
│  │              TanStack Query for data fetching               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVER (Express + TypeScript)                    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Middleware Layer                             │ │
│  │  express.json ─→ express-session ─→ passport ─→ request logger│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Auth Routes  │  │ API Routes   │  │ WebSocket Server         │ │
│  │ /api/login   │  │ /api/curate  │  │ /ws                      │ │
│  │ /api/callback│  │ /api/sessions│  │ subscribe to session     │ │
│  │ /api/logout  │  │ /api/download│  │ broadcast progress       │ │
│  │ /api/auth/*  │  │ /api/export  │  │                          │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘ │
│         │                 │                                        │
│         ▼                 ▼                                        │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐    │
│  │ Auth Storage│  │         AI PIPELINE                       │    │
│  │ (Drizzle)   │  │                                          │    │
│  └──────┬──────┘  │  ┌────────────┐  ┌────────────────────┐ │    │
│         │         │  │ 1. Filter  │  │ 2. Analysis Agent  │ │    │
│         │         │  │   Agent    │→│   (Gradient AI)    │ │    │
│         │         │  │            │  │   GPT-4.1-mini     │ │    │
│         │         │  │ • pHash    │  │   vision API       │ │    │
│         │         │  │ • blur     │  │                    │ │    │
│         │         │  │ • bright   │  │ • aesthetic score  │ │    │
│         │         │  └────────────┘  │ • scene desc       │ │    │
│         │         │                  │ • embeddings       │ │    │
│         │         │                  └─────────┬──────────┘ │    │
│         │         │                            │            │    │
│         │         │                  ┌─────────▼──────────┐ │    │
│         │         │                  │ 3. Decision Agent  │ │    │
│         │         │                  │                    │ │    │
│         │         │                  │ • cosine sim       │ │    │
│         │         │                  │ • clustering       │ │    │
│         │         │                  │ • weighted scoring │ │    │
│         │         │                  │ • selection reason │ │    │
│         │         │                  └────────────────────┘ │    │
│         │         └──────────────────────────────────────────┘    │
│         │                                                         │
│         ▼                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ PostgreSQL  │  │ DO Spaces    │  │ Google Drive API         │ │
│  │ (users +    │  │ (S3 compat)  │  │ (googleapis)             │ │
│  │  sessions)  │  │ image store  │  │ export curated photos    │ │
│  └─────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

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
│   │   │   ├── upload-zone.tsx      # Drag-and-drop file upload
│   │   │   ├── mode-selector.tsx    # Social vs Minimal mode picker
│   │   │   ├── pipeline-progress.tsx# Multi-stage progress visualization
│   │   │   ├── results-gallery.tsx  # Curated photo gallery + lightbox
│   │   │   ├── theme-provider.tsx   # Dark/light mode provider
│   │   │   └── theme-toggle.tsx     # Theme switch button
│   │   ├── hooks/
│   │   │   ├── use-auth.ts          # Authentication state hook
│   │   │   ├── use-websocket.ts     # WebSocket progress hook
│   │   │   ├── use-toast.ts         # Toast notification hook
│   │   │   └── use-mobile.tsx       # Mobile detection hook
│   │   ├── lib/
│   │   │   ├── queryClient.ts       # TanStack Query setup
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
│   │   ├── filtering.ts             # Agent 1: Perceptual hash, blur, brightness
│   │   ├── analysis.ts              # Agent 2: Gradient AI vision scoring
│   │   └── decision.ts              # Agent 3: Clustering + selection
│   ├── replit_integrations/auth/    # Auth module (NEEDS MIGRATION)
│   │   ├── index.ts                 # Re-exports
│   │   ├── replitAuth.ts            # OIDC setup, login/callback/logout
│   │   ├── routes.ts                # /api/auth/user endpoint
│   │   └── storage.ts               # User upsert/get via Drizzle
│   ├── db.ts                        # PostgreSQL connection (Drizzle)
│   ├── gdrive.ts                    # Google Drive integration (NEEDS MIGRATION)
│   ├── index.ts                     # App entry point
│   ├── routes.ts                    # API routes + WebSocket + pipeline orchestration
│   ├── spaces.ts                    # DigitalOcean Spaces (S3) operations
│   ├── static.ts                    # Production static file serving
│   ├── storage.ts                   # In-memory session/curation state
│   ├── swagger.ts                   # Swagger/OpenAPI setup
│   └── vite.ts                      # Vite dev server integration
├── shared/                          # Shared types (frontend + backend)
│   ├── schema.ts                    # Zod schemas + type exports
│   └── models/
│       └── auth.ts                  # Drizzle table definitions (users, sessions)
├── script/
│   └── build.ts                     # Production build script (esbuild + Vite)
├── package.json
├── tsconfig.json
├── vite.config.ts                   # Vite configuration
├── drizzle.config.ts                # Drizzle ORM configuration
├── tailwind.config.ts               # Tailwind CSS configuration
└── components.json                  # shadcn/ui configuration
```

---

## 5. Database Schema & ERD

### Entity Relationship Diagram (ERD)

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


┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│   curation_sessions (IN-MEMORY ONLY)         │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  id              string (UUID)               │
│  status          enum (uploading, processing,│
│                  filtering, analyzing,       │
│                  deciding, completed, error)  │
│  mode            enum (social, minimal)      │
│  totalImages     number                      │
│  processedImages number                      │
│  originalImages  ImageAnalysis[]             │
│  curatedImages   ImageAnalysis[]             │
│  stats           SessionStats (optional)     │
│  createdAt       ISO string                  │
│  error           string (optional)           │
│  spacesKeys      string[]                    │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
  Note: Curation sessions are stored in-memory
  (Map) and are lost on server restart. Consider
  persisting to PostgreSQL for production.
```

### Relationships

- **users ↔ sessions**: No direct foreign key. The `sessions.sess` JSONB column contains the serialized Passport.js user object, which includes the user's `sub` (ID) claim. Express-session manages this relationship through `connect-pg-simple`.
- **Curation sessions**: Currently stored in-memory only. No database persistence. Each curation session references DigitalOcean Spaces keys for image storage.

### Important Notes

- The `users` and `sessions` tables are the **only persisted tables**. They handle authentication state only.
- All curation processing data (uploaded images, scores, curated results) lives **in-memory** during processing and in **DigitalOcean Spaces** for image blobs.
- For a production deployment, you may want to add a `curation_sessions` table to persist curation history.

---

## 6. DDL (Data Definition Language)

### Complete DDL for PostgreSQL

```sql
-- ============================================
-- Currotter Database DDL
-- PostgreSQL 14+
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Table: users
-- Purpose: Store authenticated user profiles
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR     PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR     UNIQUE,
    first_name      VARCHAR,
    last_name       VARCHAR,
    profile_image_url VARCHAR,
    created_at      TIMESTAMP   DEFAULT now(),
    updated_at      TIMESTAMP   DEFAULT now()
);

-- Unique index on email (already implied by UNIQUE constraint)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users USING btree (email);

-- ============================================
-- Table: sessions
-- Purpose: Express session storage (connect-pg-simple)
-- Used by: express-session + Passport.js
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    sid     VARCHAR     PRIMARY KEY,
    sess    JSONB       NOT NULL,
    expire  TIMESTAMP   NOT NULL
);

-- Index for session expiry cleanup
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions USING btree (expire);
```

### Drizzle ORM Schema (source of truth)

The Drizzle ORM schema in `shared/models/auth.ts` is the source of truth:

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
# Push schema changes to database (uses drizzle-kit)
npm run db:push

# If there are conflicts, force push:
npm run db:push --force
```

### Optional: Persistent Curation Sessions Table

If you want to persist curation history in production, add this table:

```sql
-- ============================================
-- Table: curation_sessions (OPTIONAL - for persistence)
-- Purpose: Persist curation results beyond server restart
-- ============================================
CREATE TABLE IF NOT EXISTS curation_sessions (
    id              VARCHAR     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         VARCHAR     REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR     NOT NULL DEFAULT 'uploading',
    mode            VARCHAR     NOT NULL DEFAULT 'social',
    total_images    INTEGER     NOT NULL DEFAULT 0,
    processed_images INTEGER    NOT NULL DEFAULT 0,
    curated_images  JSONB       DEFAULT '[]'::jsonb,
    stats           JSONB,
    spaces_keys     TEXT[]      DEFAULT '{}',
    error           TEXT,
    created_at      TIMESTAMP   DEFAULT now(),
    completed_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_curation_user ON curation_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_curation_status ON curation_sessions (status);
```

---

## 7. AI Pipeline Architecture

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STAGE 1: FILTERING AGENT                        │
│                         server/agents/filtering.ts                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: Raw image buffers from upload                                   │
│                                                                         │
│  1. Convert to JPEG (sharp, quality 85)                                 │
│  2. Compute perceptual hash (image-hash, 16-bit)                        │
│     └── Hamming distance at BIT level (hex→binary conversion)           │
│     └── Threshold: 30 bits (DUPLICATE_THRESHOLD)                        │
│     └── Canonical representative tracking:                              │
│         If duplicate is sharper → replace canonical, mark old as dup    │
│  3. Compute blur score (Laplacian variance on 256×256 greyscale)        │
│     └── Threshold: 100 (BLUR_THRESHOLD) — below = too blurry           │
│  4. Compute brightness (weighted RGB average on 64×64)                  │
│     └── Range: 0.0–1.0                                                  │
│     └── Rejected if < 0.08 (too dark) or > 0.95 (overexposed)          │
│                                                                         │
│  Output: Passed images + stats (dups/blurry/low-quality counts)         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       STAGE 2: ANALYSIS AGENT                           │
│                       server/agents/analysis.ts                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: Filtered image buffers                                          │
│                                                                         │
│  1. Resize to 512×512 JPEG (quality 70) for API efficiency              │
│  2. Send to DigitalOcean Gradient AI (GPT-4.1-mini vision)              │
│     └── API: https://inference.do-ai.run/v1/chat/completions            │
│     └── System prompt: rate aesthetic quality 0.0–1.0                   │
│     └── Returns: { aesthetic_score, scene_description }                 │
│     └── Concurrency: 3 parallel requests (MAX_CONCURRENT)              │
│     └── Retry: 2 retries with backoff (1s, 2s)                         │
│  3. Generate visual embedding (76-dimensional vector):                  │
│     └── 8-bin color histograms (R, G, B) = 24 dims                     │
│     └── 4×4 spatial grid average colors = 48 dims                      │
│     └── HSL averages = 3 dims                                          │
│     └── Aesthetic score = 1 dim                                         │
│     └── L2-normalized                                                   │
│                                                                         │
│  Output: { id, aestheticScore, sceneDescription, embedding[] }          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       STAGE 3: DECISION AGENT                           │
│                       server/agents/decision.ts                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Input: Filter results + Analysis results + Mode                        │
│                                                                         │
│  1. Cluster images using cosine similarity on embeddings                │
│     └── Social mode threshold: 0.90 (more clusters = more variety)     │
│     └── Minimal mode threshold: 0.80 (fewer clusters = stricter)       │
│  2. Compute weighted final score per image:                             │
│     Social:  focus=0.20, aesthetic=0.35, uniqueness=0.30, bright=0.15  │
│     Minimal: focus=0.25, aesthetic=0.45, uniqueness=0.15, bright=0.15  │
│     └── Focus: normalized blur score (blur / 1000, capped at 1.0)      │
│     └── Brightness penalty: 0.5 if extreme, 0.75 if borderline         │
│     └── Uniqueness: 1/√(cluster_size)                                  │
│  3. Select best photos per cluster:                                     │
│     └── Social: up to 2 per cluster                                    │
│     └── Minimal: 1 per cluster                                         │
│  4. Generate human-readable selection reason                            │
│     └── Based on aesthetic score, sharpness, lighting, uniqueness      │
│                                                                         │
│  Output: ScoredImage[] with isSelected flag + selectionReason           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Scoring Formula

```
finalScore = (w_focus × normalizedBlur) + (w_aesthetic × aestheticScore) 
           + (w_uniqueness × uniqueness) + (w_brightness × brightnessPenalty)

Where:
  normalizedBlur = min(1, blurScore / 1000)
  uniqueness = 1 / √(clusterSize)
  brightnessPenalty = 0.5 if extreme | 0.75 if borderline | 1.0 if normal
```

---

## 8. API Reference

All endpoints require authentication except `/api/login`, `/api/callback`, `/api/logout`.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/curate` | Yes | Upload images + start pipeline |
| GET | `/api/sessions/:id` | Yes | Get session status/results |
| GET | `/api/sessions/:id/download` | Yes | Download curated ZIP |
| POST | `/api/sessions/:id/export-drive` | Yes | Export to Google Drive |
| GET | `/api/auth/user` | Yes | Get current user profile |
| GET | `/api/login` | No | Initiate OIDC login flow |
| GET | `/api/callback` | No | OIDC callback handler |
| GET | `/api/logout` | No | Logout + end session |
| GET | `/api-docs` | No | Swagger UI |
| GET | `/api-docs.json` | No | OpenAPI spec JSON |
| WS | `/ws` | No | WebSocket for progress |

### WebSocket Protocol

```javascript
// Client → Server: Subscribe to session updates
{ "type": "subscribe", "sessionId": "uuid-here" }

// Server → Client: Progress update
{
  "type": "progress",
  "payload": {
    "sessionId": "uuid",
    "stage": "filtering" | "analyzing" | "deciding" | "completed" | "error",
    "progress": 0-100,
    "message": "Human-readable status",
    "stats": {                    // Only on "completed"
      "duplicatesRemoved": 3,
      "blurryRemoved": 1,
      "lowBrightnessRemoved": 0,
      "totalRemoved": 4,
      "clustersFound": 5
    }
  }
}
```

---

## 9. Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `SESSION_SECRET` | Express session encryption key | Any random 32+ char string |
| `DO_SPACES_KEY` | DigitalOcean Spaces access key ID | `DO00...` |
| `DO_SPACES_SECRET` | DigitalOcean Spaces secret key | `wJ3...` |
| `DO_SPACES_ENDPOINT` | Spaces endpoint (without https://) | `nyc3.digitaloceanspaces.com` |
| `DO_SPACES_BUCKET` | Spaces bucket name | `currotter-images` |
| `GRADIENT_API_KEY` | DigitalOcean Gradient AI API key | `dop_v1_...` |
| `PORT` | Server port (default 5000) | `5000` |
| `NODE_ENV` | Environment mode | `development` or `production` |

### Variables to Add (for local/DO deployment)

| Variable | Description | Notes |
|----------|-------------|-------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Replace Replit Auth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Replace Replit Auth |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | `https://yourdomain.com/api/callback` |
| `APP_URL` | Your app's public URL | `https://currotter.yourdomain.com` |

### Example `.env` file

```bash
# Database
DATABASE_URL=postgresql://currotter:yourpassword@db-host:25060/currotter?sslmode=require

# Session
SESSION_SECRET=your-very-long-random-secret-string-here-min-32-chars

# DigitalOcean Spaces
DO_SPACES_KEY=DO00XXXXXXXXXXXXXXXX
DO_SPACES_SECRET=wJ3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
DO_SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
DO_SPACES_BUCKET=currotter-images

# DigitalOcean Gradient AI
GRADIENT_API_KEY=dop_v1_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Google OAuth (replace Replit Auth)
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_REDIRECT_URI=https://currotter.yourdomain.com/api/callback

# App
PORT=5000
NODE_ENV=production
APP_URL=https://currotter.yourdomain.com
```

---

## 10. Authentication - Migration from Replit Auth

### Current State (Replit Auth)

The app currently uses Replit's built-in OIDC provider. This **will not work outside Replit** because it depends on:

- `process.env.ISSUER_URL` (defaults to `https://replit.com/oidc`)
- `process.env.REPL_ID` (used as the OAuth client ID)
- Replit's OIDC discovery endpoint
- Replit-specific session management

### Migration Options

#### Option A: Google OAuth 2.0 (Recommended)

Replace `server/replit_integrations/auth/replitAuth.ts` with standard Google OAuth using `passport-google-oauth20`:

```bash
npm install passport-google-oauth20
npm install -D @types/passport-google-oauth20
```

Replace `replitAuth.ts` with:

```typescript
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
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
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
```

#### Option B: Email/Password Auth

Add `bcrypt` for password hashing and implement local authentication with `passport-local`. This requires adding a `password_hash` column to the `users` table.

---

## 11. Google Drive Integration - Migration

### Current State

The Google Drive integration currently uses **Replit's connector system** (`REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`) to obtain OAuth tokens. This will not work outside Replit.

### Migration: Direct Google OAuth for Drive

Replace `server/gdrive.ts` with standard Google Drive API authentication:

```typescript
import { google } from 'googleapis';

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // You'll need to store the user's Drive access token
  // during the OAuth flow and pass it here
  // Option 1: Store in session
  // Option 2: Store in database with user record
  
  return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function uploadToDrive(
  files: Array<{ filename: string; buffer: Buffer; mimeType: string }>,
  folderName: string,
  accessToken: string  // Pass from authenticated session
): Promise<{ folderId: string; folderUrl: string; fileCount: number }> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id, webViewLink',
  });

  const folderId = folder.data.id!;

  // Upload files
  for (const file of files) {
    const { Readable } = await import('stream');
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);

    await drive.files.create({
      requestBody: {
        name: file.filename,
        parents: [folderId],
      },
      media: {
        mimeType: file.mimeType,
        body: stream,
      },
      fields: 'id',
    });
  }

  return {
    folderId,
    folderUrl: folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`,
    fileCount: files.length,
  };
}
```

**Important**: To use Google Drive, you need to:
1. Enable the Google Drive API in Google Cloud Console
2. Add `https://www.googleapis.com/auth/drive.file` to your OAuth scopes
3. Store the user's access token (from the OAuth flow) in the session or database
4. Pass it when calling `uploadToDrive()`

---

## 12. Local Development Setup

### Prerequisites

- Node.js 20+ (LTS recommended)
- PostgreSQL 14+
- npm or yarn

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone <your-repo-url> currotter
cd currotter

# 2. Install dependencies
npm install

# 3. Create PostgreSQL database
createdb currotter
# Or via psql:
# psql -U postgres -c "CREATE DATABASE currotter;"

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your actual values (see Section 9)

# 5. Push database schema
npm run db:push

# 6. Create DigitalOcean Spaces bucket
# - Go to DO Control Panel → Spaces
# - Create a bucket (e.g., "currotter-images")
# - Create Spaces API keys
# - Update .env with keys

# 7. Set up Google OAuth
# - Go to Google Cloud Console → APIs & Services → Credentials
# - Create OAuth 2.0 Client ID (Web application)
# - Set authorized redirect URI: http://localhost:5000/api/callback
# - Update .env with client ID and secret

# 8. Get DigitalOcean Gradient AI key
# - Go to DO Control Panel → API → Tokens
# - Create a new token with Gradient AI access
# - Update .env

# 9. Migrate auth code (see Section 10)
# Replace server/replit_integrations/auth/replitAuth.ts

# 10. Migrate Google Drive code (see Section 11)
# Replace server/gdrive.ts

# 11. Remove Replit-specific Vite plugins
# Edit vite.config.ts - remove @replit/* plugins:
#   - @replit/vite-plugin-cartographer
#   - @replit/vite-plugin-runtime-error-modal
#   - @replit/vite-plugin-dev-banner

# 12. Start development server
npm run dev
# App runs at http://localhost:5000
```

### Vite Config Changes

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

### Build Script Changes

Remove Replit-specific packages from `script/build.ts` external list and remove the Replit vite plugins from devDependencies:

```bash
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-dev-banner
```

---

## 13. DigitalOcean Deployment

### Option A: App Platform (Recommended — simplest)

1. **Create App** in DO Control Panel → App Platform
2. **Source**: Connect your GitHub/GitLab repo
3. **Build settings**:
   - Build command: `npm run build`
   - Run command: `npm run start` (which runs `node dist/index.cjs`)
   - Output directory: `dist`
4. **Environment**: Set all env vars from Section 9
5. **Database**: Attach a Managed PostgreSQL cluster
6. **Add Spaces**: Already set up separately (just needs env vars)

#### App Spec (app.yaml)

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

### Option B: Droplet (full control)

```bash
# 1. Create Ubuntu 22.04 Droplet

# 2. Install Node.js
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

# 8. Set up Nginx reverse proxy
sudo apt-get install -y nginx
sudo tee /etc/nginx/sites-available/currotter << 'EOF'
server {
    listen 80;
    server_name currotter.yourdomain.com;

    # WebSocket support
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
        client_max_body_size 200M;  # For image uploads
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/currotter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 9. Set up SSL with Let's Encrypt
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d currotter.yourdomain.com
```

---

## 14. Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | 5.0.1 | Web framework |
| `express-session` | 1.19.0 | Session management |
| `connect-pg-simple` | 10.0.0 | PostgreSQL session store |
| `passport` | 0.7.0 | Authentication framework |
| `openid-client` | 6.8.2 | OIDC client (Replit Auth — replace) |
| `drizzle-orm` | 0.39.3 | Database ORM |
| `pg` | 8.16.3 | PostgreSQL driver |
| `@aws-sdk/client-s3` | 3.995.0 | DO Spaces (S3) client |
| `sharp` | 0.34.5 | Image processing |
| `image-hash` | 7.0.1 | Perceptual hashing |
| `multer` | 2.0.2 | File upload middleware |
| `jszip` | 3.10.1 | ZIP archive creation |
| `googleapis` | 148.0.0 | Google Drive API |
| `ws` | 8.18.0 | WebSocket server |
| `swagger-jsdoc` | 6.2.8 | Swagger spec generation |
| `swagger-ui-express` | 5.0.1 | Swagger UI |
| `zod` | 3.24.2 | Schema validation |
| `memoizee` | 0.4.17 | Memoization utility |
| `react` | 18.3.1 | UI library |
| `react-dom` | 18.3.1 | React DOM renderer |
| `wouter` | 3.3.5 | Client-side routing |
| `@tanstack/react-query` | 5.60.5 | Data fetching/caching |
| `framer-motion` | 11.13.1 | Animations |
| `lucide-react` | 0.453.0 | Icon library |
| `react-icons` | 5.4.0 | Additional icons |
| `tailwind-merge` | 2.6.0 | Tailwind class merging |
| `class-variance-authority` | 0.7.1 | Component variants |

### Dev Dependencies to Remove (Replit-specific)

```bash
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal @replit/vite-plugin-dev-banner
```

### Dependencies to Add (for local auth)

```bash
npm install passport-google-oauth20
npm install -D @types/passport-google-oauth20
```

---

## 15. Build & Production

### Build Process

```bash
# Build both client and server
npm run build

# This runs script/build.ts which:
# 1. Builds React app with Vite → dist/public/
# 2. Bundles Express server with esbuild → dist/index.cjs
```

### Production Start

```bash
# Start production server
npm run start
# Equivalent to: NODE_ENV=production node dist/index.cjs
```

### Production Behavior

- Express serves static files from `dist/public/`
- SPA fallback: all non-API routes serve `index.html`
- Server binds to `0.0.0.0:PORT` (default 5000)

---

## 16. Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `DATABASE_URL must be set` | Missing env var | Set `DATABASE_URL` in `.env` |
| `OIDC discovery failed` | Replit Auth not available | Migrate to Google OAuth (Section 10) |
| `Gradient API error 401` | Invalid or expired API key | Check `GRADIENT_API_KEY` |
| `Spaces upload failed` | Wrong credentials or bucket | Verify `DO_SPACES_*` env vars |
| `Google Drive not connected` | Replit connector unavailable | Migrate Drive integration (Section 11) |
| `sharp` build errors | Missing native deps | Run `npm rebuild sharp` |
| WebSocket not connecting | Nginx not configured | Add WebSocket proxy config |
| Session cookie not setting | `secure: true` without HTTPS | Use HTTPS in production, or set `secure: false` for local dev |

### Key Files to Modify for Migration

1. `server/replit_integrations/auth/replitAuth.ts` — Replace OIDC with Google OAuth
2. `server/gdrive.ts` — Replace Replit connector with direct Google API
3. `vite.config.ts` — Remove `@replit/*` plugins
4. `package.json` — Remove Replit dev dependencies, add `passport-google-oauth20`
5. `script/build.ts` — No changes needed (already generic)

---

*Document generated from Currotter codebase analysis. Last updated: February 2026.*
