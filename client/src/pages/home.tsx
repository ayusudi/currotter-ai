import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Wand2, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UploadZone } from "@/components/upload-zone";
import { ModeSelector } from "@/components/mode-selector";
import { PipelineProgress } from "@/components/pipeline-progress";
import { ResultsGallery } from "@/components/results-gallery";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocket } from "@/hooks/use-websocket";
import type { ImageAnalysis, ProgressUpdate } from "@shared/schema";

type AppState = "upload" | "processing" | "results";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"social" | "minimal">("social");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [curatedImages, setCuratedImages] = useState<ImageAnalysis[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const { toast } = useToast();
  const fetchedRef = useRef(false);

  const { progress: wsProgress } = useWebSocket(sessionId);

  const currentProgress = wsProgress || progress;

  useEffect(() => {
    if (wsProgress && wsProgress.stage === "completed" && appState === "processing" && sessionId && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchResults(sessionId);
    }
  }, [wsProgress, appState, sessionId]);

  async function fetchResults(sid: string) {
    try {
      const res = await fetch(`/api/sessions/${sid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.curatedImages && data.curatedImages.length > 0) {
          setCuratedImages(data.curatedImages);
          setProgress(wsProgress);
          setAppState("results");
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
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

    setIsUploading(true);
    setAppState("processing");
    setProgress({ sessionId: "", stage: "uploading", progress: 0, message: "Uploading photos..." });

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

      pollForResults(data.sessionId);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setAppState("upload");
      setProgress(null);
    } finally {
      setIsUploading(false);
    }
  };

  const pollForResults = async (sid: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));

      try {
        const res = await fetch(`/api/sessions/${sid}`);
        if (!res.ok) continue;
        const data = await res.json();

        setProgress({
          sessionId: sid,
          stage: data.status,
          progress: data.status === "completed" ? 100 : Math.min(95, (data.processedImages / Math.max(1, data.totalImages)) * 100),
          message: getStatusMessage(data.status, data.processedImages, data.totalImages),
          stats: data.stats,
        });

        if (data.status === "completed") {
          setCuratedImages(data.curatedImages || []);
          setAppState("results");
          return;
        }

        if (data.status === "error") {
          toast({ title: "Processing Error", description: data.error || "Something went wrong", variant: "destructive" });
          setAppState("upload");
          setProgress(null);
          return;
        }
      } catch (e) {
        // continue polling
      }
    }

    toast({ title: "Timeout", description: "Processing took too long. Please try again.", variant: "destructive" });
    setAppState("upload");
    setProgress(null);
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

  const handleReset = () => {
    setAppState("upload");
    setSelectedFiles([]);
    setSessionId(null);
    setCuratedImages([]);
    setProgress(null);
    fetchedRef.current = false;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <img src="/images/otter-mascot.png" alt="Currotter" className="w-9 h-9" />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">Currotter</h1>
              <p className="text-[11px] text-muted-foreground">AI Photo Curator</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {appState === "results" && (
              <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-new-session">
                <RotateCcw className="w-4 h-4 mr-1" />
                New
              </Button>
            )}
            <ThemeToggle />
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
            <div className="text-center space-y-3 max-w-2xl mx-auto">
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
                Keep the best, ditch the rest
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Upload your event photos and let our AI agents find duplicates, remove blurry shots, 
                and pick the best photos from each scene. Get a perfectly curated album in seconds.
              </p>
            </div>

            <Card className="p-6 space-y-6 max-w-2xl mx-auto border-card-border">
              <div>
                <h3 className="text-sm font-medium mb-3">1. Upload your photos</h3>
                <UploadZone
                  onFilesSelected={handleFilesSelected}
                  isUploading={isUploading}
                  selectedFiles={selectedFiles}
                  onRemoveFile={handleRemoveFile}
                  onClearAll={handleClearAll}
                />
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">2. Choose curation mode</h3>
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
                { title: "Detect Duplicates", desc: "Perceptual hashing finds near-identical shots" },
                { title: "AI Scoring", desc: "Gradient AI rates aesthetics & scene quality" },
                { title: "Smart Clusters", desc: "Cosine similarity groups similar photos" },
              ].map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="p-4 rounded-md bg-card border border-card-border text-center"
                >
                  <p className="font-medium text-sm">{feature.title}</p>
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
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Processing your photos</h2>
              <p className="text-muted-foreground text-sm">
                Our AI agents are analyzing your collection...
              </p>
            </div>
            <Card className="p-6 border-card-border">
              <PipelineProgress progress={currentProgress} />
            </Card>
          </motion.div>
        )}

        {appState === "results" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
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
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-3 rounded-md bg-card border border-card-border text-center">
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
