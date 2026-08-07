"use client";

import { useLockTimer } from "@/components/pin-lock-provider";
import { Timer, Flame } from "lucide-react";
import { useState, useEffect } from "react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function HeaderCountdown() {
  const { timeLeft, isLocked } = useLockTimer();
  const [zenRunning, setZenRunning] = useState(false);

  useEffect(() => {
    const sync = () => {
      setZenRunning(localStorage.getItem("zen_running") === "true");
    };
    sync();
    window.addEventListener("zen_state_change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("zen_state_change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (isLocked) return null;

  if (zenRunning) {
    return (
      <div className="text-right hidden md:block">
        <div className="text-xs font-mono font-bold flex items-center gap-1.5 justify-end text-amber-400">
          <Flame className="w-3.5 h-3.5 animate-pulse" />
          <span className="tracking-widest">ZEN MODE</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
          Lock paused · Focus active
        </div>
      </div>
    );
  }

  const isLow = timeLeft <= 60;
  const isMid = timeLeft <= 180;

  return (
    <div className="text-right hidden md:block">
      <div
        className={`text-xs font-mono font-bold flex items-center gap-1.5 justify-end transition-colors ${
          isLow ? "text-rose-400" : isMid ? "text-amber-400" : "text-indigo-400"
        }`}
      >
        <Timer className={`w-3.5 h-3.5 ${isLow ? "animate-pulse" : ""}`} />
        <span className="tabular-nums tracking-widest">{formatTime(timeLeft)}</span>
      </div>
      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
        {isLow ? "Locking soon..." : "Auto-lock countdown"}
      </div>
    </div>
  );
}
