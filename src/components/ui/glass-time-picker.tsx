"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock, X, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlassTimePickerProps {
  value?: string; // "HH:mm" format e.g. "07:00" or "14:30"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  popupClassName?: string;
  accentColor?: "indigo" | "amber" | "purple" | "emerald";
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function GlassTimePicker({
  value = "",
  onChange,
  placeholder = "Select time...",
  className,
  popupClassName,
  accentColor = "amber",
}: GlassTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ left: number; top: number } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  // Parse hour and minute from value or default
  const parseVal = (val: string) => {
    if (!val || !val.includes(":")) return { h: "09", m: "00" };
    const [hStr, mStr] = val.split(":");
    const h = String(parseInt(hStr, 10) || 0).padStart(2, "0");
    const m = String(parseInt(mStr, 10) || 0).padStart(2, "0");
    return { h, m };
  };

  const initial = parseVal(value);
  const [selHour, setSelHour] = useState<string>(initial.h);
  const [selMinute, setSelMinute] = useState<string>(initial.m);

  useEffect(() => {
    setMounted(true);
    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  useEffect(() => {
    if (value) {
      const parsed = parseVal(value);
      setSelHour(parsed.h);
      setSelMinute(parsed.m);
    }
  }, [value]);

  // Compute fixed right-center position relative to parent dialog if in a modal
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const dialog = containerRef.current.closest('[role="dialog"]') as HTMLElement | null;
      if (dialog && window.innerWidth >= 768) {
        const rect = dialog.getBoundingClientRect();
        setPopupPos({
          left: rect.right + 14,
          top: rect.top + rect.height / 2,
        });
      } else {
        setPopupPos(null);
      }
    }
  }, [isOpen]);

  // Scroll active hour and minute into view when popup opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const activeHourEl = hourColRef.current?.querySelector('[data-selected="true"]');
        if (activeHourEl) activeHourEl.scrollIntoView({ block: "center", behavior: "smooth" });

        const activeMinEl = minuteColRef.current?.querySelector('[data-selected="true"]');
        if (activeMinEl) activeMinEl.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleConfirm = () => {
    const timeStr = `${selHour}:${selMinute}`;
    onChange(timeStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setSelHour("09");
    setSelMinute("00");
    setIsOpen(false);
  };

  const formatDisplayTime = (val?: string) => {
    if (!val) return "";
    const [hStr, mStr] = val.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return val;

    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = String(m).padStart(2, "0");
    return `${String(displayH).padStart(2, "0")}:${displayM} ${period}`;
  };

  const formatHour12 = (hStr: string) => {
    const h = parseInt(hStr, 10);
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, "0")} ${period}`;
  };

  const themes = {
    indigo: {
      activeBorder: "focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20",
      selected: "bg-indigo-600 border-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/40",
      badge: "text-indigo-400",
      confirmBtn: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30",
    },
    amber: {
      activeBorder: "focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20",
      selected: "bg-amber-600 border-amber-500 text-white font-bold shadow-lg shadow-amber-600/40",
      badge: "text-amber-400",
      confirmBtn: "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30",
    },
    purple: {
      activeBorder: "focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20",
      selected: "bg-purple-600 border-purple-500 text-white font-bold shadow-lg shadow-purple-600/40",
      badge: "text-purple-400",
      confirmBtn: "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30",
    },
    emerald: {
      activeBorder: "focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20",
      selected: "bg-emerald-600 border-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/40",
      badge: "text-emerald-400",
      confirmBtn: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30",
    },
  };

  const currentTheme = themes[accentColor];

  const popupContent = (
    <div className="space-y-3 font-mono select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h4 className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>SELECT DUE TIME</span>
        </h4>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-slate-400 hover:text-rose-300 font-bold px-1.5 py-0.5 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* 2 Scrollable Columns: Hours & Minutes */}
      <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-2.5 rounded-2xl border border-white/10">
        {/* Hours Column */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold block text-center uppercase tracking-wider">
            Hour (Jam)
          </span>
          <div
            ref={hourColRef}
            className="h-48 overflow-y-auto pr-1 space-y-1 rounded-xl scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
          >
            {HOURS.map((h) => {
              const isSelected = selHour === h;
              return (
                <button
                  key={`h-${h}`}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => setSelHour(h)}
                  className={cn(
                    "w-full h-8 rounded-xl text-xs font-mono transition-all flex items-center justify-center relative cursor-pointer border select-none font-bold px-2",
                    isSelected
                      ? currentTheme.selected
                      : "bg-white/[0.03] border-white/5 hover:bg-white/10 text-slate-300"
                  )}
                >
                  <span>{h}</span>
                  <span className={cn("text-[9px] absolute right-2 font-mono font-normal tracking-tight opacity-75", isSelected ? "text-white font-bold opacity-100" : "text-slate-500")}>
                    {formatHour12(h)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Minutes Column */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold block text-center uppercase tracking-wider">
            Minute (Menit)
          </span>
          <div
            ref={minuteColRef}
            className="h-48 overflow-y-auto pr-1 space-y-1 rounded-xl scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
          >
            {MINUTES.map((m) => {
              const isSelected = selMinute === m;
              const isFiveMinStep = parseInt(m, 10) % 5 === 0;
              return (
                <button
                  key={`m-${m}`}
                  type="button"
                  data-selected={isSelected}
                  onClick={() => setSelMinute(m)}
                  className={cn(
                    "w-full h-8 rounded-xl text-xs font-mono transition-all flex items-center justify-center relative cursor-pointer border select-none font-bold px-2",
                    isSelected
                      ? currentTheme.selected
                      : isFiveMinStep
                      ? "bg-white/[0.04] border-white/10 text-white"
                      : "bg-white/[0.01] border-transparent hover:bg-white/10 text-slate-400"
                  )}
                >
                  <span>{m}</span>
                  {isFiveMinStep && !isSelected && (
                    <span className="text-[6px] text-amber-400 absolute right-2.5 top-1/2 -translate-y-1/2 font-mono">●</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-white font-mono">
            {selHour}:{selMinute} ({formatDisplayTime(`${selHour}:${selMinute}`)})
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          className={cn("h-8 text-xs text-white font-mono rounded-xl px-3.5 cursor-pointer font-bold shadow-lg flex items-center gap-1.5", currentTheme.confirmBtn)}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Apply Time</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative font-mono", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 px-3.5 rounded-2xl bg-white/[0.04] border border-white/15 hover:border-white/30 text-xs font-mono transition-all flex items-center justify-between gap-2 select-none cursor-pointer",
          isOpen && "border-amber-500/60 ring-2 ring-amber-500/20 bg-white/[0.07]",
          currentTheme.activeBorder
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Clock className={cn("w-3.5 h-3.5 shrink-0", value ? currentTheme.badge : "text-slate-400")} />
          <span className={cn("truncate", value ? "text-white font-bold" : "text-slate-500")}>
            {formatDisplayTime(value) || placeholder}
          </span>
        </div>

        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/10 transition-colors"
            title="Clear time"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {isOpen && mounted && (
        popupPos && isDesktop
          ? createPortal(
              <div
                ref={popupRef}
                style={{
                  position: "fixed",
                  left: `${popupPos.left}px`,
                  top: `${popupPos.top}px`,
                  transform: "translateY(-50%)",
                }}
                className={cn(
                  "z-[999] w-72 p-3.5 rounded-3xl bg-[#0f0f1b]/98 border border-white/15 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 font-mono select-none",
                  popupClassName
                )}
              >
                {popupContent}
              </div>,
              document.body
            )
          : (
              <div
                ref={popupRef}
                className={cn(
                  "absolute z-50 w-72 p-3.5 rounded-3xl bg-[#0f0f1b]/98 border border-white/15 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 font-mono select-none top-full left-0 mt-2",
                  popupClassName
                )}
              >
                {popupContent}
              </div>
            )
      )}
    </div>
  );
}

