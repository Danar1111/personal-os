"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpotifyDrawer } from "@/hooks/use-spotify-drawer";

interface PillState {
  show: boolean;
  isVisible: boolean;
  status: "loading" | "connected" | "idle" | "unconnected";
  trackTitle?: string;
  artist?: string;
}

export function SpotifyStatusPill() {
  const { isDismissed, toggleRight, setMiniDismissed } = useSpotifyDrawer();
  const [pill, setPill] = useState<PillState>({
    show: false,
    isVisible: false,
    status: "loading",
  });

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unmountTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const triggerCheck = async () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (unmountTimeoutRef.current) clearTimeout(unmountTimeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // 1. Mount element in off-screen state
    setPill({ show: true, isVisible: false, status: "loading" });

    // 2. Trigger smooth slide-down transition on next frame
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = requestAnimationFrame(() => {
        setPill((prev) => ({ ...prev, isVisible: true }));
      });
    });

    let isNotConnected = false;

    try {
      const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.isConnected === false) {
          isNotConnected = true;
          setPill((prev) => ({ ...prev, status: "unconnected" }));
        } else if (json.title) {
          setPill((prev) => ({
            ...prev,
            status: "connected",
            trackTitle: json.title,
            artist: json.artist,
          }));
          // Show Left Sidebar Mini Player
          setMiniDismissed(false);
        } else {
          setPill((prev) => ({ ...prev, status: "idle" }));
        }
      } else {
        isNotConnected = true;
        setPill((prev) => ({ ...prev, status: "unconnected" }));
      }
    } catch (e) {
      isNotConnected = true;
      setPill((prev) => ({ ...prev, status: "unconnected" }));
    }

    // 3. Trigger smooth slide-up exit transition (longer timeout if unconnected so user can click Connect)
    const timeoutDuration = isNotConnected ? 6000 : 3200;
    hideTimeoutRef.current = setTimeout(() => {
      setPill((prev) => ({ ...prev, isVisible: false }));
      unmountTimeoutRef.current = setTimeout(() => {
        setPill((prev) => ({ ...prev, show: false }));
      }, 500);
    }, timeoutDuration);
  };

  // Keyboard Shortcuts & External Custom Event Listener
  useEffect(() => {
    const handleTriggerCheck = () => triggerCheck();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + M => Toggle Right Sidebar Player (only if mini player active)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        if (!isDismissed) toggleRight();
        return;
      }

      // Ctrl + M => Toggle Left Mini Player (Close if visible, or Check & Open if closed!)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        if (!isDismissed) {
          setMiniDismissed(true);
          toggleRight(false);
        } else {
          triggerCheck();
        }
        return;
      }
    };

    window.addEventListener("trigger-spotify-status-check", handleTriggerCheck);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("trigger-spotify-status-check", handleTriggerCheck);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDismissed, toggleRight, setMiniDismissed]);

  if (!pill.show) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 -translate-x-1/2 z-50 pointer-events-auto select-none font-sans transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        pill.isVisible
          ? "top-5 opacity-100 scale-100"
          : "top-[-80px] opacity-0 scale-95"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0a0a0b]/95 border border-white/10 shadow-2xl backdrop-blur-2xl text-white shadow-black/80">
        {pill.status === "loading" && (
          <>
            <div className="p-1.5 rounded-xl bg-[#1DB954]/20 text-[#1DB954]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-xs font-bold font-mono text-emerald-400">
                Checking Spotify Playback...
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Connecting to API endpoint
              </span>
            </div>
          </>
        )}

        {pill.status === "connected" && (
          <>
            <div className="p-1.5 rounded-xl bg-[#1DB954] text-black shadow-md shadow-[#1DB954]/30">
              <CheckCircle2 className="w-4 h-4 fill-black text-[#1DB954]" />
            </div>
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-xs font-bold text-white truncate max-w-[240px]">
                {pill.trackTitle}
              </span>
              <span className="text-[10px] text-[#1DB954] font-mono truncate max-w-[240px]">
                Connected &amp; Active • {pill.artist}
              </span>
            </div>
          </>
        )}

        {pill.status === "idle" && (
          <>
            <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-xs font-bold text-slate-200 font-mono">
                No Active Spotify Track
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Play a song on Spotify app to activate
              </span>
            </div>
          </>
        )}

        {pill.status === "unconnected" && (
          <>
            <div className="p-1.5 rounded-xl bg-rose-500/20 text-rose-400">
              <Link2Off className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-xs font-bold text-rose-300 font-mono">
                Spotify Not Connected
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Pair account to enable player
              </span>
            </div>
            <a
              href="/api/spotify/login"
              className="px-3 py-1 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-[11px] font-sans transition-all ml-1 shadow-md shadow-[#1DB954]/20 cursor-pointer"
            >
              Connect
            </a>
          </>
        )}
      </div>
    </div>
  );
}
