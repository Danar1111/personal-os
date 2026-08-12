"use client";

import React, { useState, useEffect } from "react";
import { Music, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpotifyDrawer } from "@/hooks/use-spotify-drawer";

interface PillState {
  show: boolean;
  status: "loading" | "connected" | "idle";
  trackTitle?: string;
  artist?: string;
}

export function SpotifyStatusPill() {
  const { isDismissed, toggleRight, setMiniDismissed } = useSpotifyDrawer();
  const [pill, setPill] = useState<PillState>({ show: false, status: "loading" });

  // Function to trigger Spotify Check via Ctrl+M or Event
  const triggerCheck = async () => {
    setPill({ show: true, status: "loading" });

    try {
      const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.title) {
          setPill({
            show: true,
            status: "connected",
            trackTitle: json.title,
            artist: json.artist,
          });
          // Show Left Sidebar Mini Player
          setMiniDismissed(false);
        } else {
          setPill({ show: true, status: "idle" });
        }
      } else {
        setPill({ show: true, status: "idle" });
      }
    } catch (e) {
      setPill({ show: true, status: "idle" });
    }

    // Hide pill after 3.5 seconds
    setTimeout(() => {
      setPill((prev) => ({ ...prev, show: false }));
    }, 3500);
  };

  // Keyboard Shortcuts Handler (Ctrl+M and Ctrl+Shift+M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + M => Toggle Right Sidebar Player (only if mini player active)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        if (!isDismissed) {
          toggleRight();
        }
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDismissed, toggleRight, setMiniDismissed]);

  if (!pill.show) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none font-sans animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0a0a0b]/95 border border-[#1DB954]/40 shadow-2xl backdrop-blur-2xl text-white shadow-black/80">
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
      </div>
    </div>
  );
}
