import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ChevronLeft, ChevronRight, Star, Maximize2, ExternalLink, Info, ArrowDownToLine, Eye } from "lucide-react";
import { SiGoogledrive } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ImageAnalysis } from "@shared/schema";

interface ResultsGalleryProps {
  images: ImageAnalysis[];
  onDownloadZip: () => void;
  isDownloading: boolean;
  onExportDrive: () => void;
  isExportingDrive: boolean;
  driveExportUrl: string | null;
}

function scoreColor(score: number): string {
  if (score >= 0.75) return "text-green-600 dark:text-green-400";
  if (score >= 0.55) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

function downloadSingleImage(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ResultsGallery({ images, onDownloadZip, isDownloading, onExportDrive, isExportingDrive, driveExportUrl }: ResultsGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "filename">("score");

  const sortedImages = [...images].sort((a, b) => {
    if (sortBy === "score") {
      return (b.finalScore ?? 0) - (a.finalScore ?? 0);
    }
    return a.filename.localeCompare(b.filename);
  });

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevImage = useCallback(() => setLightboxIndex(prev => prev !== null ? (prev - 1 + sortedImages.length) % sortedImages.length : null), [sortedImages.length]);
  const nextImage = useCallback(() => setLightboxIndex(prev => prev !== null ? (prev + 1) % sortedImages.length : null), [sortedImages.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, closeLightbox, prevImage, nextImage]);

  if (images.length === 0) return null;

  const lightboxImg = lightboxIndex !== null ? sortedImages[lightboxIndex] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold" data-testid="text-curated-count">
              {images.length} Curated Photo{images.length !== 1 ? "s" : ""}
            </h3>
            <p className="text-sm text-muted-foreground">AI-selected best shots, ranked by quality</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/50">
            <button
              onClick={() => setSortBy("score")}
              data-testid="button-sort-score"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                sortBy === "score" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Star className="w-3 h-3" />
              By Score
            </button>
            <button
              onClick={() => setSortBy("filename")}
              data-testid="button-sort-name"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                sortBy === "filename" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              A–Z
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={onDownloadZip} disabled={isDownloading} data-testid="button-download-zip">
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? "Preparing..." : "Download ZIP"}
          </Button>
          {driveExportUrl ? (
            <a href={driveExportUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2" data-testid="button-open-drive">
                <SiGoogledrive className="w-4 h-4" />
                Open in Drive
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              onClick={onExportDrive}
              disabled={isExportingDrive}
              className="gap-2"
              data-testid="button-export-drive"
            >
              <SiGoogledrive className="w-4 h-4" />
              {isExportingDrive ? "Uploading..." : "Save to Drive"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sortedImages.map((img, idx) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(idx * 0.04, 0.4) }}
            className="group relative aspect-square rounded-md overflow-hidden bg-muted cursor-pointer"
            onClick={() => openLightbox(idx)}
            data-testid={`gallery-image-${idx}`}
          >
            <img
              src={img.spacesUrl}
              alt={img.filename}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {img.selectionReason && (
                <p className="text-[10px] text-white/90 leading-snug mb-1.5 line-clamp-2" data-testid={`text-reason-${idx}`}>
                  {img.selectionReason}
                </p>
              )}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  {img.finalScore !== undefined && (
                    <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
                      <Star className="w-3 h-3 mr-0.5" />
                      {(img.finalScore * 100).toFixed(0)}
                    </Badge>
                  )}
                </div>
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>
            {idx === 0 && sortBy === "score" && (
              <div className="absolute top-2 left-2">
                <Badge className="text-[10px] bg-primary text-primary-foreground border-0 gap-0.5">
                  <Star className="w-3 h-3" />
                  Best
                </Badge>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {lightboxImg && lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white/10"
              onClick={closeLightbox}
              data-testid="button-close-lightbox"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              data-testid="button-prev-image"
              aria-label="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              data-testid="button-next-image"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              src={lightboxImg.spacesUrl}
              alt={lightboxImg.filename}
              className="max-w-[88vw] max-h-[80vh] object-contain rounded-md"
              onClick={(e) => e.stopPropagation()}
            />

            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full max-w-xl px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {(lightboxImg.selectionReason || lightboxImg.sceneDescription) && (
                <div className="w-full flex flex-col gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3" data-testid="text-lightbox-reason">
                  {lightboxImg.sceneDescription && (
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                      <p className="text-xs text-white/70 italic">{lightboxImg.sceneDescription}</p>
                    </div>
                  )}
                  {lightboxImg.selectionReason && (
                    <div className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-white/90 leading-snug">{lightboxImg.selectionReason}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap justify-center bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <p className="text-sm text-white truncate max-w-[180px]">{lightboxImg.filename}</p>
                {lightboxImg.finalScore !== undefined && (
                  <Badge variant="secondary" className={`text-xs ${scoreColor(lightboxImg.finalScore)}`}>
                    <Star className="w-3 h-3 mr-1" />
                    {(lightboxImg.finalScore * 100).toFixed(0)} / 100
                  </Badge>
                )}
                {lightboxImg.aestheticScore !== undefined && (
                  <Badge variant="outline" className="text-xs text-white/70 border-white/20">
                    Aesthetic {(lightboxImg.aestheticScore * 100).toFixed(0)}%
                  </Badge>
                )}
                <span className="text-xs text-white/50">
                  {lightboxIndex + 1} / {sortedImages.length}
                </span>
                <button
                  onClick={() => downloadSingleImage(lightboxImg.spacesUrl, lightboxImg.filename)}
                  className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors ml-1 px-2 py-0.5 rounded-full hover:bg-white/10"
                  data-testid="button-download-single"
                  title="Download this photo"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>

            <p className="absolute top-5 left-1/2 -translate-x-1/2 text-xs text-white/30 pointer-events-none select-none">
              ← → to navigate · Esc to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
