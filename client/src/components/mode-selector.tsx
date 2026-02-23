import { Sparkles, Minimize2, Diamond } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface ModeSelectorProps {
  mode: "social" | "minimal";
  onModeChange: (mode: "social" | "minimal") => void;
  disabled?: boolean;
}

const modes: { id: "social" | "minimal"; label: string; description: string; icon: LucideIcon; modeIcon: LucideIcon }[] = [
  {
    id: "social",
    label: "Social",
    description: "More photos, variety-focused. Great for sharing on social media.",
    icon: Sparkles,
    modeIcon: Sparkles,
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Fewer photos, only the absolute best. Perfect for albums.",
    icon: Minimize2,
    modeIcon: Diamond,
  },
];

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {modes.map((m) => {
        const isActive = mode === m.id;
        return (
          <motion.button
            key={m.id}
            onClick={() => !disabled && onModeChange(m.id)}
            data-testid={`button-mode-${m.id}`}
            className={`relative p-4 rounded-xl text-left transition-all border ${
              isActive
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30 hover:bg-primary/[0.02]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            whileHover={disabled ? {} : { scale: 1.01 }}
            whileTap={disabled ? {} : { scale: 0.99 }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isActive ? "bg-primary/15 scale-110" : "bg-muted"
              }`}>
                <m.modeIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className={`font-medium text-sm ${isActive ? "text-primary" : "text-foreground"}`}>
                  {m.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {m.description}
                </p>
              </div>
            </div>
            {isActive && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute inset-0 border-2 border-primary rounded-xl pointer-events-none"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
