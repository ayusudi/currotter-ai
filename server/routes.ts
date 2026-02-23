import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import { randomUUID } from "crypto";
import JSZip from "jszip";
import { storage } from "./storage";
import { uploadToSpaces, getFromSpaces } from "./spaces";
import { filterImages } from "./agents/filtering";
import { analyzeImages } from "./agents/analysis";
import { makeDecisions } from "./agents/decision";
import { log } from "./index";
import type { ImageAnalysis } from "@shared/schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error description
 *       example:
 *         message: "Session not found"
 *     ImageAnalysis:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         filename:
 *           type: string
 *         spacesUrl:
 *           type: string
 *           format: uri
 *         blurScore:
 *           type: number
 *           description: Focus quality score (higher is sharper)
 *         brightnessScore:
 *           type: number
 *           description: Brightness level (0.0–1.0)
 *         aestheticScore:
 *           type: number
 *           description: AI aesthetic quality rating (0.0–1.0)
 *         sceneDescription:
 *           type: string
 *           description: AI-generated scene description
 *         finalScore:
 *           type: number
 *           description: Weighted composite score used for ranking
 *         isDuplicate:
 *           type: boolean
 *         isBlurry:
 *           type: boolean
 *         isTooLow:
 *           type: boolean
 *         isSelected:
 *           type: boolean
 *           description: Whether this image was selected for the curated set
 *     SessionStats:
 *       type: object
 *       properties:
 *         duplicatesRemoved:
 *           type: integer
 *         blurryRemoved:
 *           type: integer
 *         lowBrightnessRemoved:
 *           type: integer
 *         totalRemoved:
 *           type: integer
 *         clustersFound:
 *           type: integer
 *     Session:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         mode:
 *           type: string
 *           enum: [social, minimal]
 *         status:
 *           type: string
 *           enum: [pending, processing, filtering, analyzing, deciding, completed, error]
 *           description: Current pipeline stage
 *         totalImages:
 *           type: integer
 *           description: Total images uploaded
 *         processedImages:
 *           type: integer
 *           description: Images processed so far in the current stage
 *         curatedImages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ImageAnalysis'
 *           description: Final curated image set (populated when status is "completed")
 *         stats:
 *           $ref: '#/components/schemas/SessionStats'
 *         error:
 *           type: string
 *           description: Error message (populated when status is "error")
 *       example:
 *         id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *         mode: "social"
 *         status: "completed"
 *         totalImages: 12
 *         processedImages: 12
 *         curatedImages: []
 *         stats:
 *           duplicatesRemoved: 3
 *           blurryRemoved: 1
 *           lowBrightnessRemoved: 0
 *           totalRemoved: 4
 *           clustersFound: 5
 */

const sessionSubscribers = new Map<string, Set<WebSocket>>();

function broadcastProgress(sessionId: string, payload: any) {
  const subs = sessionSubscribers.get(sessionId);
  if (!subs) return;
  const msg = JSON.stringify({ type: "progress", payload });
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribe" && msg.sessionId) {
          if (!sessionSubscribers.has(msg.sessionId)) {
            sessionSubscribers.set(msg.sessionId, new Set());
          }
          sessionSubscribers.get(msg.sessionId)!.add(ws);
        }
      } catch (e) {
        // ignore
      }
    });

    ws.on("close", () => {
      for (const [, subs] of sessionSubscribers) {
        subs.delete(ws);
      }
    });
  });

  /**
   * @swagger
   * /api/curate:
   *   post:
   *     summary: Upload images and start the AI curation pipeline
   *     description: >
   *       Accepts a batch of images (minimum 2, maximum 50) and begins the
   *       three-agent AI curation pipeline. The pipeline runs asynchronously
   *       after the response is returned. Use the session ID to poll for
   *       status via GET /api/sessions/{id} or subscribe to real-time
   *       updates via WebSocket at /ws.
   *     tags: [Curation]
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - images
   *             properties:
   *               images:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *                 description: Image files to curate (2–50 files, max 20MB each). Supported formats are JPEG, PNG, WebP, and other common image types.
   *               mode:
   *                 type: string
   *                 enum: [social, minimal]
   *                 default: social
   *                 description: >
   *                   Curation mode. "social" keeps more variety (up to 2 per
   *                   cluster), "minimal" keeps only the best (1 per cluster).
   *     responses:
   *       200:
   *         description: Curation session created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 sessionId:
   *                   type: string
   *                   format: uuid
   *                   description: Unique session identifier for tracking progress and retrieving results
   *                 totalImages:
   *                   type: integer
   *                   description: Number of images uploaded
   *             example:
   *               sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
   *               totalImages: 12
   *       400:
   *         description: Validation error (fewer than 2 images or invalid file type)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post("/api/curate", upload.array("images", 50), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length < 2) {
        return res.status(400).json({ message: "At least 2 images required" });
      }

      const mode = (req.body.mode === "minimal" ? "minimal" : "social") as "social" | "minimal";
      const session = storage.createSession(mode);
      session.totalImages = files.length;
      storage.updateSession(session.id, { totalImages: files.length });

      log(`New curation session ${session.id}: ${files.length} images, mode=${mode}`, "routes");

      res.json({ sessionId: session.id, totalImages: files.length });

      processCurationPipeline(session.id, files, mode).catch(err => {
        log(`Pipeline error: ${err.message}`, "routes");
        storage.updateSession(session.id, {
          status: "error",
          error: err.message,
        });
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  /**
   * @swagger
   * /api/sessions/{id}:
   *   get:
   *     summary: Get curation session status and results
   *     description: >
   *       Returns the current status of a curation session including progress
   *       information, pipeline stats, and curated image results when complete.
   *       Poll this endpoint to track processing progress if not using WebSocket.
   *     tags: [Sessions]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The curation session ID returned from POST /api/curate
   *     responses:
   *       200:
   *         description: Session details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Session'
   *       404:
   *         description: Session not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.get("/api/sessions/:id", (req: Request, res: Response) => {
    const session = storage.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    return res.json(session);
  });

  /**
   * @swagger
   * /api/sessions/{id}/download:
   *   get:
   *     summary: Download curated images as a ZIP file
   *     description: >
   *       Downloads all curated images from a completed curation session as
   *       a compressed ZIP archive. The session must have a "completed" status.
   *     tags: [Sessions]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: The curation session ID
   *     responses:
   *       200:
   *         description: ZIP archive containing curated images
   *         content:
   *           application/zip:
   *             schema:
   *               type: string
   *               format: binary
   *       400:
   *         description: Session not yet completed
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       404:
   *         description: Session not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.get("/api/sessions/:id/download", async (req: Request, res: Response) => {
    try {
      const session = storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      if (session.status !== "completed") {
        return res.status(400).json({ message: "Session not yet completed" });
      }

      const zip = new JSZip();
      const folder = zip.folder("currotter-curated");

      for (const img of session.curatedImages) {
        try {
          const spacesKey = session.spacesKeys.find(k => k.includes(img.id));
          if (spacesKey) {
            const buffer = await getFromSpaces(spacesKey);
            folder!.file(img.filename, buffer);
          }
        } catch (e: any) {
          log(`Error fetching ${img.filename} for zip: ${e.message}`, "routes");
        }
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="currotter-curated-${session.id.slice(0, 8)}.zip"`);
      return res.send(zipBuffer);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

async function processCurationPipeline(
  sessionId: string,
  files: Express.Multer.File[],
  mode: "social" | "minimal"
) {
  const spacesKeys: string[] = [];

  try {
    storage.updateSession(sessionId, { status: "processing" });
    broadcastProgress(sessionId, {
      sessionId,
      stage: "uploading",
      progress: 5,
      message: "Uploading images to cloud storage...",
    });

    const imageInputs: Array<{ id: string; filename: string; buffer: Buffer }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageId = randomUUID();
      const ext = file.originalname.split(".").pop() || "jpg";
      const key = `currotter/${sessionId}/${imageId}.${ext}`;

      await uploadToSpaces(key, file.buffer, file.mimetype);
      spacesKeys.push(key);

      imageInputs.push({
        id: imageId,
        filename: file.originalname,
        buffer: file.buffer,
      });

      broadcastProgress(sessionId, {
        sessionId,
        stage: "uploading",
        progress: 5 + (i / files.length) * 20,
        message: `Uploading ${i + 1}/${files.length}...`,
      });
    }

    storage.updateSession(sessionId, { spacesKeys });

    storage.updateSession(sessionId, { status: "filtering" });
    broadcastProgress(sessionId, {
      sessionId,
      stage: "filtering",
      progress: 25,
      message: "Detecting duplicates and quality issues...",
    });

    const filterResult = await filterImages(imageInputs, (processed) => {
      storage.updateSession(sessionId, { processedImages: processed });
      broadcastProgress(sessionId, {
        sessionId,
        stage: "filtering",
        progress: 25 + (processed / files.length) * 25,
        message: `Filtering ${processed}/${files.length}...`,
      });
    });

    const passedImages = filterResult.passed;

    if (passedImages.length === 0) {
      const allImages = imageInputs.map(img => {
        const key = spacesKeys.find(k => k.includes(img.id));
        const endpoint = process.env.DO_SPACES_ENDPOINT || "";
        const bucket = process.env.DO_SPACES_BUCKET || "";
        const url = key ? `https://${bucket}.${endpoint}/${key}` : "";
        return {
          id: img.id,
          filename: img.filename,
          spacesUrl: url,
          isSelected: true,
          isDuplicate: false,
          isBlurry: false,
          isTooLow: false,
          finalScore: 0.5,
        } as ImageAnalysis;
      });

      storage.updateSession(sessionId, {
        status: "completed",
        curatedImages: allImages,
        stats: {
          ...filterResult.stats,
          totalRemoved: 0,
          clustersFound: 1,
        },
      });

      broadcastProgress(sessionId, {
        sessionId,
        stage: "completed",
        progress: 100,
        message: "No images filtered - returning all images",
        stats: { ...filterResult.stats, totalRemoved: 0, clustersFound: 1 },
      });
      return;
    }

    storage.updateSession(sessionId, { status: "analyzing" });
    broadcastProgress(sessionId, {
      sessionId,
      stage: "analyzing",
      progress: 50,
      message: "AI analyzing image aesthetics...",
    });

    const analysisResults = await analyzeImages(
      passedImages.map(p => ({ id: p.id, filename: p.filename, buffer: p.buffer })),
      (processed) => {
        storage.updateSession(sessionId, { processedImages: processed });
        broadcastProgress(sessionId, {
          sessionId,
          stage: "analyzing",
          progress: 50 + (processed / passedImages.length) * 25,
          message: `Analyzing ${processed}/${passedImages.length}...`,
        });
      }
    );

    storage.updateSession(sessionId, { status: "deciding" });
    broadcastProgress(sessionId, {
      sessionId,
      stage: "deciding",
      progress: 80,
      message: "Making final selections...",
    });

    const decisions = makeDecisions(passedImages, analysisResults, mode);
    const selected = decisions.filter(d => d.isSelected);

    const clustersFound = new Set(decisions.map(d => d.clusterId)).size;

    const curatedImages: ImageAnalysis[] = selected.map(s => {
      const key = spacesKeys.find(k => k.includes(s.id));
      const endpoint = process.env.DO_SPACES_ENDPOINT || "";
      const bucket = process.env.DO_SPACES_BUCKET || "";
      const url = key ? `https://${bucket}.${endpoint}/${key}` : "";

      return {
        id: s.id,
        filename: s.filename,
        spacesUrl: url,
        perceptualHash: "",
        blurScore: s.blurScore,
        brightnessScore: s.brightnessScore,
        aestheticScore: s.aestheticScore,
        sceneDescription: s.sceneDescription,
        finalScore: s.finalScore,
        isDuplicate: false,
        isBlurry: false,
        isTooLow: false,
        isSelected: true,
      };
    });

    const totalRemoved = filterResult.stats.duplicatesRemoved + filterResult.stats.blurryRemoved + filterResult.stats.lowBrightnessRemoved;

    const stats = {
      ...filterResult.stats,
      totalRemoved,
      clustersFound,
    };

    storage.updateSession(sessionId, {
      status: "completed",
      curatedImages,
      stats,
    });

    broadcastProgress(sessionId, {
      sessionId,
      stage: "completed",
      progress: 100,
      message: "Curation complete!",
      stats,
    });

    log(`Pipeline complete: ${selected.length} curated from ${files.length} original`, "pipeline");
  } catch (err: any) {
    log(`Pipeline error: ${err.message}`, "pipeline");
    storage.updateSession(sessionId, {
      status: "error",
      error: err.message,
    });
    broadcastProgress(sessionId, {
      sessionId,
      stage: "error",
      progress: 0,
      message: `Error: ${err.message}`,
    });
  }
}
