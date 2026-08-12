"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer as TimerIcon,
  Sparkles,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Target,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ZenSpotifyFocusWidget } from "@/components/zen-spotify-focus-widget";



type TimerMode = "focus" | "break" | "longBreak";

const MODE_DURATIONS: Record<TimerMode, number> = {
  focus: 25 * 60, // 25 min
  break: 5 * 60, // 5 min
  longBreak: 15 * 60, // 15 min
};

export function ZenTimer() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.focus);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [focusTask, setFocusTask] = useState<string>("Building Personal OS Architecture");
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [isZenOverlayActive, setIsZenOverlayActive] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer countdown engine
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);

            // Handle session completion
            if (mode === "focus") {
              setCompletedSessions((s) => s + 1);
              setMode("break");
              setTimeLeft(MODE_DURATIONS.break);
            } else {
              setMode("focus");
              setTimeLeft(MODE_DURATIONS.focus);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  const toggleTimer = () => {
    setIsRunning((prev) => {
      const next = !prev;
      localStorage.setItem("zen_running", next ? "true" : "false");
      // Defer so dispatch fires after this render cycle, avoiding setState-during-render
      setTimeout(() => window.dispatchEvent(new Event("zen_state_change")), 0);
      return next;
    });
  };

  const resetTimer = () => {
    setIsRunning(false);
    localStorage.setItem("zen_running", "false");
    setTimeout(() => window.dispatchEvent(new Event("zen_state_change")), 0);
    setTimeLeft(MODE_DURATIONS[mode]);
  };

  const switchMode = (newMode: TimerMode) => {
    setIsRunning(false);
    localStorage.setItem("zen_running", "false");
    setTimeout(() => window.dispatchEvent(new Event("zen_state_change")), 0);
    setMode(newMode);
    setTimeLeft(MODE_DURATIONS[newMode]);
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = MODE_DURATIONS[mode];
  const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100;
  const strokeDashoffset = 565 - (565 * progressPercent) / 100;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Header & Task Focus Bar */}
      <div className="glass-panel p-6 rounded-3xl space-y-5 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <TimerIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>ZEN TIME-BLOCKER</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Pomodoro Engine • Distraction-Free Deep Focus Mode
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-xs font-mono py-1 px-3 gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400 inline" />
              <span>{completedSessions} Sessions Completed</span>
            </Badge>
          </div>
        </div>

        {/* Focus Task Input Field */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span>WHAT ARE YOU FOCUSING ON RIGHT NOW?</span>
          </label>
          <Input
            value={focusTask}
            onChange={(e) => setFocusTask(e.target.value)}
            placeholder="e.g. Building Phase 7 Zen Time-Blocker Component..."
            className="bg-white/[0.03] border-white/10 text-sm font-sans font-semibold text-white rounded-xl focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Main Standard Pomodoro Dashboard View */}
      <div className="glass-panel p-8 rounded-3xl flex flex-col items-center justify-center space-y-8 border border-white/10 relative overflow-hidden">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 bg-white/[0.02] border border-white/10 p-1.5 rounded-2xl font-mono text-xs">
          {[
            { id: "focus", label: "Focus (25m)" },
            { id: "break", label: "Short Break (5m)" },
            { id: "longBreak", label: "Long Break (15m)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchMode(tab.id as TimerMode)}
              className={cn(
                "px-5 py-2 rounded-xl transition-all font-semibold",
                mode === tab.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Circular Ring Timer Display */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Ambient Glowing Backlight */}
          <div
            className={cn(
              "absolute inset-4 rounded-full blur-3xl transition-opacity duration-1000",
              isRunning
                ? mode === "focus"
                  ? "bg-indigo-600/30 opacity-100"
                  : "bg-emerald-600/30 opacity-100"
                : "opacity-0"
            )}
          />

          {/* SVG Progress Ring */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="144"
              cy="144"
              r="90"
              className="stroke-white/5"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="144"
              cy="144"
              r="90"
              className={cn(
                "transition-all duration-1000 ease-linear",
                mode === "focus" ? "stroke-indigo-500" : "stroke-emerald-400"
              )}
              strokeWidth="8"
              strokeDasharray="565"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Center Digital Clock */}
          <div className="absolute flex flex-col items-center justify-center text-center space-y-1">
            <span className="text-5xl font-extrabold font-mono tracking-tight text-white drop-shadow-md">
              {formatTime(timeLeft)}
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-indigo-300 font-bold">
              {mode === "focus" ? "DEEP FOCUS" : "REST BREAK"}
            </span>
          </div>
        </div>

        {/* Main Controls */}
        <div className="flex items-center gap-4">
          <Button
            size="lg"
            onClick={toggleTimer}
            className={cn(
              "rounded-2xl px-8 h-12 text-sm font-mono font-bold shadow-xl transition-all gap-2",
              isRunning
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
            )}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" /> PAUSE SESSION
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> START FOCUS
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={resetTimer}
            className="w-12 h-12 rounded-2xl border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsZenOverlayActive(true)}
            className="rounded-2xl h-12 px-4 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 font-mono text-xs gap-2"
          >
            <Maximize2 className="w-4 h-4" /> CINEMATIC MODE
          </Button>
        </div>
      </div>

      {/* CINEMATIC FULL-SCREEN DISTRACTION-FREE OVERLAY */}
      {isZenOverlayActive && (
        <div className="fixed inset-0 z-50 bg-[#09090c]/98 backdrop-blur-2xl flex flex-col items-center justify-between p-8 select-none animate-in fade-in duration-500">
          {/* Overlay Top Bar */}
          <div className="w-full max-w-4xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs tracking-widest uppercase font-bold">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
              <span>CINEMATIC ZEN FOCUS MODE</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsZenOverlayActive(false)}
              className="border-white/10 bg-white/5 text-slate-300 hover:text-white rounded-xl font-mono text-xs gap-2"
            >
              <Minimize2 className="w-3.5 h-3.5" /> EXIT ZEN OVERLAY
            </Button>
          </div>

          {/* Center Focus Hero View */}
          <div className="flex flex-col items-center justify-center text-center space-y-8 my-auto">
            {/* Goal Banner */}
            <div className="px-6 py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-slate-200 font-sans font-medium text-lg max-w-xl truncate">
              🎯 {focusTask || "Uninterrupted Focus Session"}
            </div>

            {/* Giant Glowing Countdown Clock */}
            <div className="relative flex flex-col items-center justify-center">
              <div
                className={cn(
                  "absolute w-96 h-96 rounded-full blur-[100px] transition-all duration-1000",
                  isRunning ? "bg-indigo-600/40 opacity-100 scale-110" : "bg-indigo-900/20 opacity-40 scale-100"
                )}
              />
              <span className="text-8xl md:text-9xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_50px_rgba(99,102,241,0.4)] relative">
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Overlay Play/Pause Button */}
            <div className="flex items-center gap-4 pt-4 relative">
              <Button
                size="lg"
                onClick={toggleTimer}
                className={cn(
                  "rounded-2xl px-10 h-14 text-base font-mono font-bold shadow-2xl transition-all gap-3",
                  isRunning
                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/50"
                )}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5" /> PAUSE FOCUS
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white" /> RESUME FOCUS
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={resetTimer}
                className="w-14 h-14 rounded-2xl border-white/10 bg-white/5 text-slate-300 hover:text-white"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* CINEMATIC ZEN SPOTIFY MUSIC & LIVE SYNCED LYRICS DISPLAY */}
          <div className="w-full max-w-2xl py-2">
            <ZenSpotifyFocusWidget />
          </div>

          {/* Overlay Footer Note */}
          <div className="text-center font-mono text-[11px] text-slate-500 opacity-60">
            Press Pause or Exit Zen Overlay anytime to return to standard view
          </div>


        </div>
      )}
    </div>
  );
}
