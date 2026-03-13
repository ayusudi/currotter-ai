import { useCallback, useState, useEffect, useRef } from "react";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

const MAX_FILES = 50;
const MAX_FILE_SIZE_MB = 20;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onFilesSelected, isUploading, selectedFiles, onRemoveFile, onClearAll }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  function getObjectUrl(file: File): string {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!objectUrlsRef.current.has(key)) {
      objectUrlsRef.current.set(key, URL.createObjectURL(file));
    }
    return objectUrlsRef.current.get(key)!;
  }

  useEffect(() => {
    return () => {
      for (const url of Array.from(objectUrlsRef.current.values())) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (selectedFiles.length === 0) {
      for (const url of Array.from(objectUrlsRef.current.values())) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    }
  }, [selectedFiles.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024
    );
    if (files.length > 0) onFilesSelected(files);
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f =>
      f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024
    );
    if (files.length > 0) onFilesSelected(files);
    e.target.value = "";
  }, [onFilesSelected]);

  const slotsLeft = MAX_FILES - selectedFiles.length;
  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const isAtLimit = selectedFiles.length >= MAX_FILES;

  return (
    <div className="space-y-4">
      <motion.div
        data-testid="upload-dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : isAtLimit
            ? "border-muted-foreground/10 bg-muted/30 opacity-60 cursor-not-allowed"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/[0.02]"
        } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => !isAtLimit && !isUploading && document.getElementById("file-input")?.click()}
        whileHover={isAtLimit || isUploading ? {} : { scale: 1.005 }}
        whileTap={isAtLimit || isUploading ? {} : { scale: 0.995 }}
      >
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
          data-testid="input-file-upload"
        />
        <div className="flex flex-col items-center gap-3">
          <motion.img
            src="/images/otter-upload.png"
            alt="Upload photos"
            className="w-20 h-20"
            animate={isDragOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
          />
          <div>
            <p className="text-lg font-medium">
              {isDragOver ? "Drop them here!" : isAtLimit ? "Maximum photos reached" : "Drop your photos here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse · JPG, PNG, WEBP · max {MAX_FILE_SIZE_MB}MB each
            </p>
          </div>
          {!isAtLimit && (
            <Button variant="secondary" size="sm" disabled={isUploading} tabIndex={-1}>
              <Upload className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span data-testid="text-file-count">
                    {selectedFiles.length} / {MAX_FILES} photos
                  </span>
                </span>
                <span className="text-muted-foreground/50">·</span>
                <span data-testid="text-total-size">{formatSize(totalSize)} total</span>
                {slotsLeft <= 10 && slotsLeft > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                    {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} left
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={onClearAll} data-testid="button-clear-all">
                Clear all
              </Button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-52 overflow-y-auto pr-1">
              {selectedFiles.map((file, idx) => (
                <motion.div
                  key={`${file.name}-${file.size}-${idx}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                  title={`${file.name} (${formatSize(file.size)})`}
                >
                  <img
                    src={getObjectUrl(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-file-${idx}`}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatSize(file.size)}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
