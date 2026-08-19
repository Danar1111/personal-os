"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlassDatePickerProps {
  value?: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
  popupClassName?: string;
  accentColor?: "indigo" | "amber" | "purple" | "emerald";
  placement?: "right" | "bottom" | "top" | "left" | "auto";
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function GlassDatePicker({
  value,
  onChange,
  placeholder = "Select date...",
  minDate,
  maxDate,
  className,
  popupClassName,
  accentColor = "indigo",
}: GlassDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ left: number; top: number } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

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

  // Parse initial view date based on value or today
  const selectedDateObj = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState<number>(() =>
    selectedDateObj ? selectedDateObj.getFullYear() : new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(() =>
    selectedDateObj ? selectedDateObj.getMonth() : new Date().getMonth()
  );

  // Sync view when value changes
  useEffect(() => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Click outside to close (handles document.body portaled popup as well)
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

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate calendar days for current view
  const firstDayIndex = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handleSelectDate = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${mm}-${dd}`;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${mm}-${dd}`;
    onChange(dateStr);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  // Color theme mapping
  const themes = {
    indigo: {
      activeBorder: "focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20",
      selected: "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/40",
      today: "border border-indigo-500/50 text-indigo-300",
      badge: "text-indigo-400",
      glow: "hover:border-indigo-500/40",
    },
    amber: {
      activeBorder: "focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20",
      selected: "bg-amber-600 text-white font-bold shadow-lg shadow-amber-600/40",
      today: "border border-amber-500/50 text-amber-300",
      badge: "text-amber-400",
      glow: "hover:border-amber-500/40",
    },
    purple: {
      activeBorder: "focus-within:border-purple-500/60 focus-within:ring-2 focus-within:ring-purple-500/20",
      selected: "bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/40",
      today: "border border-purple-500/50 text-purple-300",
      badge: "text-purple-400",
      glow: "hover:border-purple-500/40",
    },
    emerald: {
      activeBorder: "focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20",
      selected: "bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/40",
      today: "border border-emerald-500/50 text-emerald-300",
      badge: "text-emerald-400",
      glow: "hover:border-emerald-500/40",
    },
  };

  const currentTheme = themes[accentColor];

  // Display formatted label
  const formattedDisplay = selectedDateObj && !isNaN(selectedDateObj.getTime())
    ? selectedDateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  // Calendar inner UI
  const calendarContent = (
    <>
      {/* Header Month / Year Stepper */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <h4 className="text-xs font-bold text-white tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h4>

        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-xl p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={prevMonth}
            className="h-6 w-6 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={nextMonth}
            className="h-6 w-6 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, idx) => (
          <span
            key={w}
            className={cn(
              "text-[10px] font-bold py-0.5",
              idx === 6 ? "text-rose-400" : "text-slate-400"
            )}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Month Day Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Prev month days */}
        {Array.from({ length: firstDayIndex }).map((_, i) => {
          const day = daysInPrevMonth - firstDayIndex + i + 1;
          return (
            <div
              key={`prev-${day}`}
              className="h-7 flex items-center justify-center text-[10px] text-slate-600 select-none"
            >
              {day}
            </div>
          );
        })}

        {/* Current month days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = value === dateStr;

          const today = new Date();
          const isToday =
            today.getFullYear() === viewYear &&
            today.getMonth() === viewMonth &&
            today.getDate() === day;

          const isPastMin = minDate && dateStr < minDate;
          const isPastMax = maxDate && dateStr > maxDate;
          const isDisabled = Boolean(isPastMin || isPastMax);

          return (
            <button
              key={`curr-${day}`}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSelectDate(day)}
              className={cn(
                "h-7 rounded-xl text-xs flex items-center justify-center font-mono transition-all cursor-pointer select-none",
                isDisabled && "opacity-20 cursor-not-allowed",
                !isDisabled && !isSelected && "hover:bg-white/10 text-slate-200",
                isToday && !isSelected && currentTheme.today,
                isSelected && currentTheme.selected
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Quick Action Footer */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handleClear}
          className="text-[10px] text-slate-400 hover:text-rose-300 transition-colors font-bold px-1.5 py-0.5 rounded-lg hover:bg-white/5 cursor-pointer"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSelectToday}
          className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer", currentTheme.badge)}
        >
          Today
        </button>
      </div>
    </>
  );

  return (
    <div ref={containerRef} className={cn("relative font-mono", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full h-10 px-3.5 rounded-2xl bg-white/[0.04] border border-white/15 hover:border-white/30 text-xs font-mono transition-all flex items-center justify-between gap-2 select-none cursor-pointer",
          isOpen && "border-indigo-500/60 ring-2 ring-indigo-500/20 bg-white/[0.07]",
          currentTheme.activeBorder
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className={cn("w-3.5 h-3.5 shrink-0", value ? currentTheme.badge : "text-slate-400")} />
          <span className={cn("truncate", value ? "text-white font-bold" : "text-slate-500")}>
            {formattedDisplay || placeholder}
          </span>
        </div>

        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/10 transition-colors"
            title="Clear date"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Render Popup: Fixed to body next to dialog on desktop, or inline on mobile */}
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
                  "z-[999] w-72 p-3.5 rounded-3xl bg-[#0f0f1b]/98 border border-white/15 shadow-2xl backdrop-blur-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 font-mono select-none",
                  popupClassName
                )}
              >
                {calendarContent}
              </div>,
              document.body
            )
          : (
              <div
                ref={popupRef}
                className={cn(
                  "absolute z-50 w-72 p-3.5 rounded-3xl bg-[#0f0f1b]/98 border border-white/15 shadow-2xl backdrop-blur-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 font-mono select-none top-full left-0 mt-2",
                  popupClassName
                )}
              >
                {calendarContent}
              </div>
            )
      )}
    </div>
  );
}
