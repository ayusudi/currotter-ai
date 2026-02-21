# Currotter - AI Photo Curator

## Overview
Currotter is an AI-powered photo curation web app that removes duplicates, blurry, and low-quality images from event photo collections, then returns a curated album of the best shots. It uses a multi-agent AI pipeline to filter, analyze, and rank photos intelligently.

## Architecture

### Frontend (React + TypeScript + Vite)
- **Pages**: `client/src/pages/home.tsx` - Main upload/processing/results page
- **Components**:
  - `upload-zone.tsx` - Drag-and-drop file upload with preview grid
  - `mode-selector.tsx` - Social vs Minimal curation mode picker
  - `pipeline-progress.tsx` - Multi-stage processing visualization
  - `results-gallery.tsx` - Curated photo gallery with lightbox + ZIP download
  - `theme-provider.tsx` / `theme-toggle.tsx` - Dark/light mode

### Backend (Express + TypeScript)
- **API Routes**: `server/routes.ts` - Upload endpoint, session status, ZIP download
- **Agent Pipeline** (`server/agents/`):
  1. **Filtering Agent** (`filtering.ts`) - Perceptual hashing (duplicates), Laplacian blur detection, brightness scoring
  2. **Analysis Agent** (`analysis.ts`) - DigitalOcean Gradient AI vision API for aesthetic scoring and scene description
  3. **Decision Agent** (`decision.ts`) - Cosine similarity clustering, weighted scoring, best-per-cluster selection
- **Storage**: `server/storage.ts` - In-memory session management
- **Spaces**: `server/spaces.ts` - DigitalOcean Spaces (S3-compatible) for temporary image storage

### Shared Types
- `shared/schema.ts` - Zod schemas for ImageAnalysis, UploadSession, ProgressUpdate, CurateRequest

## Key Technical Details

### AI Pipeline Flow
1. User uploads images → stored in DO Spaces
2. Filtering Agent: perceptual hash → blur score → brightness score → remove bad images
3. Analysis Agent: send to Gradient AI (GPT-4.1-mini vision) → get aesthetic scores + descriptions
4. Decision Agent: generate embeddings → cosine similarity clustering → weighted scoring → select best per cluster
5. Return curated set → user can download as ZIP

### Curation Modes
- **Social**: More photos, variety-focused (2 per cluster, lower similarity threshold 0.85)
- **Minimal**: Fewer photos, only the best (1 per cluster, lower threshold 0.7)

### WebSocket
- `/ws` endpoint for real-time progress updates during processing

## Environment Variables (Secrets)
- `DO_SPACES_KEY` - DigitalOcean Spaces access key
- `DO_SPACES_SECRET` - DigitalOcean Spaces secret key
- `DO_SPACES_ENDPOINT` - Spaces endpoint
- `DO_SPACES_BUCKET` - Spaces bucket name
- `GRADIENT_API_KEY` - DigitalOcean Gradient AI API key

## Running
- `npm run dev` starts both Express backend and Vite frontend on port 5000

## Recent Changes
- 2026-02-21: Initial MVP implementation with full AI pipeline, upload UI, processing visualization, and results gallery
