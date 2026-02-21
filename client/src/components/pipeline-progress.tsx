import { motion } from "framer-motion";
import { Filter, Brain, Scale, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ProgressUpdate } from "@shared/schema";

interface PipelineProgressProps {
  progress: ProgressUpdate | null;
}

const stages = [
  { id: "filtering", label: "Filtering", description: "Detecting duplicates, blur & brightness", icon: Filter },
  { id: "analyzing", label: "AI Analysis", description: "Aesthetic scoring via Gradient AI", icon: Brain },
  { id: "deciding", label: "Decision", description: "Clustering & selecting the best", icon: Scale },
  { id: "completed", label: "Complete", description: "Your curated album is ready", icon: CheckCircle2 },
];

function getStageIndex(stage: string): number {
  const idx = stages.findIndex(s => s.id === stage);
  return idx === -1 ? 0 : idx;
}

export function PipelineProgress({ progress }: PipelineProgressProps) {
  if (!progress) return null;

  const currentStageIndex = getStageIndex(progress.stage);
  const isError = progress.stage === "error";
  const overallProgress = progress.progress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium" data-testid="text-progress-message">
            {progress.message}
          </p>
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.round(overallProgress)}%
          </span>
        </div>
        <Progress value={overallProgress} className="h-2" data-testid="progress-bar" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stages.map((stage, idx) => {
          const isActive = currentStageIndex === idx && !isError;
          const isComplete = currentStageIndex > idx || progress.stage === "completed";
          const isPending = currentStageIndex < idx && !isError;
          const Icon = stage.icon;

          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex flex-col items-center text-center p-3 rounded-md transition-colors ${
                isActive
                  ? "bg-primary/10"
                  : isComplete
                  ? "bg-accent"
                  : "bg-transparent"
              }`}
              data-testid={`stage-${stage.id}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isActive ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <p className={`text-xs font-medium ${
                isActive ? "text-primary" : isPending ? "text-muted-foreground" : "text-foreground"
              }`}>
                {stage.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                {stage.description}
              </p>
            </motion.div>
          );
        })}
      </div>

      {isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{progress.message}</p>
        </motion.div>
      )}

      {progress.stats && progress.stage === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          data-testid="stats-summary"
        >
          <StatCard label="Duplicates removed" value={progress.stats.duplicatesRemoved} />
          <StatCard label="Blurry removed" value={progress.stats.blurryRemoved} />
          <StatCard label="Low quality removed" value={progress.stats.lowBrightnessRemoved} />
          <StatCard label="Clusters found" value={progress.stats.clustersFound} />
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded-md bg-card border border-card-border text-center">
      <p className="text-2xl font-bold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
