"use client";

import { Globe, MessageSquare, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export type GenerationStage = "thinking" | "searching" | "responding" | "idle";

interface GenerationStatusProps {
  stage: GenerationStage;
  className?: string;
}

export function GenerationStatus({ stage, className }: GenerationStatusProps) {
  const [dots, setDots] = useState("");

  // Animated dots for the status message
  useEffect(() => {
    if (stage === "idle") return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [stage]);

  if (stage === "idle") return null;

  return (
    <div className={cn("flex justify-start", className)}>
      <div className="flex max-w-[80%] items-center gap-2 rounded-lg border border-border/70 bg-card/88 px-4 py-3 shadow-sm shadow-foreground/5">
        {stage === "thinking" && (
          <>
            <Brain size={16} className="animate-pulse text-primary" />
            <span className="text-sm text-muted-foreground">
              Ik denk{dots}
            </span>
          </>
        )}

        {stage === "searching" && (
          <>
            <Globe size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Ik kiek{dots}
            </span>
          </>
        )}

        {stage === "responding" && (
          <>
            <MessageSquare
              size={16}
              className="animate-bounce text-primary"
            />
            <span className="text-sm text-muted-foreground">
              Ik antwoorde{dots}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
