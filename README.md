# Currotter - AI Photo Curator

Currotter is an AI-powered photo curation web application that automatically removes duplicates, blurry shots, and low-quality images from your event photo collections. Upload a batch of photos and get back only the best ones, ranked and selected by a multi-agent AI pipeline.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces) bucket for temporary image storage
- A [DigitalOcean Gradient AI](https://www.digitalocean.com/products/ai) API key for vision-based photo analysis

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd currotter
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Copy the `.env.template` file and fill in your credentials:

```bash
cp .env.template .env
```

Edit `.env` with your actual values (see [Environment Variables](#environment-variables) below).

4. Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### Environment Variables

| Variable | Description |
|---|---|
| `DO_SPACES_KEY` | DigitalOcean Spaces access key ID |
| `DO_SPACES_SECRET` | DigitalOcean Spaces secret access key |
| `DO_SPACES_ENDPOINT` | Spaces endpoint (e.g. `nyc3.digitaloceanspaces.com`) |
| `DO_SPACES_BUCKET` | Spaces bucket name |
| `GRADIENT_API_KEY` | DigitalOcean Gradient AI API key |
| `SESSION_SECRET` | Secret key for session management (any random string) |

### Build for Production

```bash
npm run build
npm start
```

---

## Features

### Upload & Curation

- **Drag-and-Drop Upload** — Drop up to 50 images at once or click to browse. Supports JPEG, PNG, WebP, and other common image formats. A thumbnail preview grid shows all selected files before processing.
- **Two Curation Modes**:
  - **Social Mode** — Keeps more photos with variety. Selects up to 2 images per visual cluster, ideal for social media sharing or event galleries.
  - **Minimal Mode** — Keeps only the absolute best shots. Selects 1 image per cluster, perfect for portfolios or printed albums.

### AI Pipeline (Three-Agent System)

1. **Filtering Agent** — Detects and removes duplicate photos using perceptual hashing with bit-level Hamming distance comparison. When duplicates are found, the sharpest version is kept automatically. Also flags blurry images (Laplacian variance analysis) and images with extreme brightness levels.

2. **Analysis Agent** — Sends each surviving image to DigitalOcean Gradient AI's vision model (GPT-4.1-mini) for professional-grade aesthetic scoring (0.0–1.0) and scene description. Each image also gets a visual embedding generated from color histograms, spatial layout features, and HSL tone averages.

3. **Decision Agent** — Groups visually similar images into clusters using cosine similarity on the visual embeddings. Within each cluster, images are ranked by a weighted score combining focus quality, aesthetic score, uniqueness, and brightness. Only the top-scoring images from each cluster are selected for the final curated set.

### Real-Time Progress Tracking

- Live progress updates via WebSocket as images move through each pipeline stage (uploading, filtering, analyzing, deciding).
- Visual progress bar with stage indicators and status messages.

### Results & Export

- **Curated Gallery** — View all selected photos in a responsive grid layout.
- **Lightbox View** — Click any image to view it full-size with navigation controls.
- **ZIP Download** — Download all curated photos as a single ZIP file with one click.

### Dark / Light Theme

- Toggle between dark and light themes with the header button. Your preference is saved automatically.

---

## Pages

### Home Page (`/`)

The single-page application contains three states:

1. **Upload State** — The landing view with a drag-and-drop upload zone, mode selector (Social / Minimal), and a curate button. Three feature cards at the bottom explain what the AI pipeline does: Detect Duplicates, AI Scoring, and Smart Clusters.

2. **Processing State** — Shown after clicking "Curate." Displays a multi-stage progress visualization showing the current pipeline stage and progress percentage in real time.

3. **Results State** — Shown after processing completes. Displays the curated photo gallery with the number of photos selected, a download button for ZIP export, and a button to start a new session.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Express.js, TypeScript |
| AI | DigitalOcean Gradient AI (GPT-4.1-mini vision model) |
| Storage | DigitalOcean Spaces (S3-compatible) |
| Real-Time | WebSocket (ws) |
| Image Processing | Sharp, image-hash |
| Export | JSZip |

---

## Project Structure

```
client/
  src/
    pages/
      home.tsx              # Main single-page app (upload, processing, results)
    components/
      upload-zone.tsx       # Drag-and-drop file upload with preview grid
      mode-selector.tsx     # Social vs Minimal mode picker
      pipeline-progress.tsx # Multi-stage processing visualization
      results-gallery.tsx   # Curated photo gallery with lightbox + ZIP download
      theme-provider.tsx    # Dark/light theme context provider
      theme-toggle.tsx      # Theme toggle button
    hooks/
      use-websocket.ts      # WebSocket hook for real-time progress updates
server/
  routes.ts                 # API endpoints (upload, session status, ZIP download)
  storage.ts                # In-memory session management
  spaces.ts                 # DigitalOcean Spaces integration
  agents/
    filtering.ts            # Perceptual hashing, blur detection, brightness scoring
    analysis.ts             # Gradient AI vision API, visual embedding generation
    decision.ts             # Cosine similarity clustering, weighted scoring
shared/
  schema.ts                 # Zod schemas and shared TypeScript types
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/curate` | Upload images and start the curation pipeline. Accepts multipart form data with `images` (files) and `mode` (`social` or `minimal`). Returns `{ sessionId, totalImages }`. |
| `GET` | `/api/sessions/:id` | Get the current status and results of a curation session. |
| `GET` | `/api/sessions/:id/download` | Download the curated images as a ZIP file. |
| `WS` | `/ws` | WebSocket endpoint for real-time progress updates. Send `{ type: "subscribe", sessionId: "..." }` to subscribe. |

---

## License

MIT
