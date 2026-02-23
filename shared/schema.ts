import { z } from "zod";

export const uploadSessionSchema = z.object({
  id: z.string(),
  status: z.enum(["uploading", "processing", "filtering", "analyzing", "deciding", "completed", "error"]),
  mode: z.enum(["social", "minimal"]),
  totalImages: z.number(),
  processedImages: z.number(),
  originalImages: z.array(z.any()),
  curatedImages: z.array(z.any()),
  stats: z.object({
    duplicatesRemoved: z.number(),
    blurryRemoved: z.number(),
    lowBrightnessRemoved: z.number(),
    totalRemoved: z.number(),
    clustersFound: z.number(),
  }).optional(),
  createdAt: z.string(),
  error: z.string().optional(),
});

export type UploadSession = z.infer<typeof uploadSessionSchema>;

export const imageAnalysisSchema = z.object({
  id: z.string(),
  filename: z.string(),
  spacesUrl: z.string(),
  thumbnailUrl: z.string().optional(),
  perceptualHash: z.string().optional(),
  blurScore: z.number().optional(),
  brightnessScore: z.number().optional(),
  aestheticScore: z.number().optional(),
  sceneDescription: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  clusterId: z.number().optional(),
  finalScore: z.number().optional(),
  isDuplicate: z.boolean().default(false),
  isBlurry: z.boolean().default(false),
  isTooLow: z.boolean().default(false),
  isSelected: z.boolean().default(false),
});

export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

export const curateRequestSchema = z.object({
  mode: z.enum(["social", "minimal"]),
});

export type CurateRequest = z.infer<typeof curateRequestSchema>;

export const progressUpdateSchema = z.object({
  sessionId: z.string(),
  stage: z.enum(["uploading", "filtering", "analyzing", "deciding", "completed", "error"]),
  progress: z.number(),
  message: z.string(),
  stats: z.object({
    duplicatesRemoved: z.number(),
    blurryRemoved: z.number(),
    lowBrightnessRemoved: z.number(),
    totalRemoved: z.number(),
    clustersFound: z.number(),
  }).optional(),
});

export type ProgressUpdate = z.infer<typeof progressUpdateSchema>;

export * from "./models/auth";
