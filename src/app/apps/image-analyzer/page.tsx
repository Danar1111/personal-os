import React from "react";
import { ImageAnalyzer } from "@/components/tools/ImageAnalyzer";

export const metadata = {
  title: "AI Image Detail Analyzer | Personal OS",
  description: "Reverse-engineer images into detailed text-to-image prompts for Midjourney & Stable Diffusion",
};

export const dynamic = "force-dynamic";

export default function ImageAnalyzerPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <ImageAnalyzer />
    </div>
  );
}
