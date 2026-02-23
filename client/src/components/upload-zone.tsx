import { useCallback, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
}

export function UploadZone({ onFilesSelected, isUploading, selectedFiles, onRemoveFile, onClearAll }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

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
      f.type.startsWith("image/")
    );
    if (files.length > 0) onFilesSelected(files);
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) onFilesSelected(files);
    e.target.value = "";
  }, [onFilesSelected]);

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
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/[0.02]"
        } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => document.getElementById("file-input")?.click()}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
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
              {isDragOver ? "Drop them here!" : "Drop your photos here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse. Supports JPG, PNG, WEBP
            </p>
          </div>
          <Button variant="secondary" size="sm" disabled={isUploading}>
            <Upload className="w-4 h-4 mr-2" />
            Choose Files
          </Button>
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} photo{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
              <Button variant="ghost" size="sm" onClick={onClearAll} data-testid="button-clear-all">
                Clear all
              </Button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, idx) => (
                <motion.div
                  key={`${file.name}-${idx}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFile(idx); }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-file-${idx}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
