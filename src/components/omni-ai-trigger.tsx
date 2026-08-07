"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OmniAiTrigger() {
  const handleOpenAi = () => {
    window.dispatchEvent(new CustomEvent("open-omni-ai"));
  };

  return (
    <Button
      onClick={handleOpenAi}
      variant="outline"
      size="sm"
      className="hidden sm:flex items-center gap-1.5 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 font-mono text-xs rounded-xl h-8 px-3 cursor-pointer shadow-sm transition-all"
      title="Open Omni AI Assistant (Ctrl+J)"
    >
      <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
      <span>Ask Omni AI</span>
    </Button>
  );
}
