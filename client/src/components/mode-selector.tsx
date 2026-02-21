import { Sparkles, Minimize2 } from "lucide-react";
import { motion } from "framer-motion";

interface ModeSelectorProps {
  mode: "social" | "minimal";
  onModeChange: (mode: "social" | "minimal") => void;
  disabled?: boolean;
}

const modes = [
  {
    id: "social" as const,
    label: "Social",
    description: "More photos, variety-focused. Great for sharing on social media.",
    icon: Sparkles,
  },
  {
    id: "minimal" as const,
    label: "Minimal",
    description: "Fewer photos, only the absolute best. Perfect for albums.",
    icon: Minimize2,
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
            className={`relative p-4 rounded-md text-left transition-colors border ${
              isActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            whileHover={disabled ? {} : { scale: 1.01 }}
            whileTap={disabled ? {} : { scale: 0.99 }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                <m.icon className="w-4 h-4" />
              </div>
              <div>
                <p className={`font-medium text-sm ${isActive ? "text-foreground" : "text-foreground"}`}>
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
                className="absolute inset-0 border-2 border-primary rounded-md pointer-events-none"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
