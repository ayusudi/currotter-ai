import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ChevronLeft, ChevronRight, Star, Maximize2, HardDriveUpload, ExternalLink, Check, Info } from "lucide-react";
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

export function ResultsGallery({ images, onDownloadZip, isDownloading, onExportDrive, isExportingDrive, driveExportUrl }: ResultsGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const openLightbox = (idx: number) => setLightboxIndex(idx);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => setLightboxIndex(prev => prev !== null ? (prev - 1 + images.length) % images.length : null);
  const nextImage = () => setLightboxIndex(prev => prev !== null ? (prev + 1) % images.length : null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-curated-count">
            {images.length} Curated Photo{images.length !== 1 ? "s" : ""}
          </h3>
          <p className="text-sm text-muted-foreground">
            The best shots from your collection, AI-selected
          </p>
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
              {isExportingDrive ? "Uploading..." : "Save to Google Drive"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <motion.div
            key={img.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
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
                    <Badge variant="secondary" className="text-[10px]">
                      <Star className="w-3 h-3 mr-0.5" />
                      {(img.finalScore * 100).toFixed(0)}
                    </Badge>
                  )}
                </div>
                <Maximize2 className="w-4 h-4 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white/10"
              onClick={closeLightbox}
              data-testid="button-close-lightbox"
            >
              <X className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              data-testid="button-prev-image"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              data-testid="button-next-image"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              src={images[lightboxIndex].spacesUrl}
              alt={images[lightboxIndex].filename}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-lg" onClick={(e) => e.stopPropagation()}>
              {images[lightboxIndex].selectionReason && (
                <div className="flex items-start gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2.5" data-testid="text-lightbox-reason">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-white/90 leading-snug">{images[lightboxIndex].selectionReason}</p>
                </div>
              )}
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <p className="text-sm text-white">{images[lightboxIndex].filename}</p>
                {images[lightboxIndex].finalScore !== undefined && (
                  <Badge variant="secondary" className="text-xs">
                    Score: {(images[lightboxIndex].finalScore! * 100).toFixed(0)}
                  </Badge>
                )}
                <span className="text-xs text-white/60">
                  {lightboxIndex + 1} / {images.length}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
