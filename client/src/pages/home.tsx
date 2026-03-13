import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Wand2, ArrowRight, RotateCcw, LogOut, User, Search, Sparkles, Trophy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UploadZone } from "@/components/upload-zone";
import { ModeSelector } from "@/components/mode-selector";
import { PipelineProgress } from "@/components/pipeline-progress";
import { ResultsGallery } from "@/components/results-gallery";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import type { ImageAnalysis, ProgressUpdate } from "@shared/schema";

type AppState = "upload" | "processing" | "results" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"social" | "minimal">("social");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [curatedImages, setCuratedImages] = useState<ImageAnalysis[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportingDrive, setIsExportingDrive] = useState(false);
  const [driveExportUrl, setDriveExportUrl] = useState<string | null>(null);
  const [pollingProgress, setPollingProgress] = useState<ProgressUpdate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const fetchedRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { progress: wsProgress, isConnected: wsConnected } = useWebSocket(sessionId);

  const currentProgress = wsProgress || pollingProgress;

  useEffect(() => {
    if (!wsProgress) return;
    if (wsProgress.stage === "completed" && appState === "processing" && sessionId && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchResults(sessionId);
    }
    if (wsProgress.stage === "error" && appState === "processing") {
      setErrorMessage(wsProgress.message || "Processing failed");
      setAppState("error");
    }
  }, [wsProgress, appState, sessionId]);

  async function fetchResults(sid: string) {
    try {
      const res = await fetch(`/api/sessions/${sid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.curatedImages && data.curatedImages.length > 0) {
          setCuratedImages(data.curatedImages);
          setPollingProgress(prev => prev ? { ...prev, stats: data.stats } : null);
          setAppState("results");
        }
      }
    } catch {
      // ignore — polling fallback will handle it
    }
  }

  function startPollingFallback(sid: string) {
    let attempts = 0;
    const maxAttempts = 120;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setErrorMessage("Processing took too long. Please try again.");
        setAppState("error");
        return;
      }
      attempts++;

      try {
        const res = await fetch(`/api/sessions/${sid}`);
        if (!res.ok) {
          pollingRef.current = setTimeout(poll, 2000);
          return;
        }
        const data = await res.json();

        setPollingProgress({
          sessionId: sid,
          stage: data.status,
          progress: data.status === "completed" ? 100 : Math.min(90, (data.processedImages / Math.max(1, data.totalImages)) * 100),
          message: getStatusMessage(data.status, data.processedImages, data.totalImages),
          stats: data.stats,
        });

        if (data.status === "completed") {
          setCuratedImages(data.curatedImages || []);
          setAppState("results");
          return;
        }

        if (data.status === "error") {
          setErrorMessage(data.error || "Something went wrong during processing");
          setAppState("error");
          return;
        }
      } catch {
        // network error — keep trying
      }

      pollingRef.current = setTimeout(poll, 2000);
    };

    pollingRef.current = setTimeout(poll, 2000);
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, []);

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(prev => {
      const combined = [...prev, ...files];
      return combined.slice(0, 50);
    });
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  const handleCurate = async () => {
    if (selectedFiles.length < 2) {
      toast({ title: "Need more photos", description: "Please add at least 2 photos to curate.", variant: "destructive" });
      return;
    }

    if (pollingRef.current) clearTimeout(pollingRef.current);
    fetchedRef.current = false;

    setIsUploading(true);
    setAppState("processing");
    setPollingProgress({ sessionId: "", stage: "uploading", progress: 0, message: "Uploading photos..." });
    setErrorMessage(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append("images", file));
      formData.append("mode", mode);

      const res = await fetch("/api/curate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errData.message || "Upload failed");
      }

      const data = await res.json();
      setSessionId(data.sessionId);
      setPollingProgress({
        sessionId: data.sessionId,
        stage: "filtering",
        progress: 10,
        message: "Photos uploaded. Processing started...",
      });

      if (!wsConnected) {
        startPollingFallback(data.sessionId);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Upload failed");
      setAppState("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!sessionId) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `currotter-curated-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Download Error", description: err.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportDrive = async () => {
    if (!sessionId) return;
    setIsExportingDrive(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/export-drive`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Export failed");
      }
      const data = await res.json();
      setDriveExportUrl(data.folderUrl);
      toast({ title: "Exported to Google Drive", description: `${data.fileCount} photos saved to your Drive` });
    } catch (err: any) {
      toast({ title: "Drive Export Error", description: err.message, variant: "destructive" });
    } finally {
      setIsExportingDrive(false);
    }
  };

  const handleReset = () => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    setAppState("upload");
    setSelectedFiles([]);
    setSessionId(null);
    setCuratedImages([]);
    setPollingProgress(null);
    setDriveExportUrl(null);
    setErrorMessage(null);
    fetchedRef.current = false;
  };

  return (
    <div className="min-h-screen bg-background bg-dots">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img src="/images/otter-welcome.png" alt="Currotter" className="w-9 h-9 object-contain" />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">Currotter</h1>
              <p className="text-[11px] text-muted-foreground">AI Photo Curator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(appState === "results" || appState === "error") && (
              <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-new-session">
                <RotateCcw className="w-4 h-4 mr-1" />
                New
              </Button>
            )}
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground" data-testid="text-username">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[120px] truncate">{user.firstName || user.email}</span>
                </div>
                <a href="/api/logout">
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-logout">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {appState === "upload" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <motion.img
                src="/images/otter-welcome.png"
                alt="Otter waving"
                className="w-20 h-20 mx-auto"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.3 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
              >
                <Wand2 className="w-4 h-4" />
                AI-Powered Photo Curation
              </motion.div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Let's curate your photos!
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Upload your event photos and our friendly otter will find duplicates, remove blurry shots,
                and pick the best photos from each scene.
              </p>
            </div>

            <Card className="p-6 space-y-6 max-w-2xl mx-auto border-card-border">
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  Upload your photos
                </h3>
                <UploadZone
                  onFilesSelected={handleFilesSelected}
                  isUploading={isUploading}
                  selectedFiles={selectedFiles}
                  onRemoveFile={handleRemoveFile}
                  onClearAll={handleClearAll}
                />
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  Choose curation mode
                </h3>
                <ModeSelector mode={mode} onModeChange={setMode} disabled={isUploading} />
              </div>

              <Button
                onClick={handleCurate}
                disabled={selectedFiles.length < 2 || isUploading}
                className="w-full"
                size="lg"
                data-testid="button-curate"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Curate {selectedFiles.length} Photo{selectedFiles.length !== 1 ? "s" : ""}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {[
                { title: "Detect Duplicates", desc: "Perceptual hashing finds near-identical shots", featureIcon: Search },
                { title: "AI Scoring", desc: "AI rates aesthetics & scene quality", featureIcon: Sparkles },
                { title: "Smart Clusters", desc: "Cosine similarity groups similar photos", featureIcon: Trophy },
              ].map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="p-4 rounded-lg bg-card border border-card-border text-center hover:shadow-md transition-shadow duration-300"
                >
                  <feature.featureIcon className="w-5 h-5 text-primary mx-auto" />
                  <p className="font-medium text-sm mt-2">{feature.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {appState === "processing" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <div className="text-center space-y-4">
              <motion.img
                src="/images/otter-processing.png"
                alt="Otter processing"
                className="w-28 h-28 mx-auto animate-swim"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.4 }}
              />
              <h2 className="text-2xl font-bold tracking-tight">Our otter is working on it!</h2>
              <p className="text-muted-foreground text-sm">
                Analyzing your collection and picking the best shots...
              </p>
            </div>
            <Card className="p-6 border-card-border">
              <PipelineProgress progress={currentProgress} />
            </Card>
          </motion.div>
        )}

        {appState === "error" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto text-center space-y-6"
          >
            <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Something went wrong</h2>
              <p className="text-muted-foreground text-sm">
                {errorMessage || "An unexpected error occurred during processing."}
              </p>
            </div>
            <Button onClick={handleReset} data-testid="button-try-again">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </motion.div>
        )}

        {appState === "results" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <motion.img
                src="/images/otter-success.png"
                alt="Otter celebrating"
                className="w-20 h-20 mx-auto animate-bounce-gentle"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              />
              <h2 className="text-xl font-bold">Your curated album is ready!</h2>
            </div>
            {currentProgress?.stats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatBadge label="Uploaded" value={selectedFiles.length} />
                <StatBadge label="Duplicates" value={currentProgress.stats.duplicatesRemoved} color="text-orange-500 dark:text-orange-400" />
                <StatBadge label="Blurry" value={currentProgress.stats.blurryRemoved} color="text-red-500 dark:text-red-400" />
                <StatBadge label="Low Quality" value={currentProgress.stats.lowBrightnessRemoved} color="text-yellow-500 dark:text-yellow-400" />
                <StatBadge label="Curated" value={curatedImages.length} color="text-primary" />
              </div>
            )}
            <ResultsGallery
              images={curatedImages}
              onDownloadZip={handleDownloadZip}
              isDownloading={isDownloading}
              onExportDrive={handleExportDrive}
              isExportingDrive={isExportingDrive}
              driveExportUrl={driveExportUrl}
            />
          </motion.div>
        )}
      </main>

      <footer className="border-t bg-card/40 backdrop-blur-sm mt-12">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/images/otter-welcome.png" alt="Currotter" className="h-5 w-5 object-contain" />
            <span className="font-semibold text-sm">Currotter</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="footer-link-terms">Terms & Conditions</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="footer-link-privacy">Privacy Policy</Link>
          </div>
          <p className="text-sm text-muted-foreground">&copy; 2026 Currotter. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-3 rounded-lg bg-card border border-card-border text-center" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className={`text-xl font-bold tabular-nums ${color || ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function getStatusMessage(status: string, processed: number, total: number): string {
  switch (status) {
    case "uploading": return "Uploading photos...";
    case "filtering": return `Filtering images (${processed}/${total})...`;
    case "analyzing": return `AI analyzing images (${processed}/${total})...`;
    case "deciding": return "Making final selections...";
    case "completed": return "Curation complete!";
    case "error": return "An error occurred during processing.";
    default: return "Processing...";
  }
}
