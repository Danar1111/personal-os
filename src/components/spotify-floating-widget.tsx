"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  X,
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

interface SidebarSpotifyPlayerProps {
  isCollapsed?: boolean;
}

export function SpotifyFloatingWidget({ isCollapsed = false }: SidebarSpotifyPlayerProps) {
  const { isDismissed, toggleRight, setMiniDismissed } = useSpotifyDrawer();

  const [data, setData] = useState<NowPlayingData>({ isPlaying: false });

  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isControlling, setIsControlling] = useState(false);

  const [localProgressMs, setLocalProgressMs] = useState<number>(0);
  const lastTrackIdRef = useRef<string>("");

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
        console.warn("[Spotify Sidebar Mini] Failed to fetch now playing:", err);
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Smooth ticker when playing
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
        console.warn("[Spotify Sidebar Mini] Failed to fetch lyrics:", err);
        setLyrics(null);
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchLyrics();
  }, [data.title, data.artist]);

  // Active lyric index calculation
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

  // Playback control trigger
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

  const hasLyricsLoaded = lyrics !== null && lyrics.length > 0;
  const rawLyricLine = activeLyricIndex >= 0 && lyrics ? lyrics[activeLyricIndex]?.text : null;

  let lyricDisplayText = "No synced lyrics available";
  let isInstrumentalText = false;

  if (isLoadingLyrics) {
    lyricDisplayText = "Loading lyrics...";
  } else if (hasLyricsLoaded) {
    if (activeLyricIndex === -1) {
      lyricDisplayText = "♪ Instrumental Intro ♪";
      isInstrumentalText = true;
    } else if (!rawLyricLine || rawLyricLine.trim() === "" || rawLyricLine.trim() === "♪") {
      lyricDisplayText = "♪ Instrumental ♪";
      isInstrumentalText = true;
    } else {
      lyricDisplayText = `"${rawLyricLine.trim()}"`;
    }
  }

  if (isDismissed) return null;


  return (

    <div className="w-full">
      {isCollapsed ? (
        /* COLLAPSED SIDEBAR VIEW (ICON ONLY) */
        <div className="flex justify-center p-2">
          <button
            onClick={() => toggleRight(true)}
            title={data.title ? `Spotify: ${data.title} - ${data.artist}` : "Mini Music Player"}
            className="relative p-2 rounded-xl bg-white/[0.03] hover:bg-[#1DB954]/20 border border-white/10 text-slate-300 hover:text-[#1DB954] transition-all cursor-pointer group"
          >
            {data.title && data.albumImageUrl ? (
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20">
                <img
                  src={data.albumImageUrl}
                  alt={data.title}
                  className={cn(
                    "w-full h-full object-cover",
                    data.isPlaying && "animate-[spin_8s_linear_infinite]"
                  )}
                />
                <div className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-slate-950 border border-white/40" />
              </div>
            ) : (
              <Music className="w-5 h-5 text-[#1DB954]" />
            )}
            {data.isPlaying && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
            )}
          </button>
        </div>
      ) : (
        /* EXPANDED SIDEBAR VIEW (FULL MINI PLAYER CARD) */
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5 shadow-md">
          {/* Title Header */}
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Music className="w-3.5 h-3.5 text-[#1DB954] animate-pulse" />
              MINI MUSIC PLAYER
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => toggleRight(true)}
                title="Open Right Sidebar Player & Lyrics"
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  setMiniDismissed(true);
                  toggleRight(false);
                }}
                title="Force Close Player"
                className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>


          {data.title ? (
            <div className="space-y-2">
              {/* Controls & Rotating Album Center Row */}
              <div className="flex items-center justify-between gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                {/* Previous Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isControlling}
                  onClick={() => handleControl("previous")}
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                  title="Previous Track"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </Button>

                {/* Center Spinning Album Image */}
                <button
                  onClick={() => toggleRight(true)}
                  className="relative group shrink-0 cursor-pointer"
                  title="Click to open Right Sidebar Player & Lyrics"
                >
                  <div className="relative w-11 h-11 rounded-full overflow-hidden border border-white/20 shadow-md group-hover:scale-105 transition-transform duration-300">
                    <img
                      src={data.albumImageUrl || "/icon.png"}
                      alt={data.title}
                      className={cn(
                        "w-full h-full object-cover",
                        data.isPlaying && "animate-[spin_10s_linear_infinite]"
                      )}
                    />
                    <div className="absolute inset-0 m-auto w-3.5 h-3.5 rounded-full bg-slate-950 border border-white/40" />
                  </div>
                </button>

                {/* Play / Pause Toggle Button */}
                <Button
                  size="icon"
                  disabled={isControlling}
                  onClick={() => handleControl(data.isPlaying ? "pause" : "play")}
                  className="h-8 w-8 rounded-lg bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-md shadow-[#1DB954]/20 cursor-pointer shrink-0"
                  title={data.isPlaying ? "Pause" : "Play"}
                >
                  {data.isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-black" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                  )}
                </Button>

                {/* Next Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isControlling}
                  onClick={() => handleControl("next")}
                  className="h-8 w-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                  title="Next Track"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Track Title & Artist Subtitle */}
              <div className="text-center px-1">
                <p className="text-xs font-bold text-white truncate font-sans">{data.title}</p>
                <p className="text-[10px] text-slate-400 truncate font-mono">{data.artist}</p>
              </div>

              {/* ANIMATED PER-LINE LYRIC SNIPPET (FIXED 2-LINE HEIGHT CONTAINER - NO SHIFTING) */}
              <div
                onClick={() => toggleRight(true)}
                className="h-12 w-full p-2 rounded-xl bg-black/60 border border-white/10 cursor-pointer hover:border-[#1DB954]/40 transition-colors flex items-center justify-center text-center overflow-hidden relative group"
              >
                <div
                  key={lyricDisplayText}
                  className="w-full flex items-center justify-center animate-in slide-in-from-bottom-2 duration-500 ease-out"
                >
                  {isLoadingLyrics ? (
                    <span className="text-[10px] font-mono text-slate-400 italic">Loading lyrics...</span>
                  ) : hasLyricsLoaded ? (
                    <p
                      className={cn(
                        "text-[11px] font-medium leading-snug line-clamp-2 font-sans tracking-wide text-center",
                        isInstrumentalText ? "text-slate-400 italic font-mono text-[10px]" : "text-[#1DB954]"
                      )}
                    >
                      {lyricDisplayText}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic font-mono">No synced lyrics available</p>
                  )}
                </div>

              </div>
            </div>
          ) : (
            /* Idle State */
            <div className="py-2 text-center space-y-1.5 font-mono">
              <p className="text-xs text-slate-400">No Music Playing</p>
              <a
                href="/api/spotify/login"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1DB954] text-black font-bold text-[10px] hover:bg-[#1ed760] transition-all"
              >
                Connect Spotify
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
