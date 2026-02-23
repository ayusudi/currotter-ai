# Currotter - AI Photo Curator

Currotter is an AI-powered photo curation web application that automatically removes duplicates, blurry shots, and low-quality images from your event photo collections. Upload a batch of photos and get back only the best ones, ranked and selected by a multi-agent AI pipeline.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- A PostgreSQL database (auto-provisioned on Replit)
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

4. Push the database schema:

```bash
npm run db:push
```

5. Start the development server:

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
| `DATABASE_URL` | PostgreSQL connection string (auto-provisioned on Replit) |

### Build for Production

```bash
npm run build
npm start
```

---

## Features

### Authentication

- **Replit Auth (OpenID Connect)** — Secure login with Google or email via Replit's OIDC provider. Users see a landing page when not logged in, and all API endpoints are protected.
- **Session management** — PostgreSQL-backed session store with automatic token refresh.

### Upload & Curation

- **Drag-and-Drop Upload** — Drop up to 50 images at once or click to browse. Supports JPEG, PNG, WebP, and other common image formats. A thumbnail preview grid shows all selected files before processing.
- **Two Curation Modes**:
  - **Social Mode** — Keeps more photos with variety. Selects up to 2 images per visual cluster, ideal for social media sharing or event galleries.
  - **Minimal Mode** — Keeps only the absolute best shots. Selects 1 image per cluster, perfect for portfolios or printed albums.

### AI Pipeline (Three-Agent System)

1. **Filtering Agent** — Detects and removes duplicate photos using perceptual hashing with bit-level Hamming distance comparison. When duplicates are found, the sharpest version is kept automatically. Also flags blurry images (Laplacian variance analysis) and images with extreme brightness levels.

2. **Analysis Agent** — Sends each surviving image to DigitalOcean Gradient AI's vision model (GPT-4.1-mini) for professional-grade aesthetic scoring (0.0-1.0) and scene description. Each image also gets a visual embedding generated from color histograms, spatial layout features, and HSL tone averages.

3. **Decision Agent** — Groups visually similar images into clusters using cosine similarity on the visual embeddings. Within each cluster, images are ranked by a weighted score combining focus quality, aesthetic score, uniqueness, and brightness. Only the top-scoring images from each cluster are selected for the final curated set.

### Real-Time Progress Tracking

- Live progress updates via WebSocket as images move through each pipeline stage (uploading, filtering, analyzing, deciding).
- Visual progress bar with stage indicators and status messages.

### Results & Export

- **Curated Gallery** — View all selected photos in a responsive grid layout.
- **Lightbox View** — Click any image to view it full-size with navigation controls.
- **ZIP Download** — Download all curated photos as a single ZIP file with one click.
- **Google Drive Export** — Save curated photos directly to your Google Drive. Creates a dated folder and uploads all curated images. After export, a direct link opens the folder in Drive.

### Dark / Light Theme

- Toggle between dark and light themes with the header button. Your preference is saved automatically.

---

## Pages

### Landing Page (`/` - unauthenticated)

A marketing landing page shown to visitors who are not logged in. Features a hero section, three AI agent feature cards, a how-it-works section with three steps, a call-to-action with sign-up buttons, and footer with links to Terms & Conditions and Privacy Policy.

### Home Page (`/` - authenticated)

The main application view with three states:

1. **Upload State** — Drag-and-drop upload zone, mode selector (Social / Minimal), and a curate button. Three feature cards at the bottom explain what the AI pipeline does.

2. **Processing State** — Multi-stage progress visualization showing the current pipeline stage and progress percentage in real time.

3. **Results State** — Curated photo gallery with the number of photos selected, download buttons for ZIP export and Google Drive, and a button to start a new session.

### Terms & Conditions (`/terms`)

Standard terms of service for using Currotter.

### Privacy Policy (`/privacy`)

Privacy policy describing how user data and uploaded photos are handled.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Express.js, TypeScript |
| AI | DigitalOcean Gradient AI (GPT-4.1-mini vision model) |
| Storage | DigitalOcean Spaces (S3-compatible) |
| Database | PostgreSQL (Drizzle ORM) |
| Auth | Replit Auth (OpenID Connect) with Passport.js |
| Real-Time | WebSocket (ws) |
| Image Processing | Sharp, image-hash |
| Export | JSZip, Google Drive API (googleapis) |
| API Docs | Swagger (swagger-jsdoc + swagger-ui-express) |

---

## Project Structure

```
client/
  src/
    pages/
      home.tsx              # Main app (upload, processing, results)
      landing.tsx           # Landing page for unauthenticated users
      terms.tsx             # Terms and Conditions
      privacy.tsx           # Privacy Policy
    components/
      upload-zone.tsx       # Drag-and-drop file upload with preview grid
      mode-selector.tsx     # Social vs Minimal mode picker
      pipeline-progress.tsx # Multi-stage processing visualization
      results-gallery.tsx   # Curated photo gallery with lightbox + export
      theme-provider.tsx    # Dark/light theme context provider
      theme-toggle.tsx      # Theme toggle button
    hooks/
      use-websocket.ts      # WebSocket hook for real-time progress updates
      use-auth.ts           # Authentication hook
server/
  routes.ts                 # API endpoints (upload, sessions, download, Drive export)
  storage.ts                # In-memory session management
  spaces.ts                 # DigitalOcean Spaces integration
  gdrive.ts                 # Google Drive export integration
  db.ts                     # PostgreSQL database connection
  swagger.ts                # Swagger API documentation setup
  agents/
    filtering.ts            # Perceptual hashing, blur detection, brightness scoring
    analysis.ts             # Gradient AI vision API, visual embedding generation
    decision.ts             # Cosine similarity clustering, weighted scoring
  replit_integrations/
    auth/                   # Replit Auth (OIDC) module
shared/
  schema.ts                 # Zod schemas and shared TypeScript types
  models/
    auth.ts                 # User and session database schemas
```

---

## API Endpoints

All API endpoints (except auth routes) require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/login` | Initiates the OIDC login flow |
| `GET` | `/api/callback` | OIDC callback handler |
| `GET` | `/api/logout` | Logs out and ends the session |
| `GET` | `/api/auth/user` | Returns the current authenticated user |
| `POST` | `/api/curate` | Upload images and start the curation pipeline |
| `GET` | `/api/sessions/:id` | Get session status and results |
| `GET` | `/api/sessions/:id/download` | Download curated images as a ZIP file |
| `POST` | `/api/sessions/:id/export-drive` | Export curated images to Google Drive |
| `WS` | `/ws` | WebSocket for real-time progress updates |

Interactive API documentation is available at `/api-docs` (Swagger UI).

---

## License

MIT
