import { randomUUID } from "crypto";
import type { ImageAnalysis } from "@shared/schema";

export interface SessionData {
  id: string;
  status: "uploading" | "processing" | "filtering" | "analyzing" | "deciding" | "completed" | "error";
  mode: "social" | "minimal";
  totalImages: number;
  processedImages: number;
  originalImages: ImageAnalysis[];
  curatedImages: ImageAnalysis[];
  stats?: {
    duplicatesRemoved: number;
    blurryRemoved: number;
    lowBrightnessRemoved: number;
    totalRemoved: number;
    clustersFound: number;
  };
  createdAt: string;
  error?: string;
  spacesKeys: string[];
}

export interface IStorage {
  createSession(mode: "social" | "minimal"): SessionData;
  getSession(id: string): SessionData | undefined;
  updateSession(id: string, updates: Partial<SessionData>): SessionData | undefined;
  deleteSession(id: string): void;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, SessionData>;

  constructor() {
    this.sessions = new Map();
  }

  createSession(mode: "social" | "minimal"): SessionData {
    const id = randomUUID();
    const session: SessionData = {
      id,
      status: "uploading",
      mode,
      totalImages: 0,
      processedImages: 0,
      originalImages: [],
      curatedImages: [],
      createdAt: new Date().toISOString(),
      spacesKeys: [],
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): SessionData | undefined {
    return this.sessions.get(id);
  }

  updateSession(id: string, updates: Partial<SessionData>): SessionData | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
  }
}

export const storage = new MemStorage();
