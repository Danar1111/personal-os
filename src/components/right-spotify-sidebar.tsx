"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ExternalLink,
  X,
  Mic2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSpotifyDrawer } from "@/hooks/use-spotify-drawer";

interface NowPlayingData {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumImageUrl?: string;
  songUrl?: string;
  progress_ms?: number;
  duration_ms?: number;
}

interface LyricLine {
  timeMs: number;
  text: string;
}

function formatMs(ms?: number): string {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function RightSpotifySidebar() {
  const { isOpen, toggleRight } = useSpotifyDrawer();

  const [data, setData] = useState<NowPlayingData>({ isPlaying: false });
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isControlling, setIsControlling] = useState(false);

  // Local progress ticker
  const [localProgressMs, setLocalProgressMs] = useState<number>(0);
  const lastTrackIdRef = useRef<string>("");
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Poll Spotify Currently Playing every 3.5 seconds
  useEffect(() => {
    let isMounted = true;

    const fetchNowPlaying = async () => {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        if (!res.ok) return;
        const json: NowPlayingData = await res.json();

        if (isMounted) {
          setData(json);
          if (json.progress_ms !== undefined) {
            setLocalProgressMs(json.progress_ms);
          }
        }
      } catch (err) {
        console.warn("[Right Spotify Sidebar] Failed to fetch now playing:", err);
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Smooth 200ms ticker when playing
  useEffect(() => {
    if (!data.isPlaying) return;

    const timer = setInterval(() => {
      setLocalProgressMs((prev) => {
        if (data.duration_ms && prev >= data.duration_ms) {
          return data.duration_ms;
        }
        return prev + 200;
      });
    }, 200);

    return () => clearInterval(timer);
  }, [data.isPlaying, data.duration_ms]);

  // Fetch Synced Lyrics when track changes
  useEffect(() => {
    const currentTrackKey = `${data.artist || ""}-${data.title || ""}`;

    if (!data.title || !data.artist || currentTrackKey === lastTrackIdRef.current) {
      return;
    }

    lastTrackIdRef.current = currentTrackKey;
    setIsLoadingLyrics(true);
    setLyrics(null);

    const fetchLyrics = async () => {
      try {
        const res = await fetch(
          `/api/spotify/lyrics?artist=${encodeURIComponent(data.artist!)}&track=${encodeURIComponent(data.title!)}`
        );
        const json = await res.json();
        setLyrics(json.lyrics || null);
      } catch (err) {
        console.warn("[Right Spotify Sidebar] Failed to fetch lyrics:", err);
        setLyrics(null);
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchLyrics();
  }, [data.title, data.artist]);

  // Active lyric index
  const activeLyricIndex = React.useMemo(() => {
    if (!lyrics || lyrics.length === 0) return -1;

    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (localProgressMs >= lyrics[i].timeMs) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lyrics, localProgressMs]);

  // Auto-scroll active lyric line into center
  useEffect(() => {
    if (isOpen && activeLyricIndex >= 0 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeLyricIndex, isOpen]);

  const handleControl = async (action: "play" | "pause" | "next" | "previous") => {
    if (isControlling) return;
    setIsControlling(true);

    try {
      await fetch("/api/spotify/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.progress_ms !== undefined) setLocalProgressMs(json.progress_ms);
      }
    } catch (e) {
      console.warn("Failed playback control:", e);
    } finally {
      setIsControlling(false);
    }
  };

  const progressPercent =
    data.duration_ms && data.duration_ms > 0
      ? Math.min(100, (localProgressMs / data.duration_ms) * 100)
      : 0;

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen glass-panel border-l border-white/10 transition-all duration-300 z-30 select-none shrink-0 bg-[#0a0a0b] overflow-hidden",
        isOpen ? "w-64" : "w-0 opacity-0 pointer-events-none border-l-0"
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center h-16 border-b border-white/10 px-4 justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Music className="w-4 h-4 text-[#1DB954] animate-pulse shrink-0" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-white truncate">
            PLAYER &amp; LYRICS
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {data.songUrl && (
            <a
              href={data.songUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#1DB954] hover:bg-[#1DB954]/10 transition-all cursor-pointer"
              title="Open track on Spotify"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => toggleRight(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Close Right Sidebar Player"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      {data.title ? (
        <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3.5 overflow-hidden">
          {/* Album Cover & Track Details */}
          <div className="space-y-2.5 shrink-0 text-center">
            <div className="relative group mx-auto w-36 h-36 shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#1DB954]/20 blur-md group-hover:bg-[#1DB954]/30 transition-all" />
              <div className="relative w-full h-full rounded-full overflow-hidden border border-white/20 shadow-2xl">
                <img
                  src={data.albumImageUrl || "/icon.png"}
                  alt={data.title}
                  className={cn(
                    "w-full h-full object-cover",
                    data.isPlaying && "animate-[spin_12s_linear_infinite]"
                  )}
                />
                <div className="absolute inset-0 m-auto w-4 h-4 rounded-full bg-slate-950 border border-white/40 shadow-inner" />
              </div>
            </div>


            <div className="space-y-0.5 px-1">
              <h4 className="text-xs font-bold text-white truncate font-sans" title={data.title}>
                {data.title}
              </h4>
              <p className="text-[11px] text-slate-300 truncate font-mono" title={data.artist}>
                {data.artist}
              </p>
            </div>
          </div>

          {/* Seeker Bar */}
          <div className="space-y-1 shrink-0">
            <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-[#1DB954] transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{formatMs(localProgressMs)}</span>
              <span>{formatMs(data.duration_ms)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 shrink-0 border-b border-white/10 pb-3">
            <Button
              size="icon"
              variant="ghost"
              disabled={isControlling}
              onClick={() => handleControl("previous")}
              className="h-8 w-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Previous Track"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>

            <Button
              size="icon"
              disabled={isControlling}
              onClick={() => handleControl(data.isPlaying ? "pause" : "play")}
              className="h-9 w-9 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-md shadow-[#1DB954]/20 cursor-pointer font-bold"
              title={data.isPlaying ? "Pause" : "Play"}
            >
              {data.isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black ml-0.5" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              disabled={isControlling}
              onClick={() => handleControl("next")}
              className="h-8 w-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Next Track"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>


          {/* KARAOKE SYNCED LYRICS (FULL HEIGHT FLEX-1) */}
          <div className="flex-1 flex flex-col min-h-0 space-y-1.5 pt-1">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider flex items-center gap-1 font-bold">
                <Mic2 className="w-3 h-3 text-[#1DB954]" /> KARAOKE LYRICS
              </span>
            </div>

            <div
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-black/40 border border-white/5 scrollbar-thin scrollbar-thumb-white/10"
            >
              {lyrics && lyrics.length > 0 ? (
                lyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "transition-all duration-300 rounded-xl px-3 py-2 text-[11px] font-sans leading-relaxed my-0.5",
                        isActive
                          ? "bg-[#1DB954]/20 text-[#1DB954] font-bold border border-[#1DB954]/40 scale-[1.02] shadow-sm shadow-[#1DB954]/20"
                          : "text-slate-400 hover:text-slate-200 opacity-80"
                      )}
                    >
                      {line.text && line.text.trim() !== "" && line.text.trim() !== "♪"
                        ? line.text
                        : "♪ Instrumental ♪"}

                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-500 font-mono text-center py-8">
                  No synced lyrics found.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Idle State */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-2 font-mono">
          <Music className="w-6 h-6 text-[#1DB954]" />
          <p className="text-xs text-slate-300 font-bold">No Track Playing</p>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Play music on Spotify to display player &amp; lyrics here.
          </p>
        </div>
      )}
    </aside>
  );
}
