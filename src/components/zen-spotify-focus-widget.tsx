"use client";

import React, { useState, useEffect, useRef } from "react";
import { Music, Play, Pause, SkipBack, SkipForward, Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NowPlayingData {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  albumImageUrl?: string;
  progress_ms?: number;
  duration_ms?: number;
}

interface LyricLine {
  timeMs: number;
  text: string;
}

export function ZenSpotifyFocusWidget() {
  const [data, setData] = useState<NowPlayingData>({ isPlaying: false });
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isControlling, setIsControlling] = useState(false);

  const [localProgressMs, setLocalProgressMs] = useState<number>(0);
  const lastTrackIdRef = useRef<string>("");

  // Poll Spotify Currently Playing
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
        console.warn("[Zen Focus Spotify] Failed to fetch now playing:", err);
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Smooth 200ms ticker
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

  // Fetch Lyrics
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
        console.warn("[Zen Focus Spotify] Failed to fetch lyrics:", err);
        setLyrics(null);
      } finally {
        setIsLoadingLyrics(false);
      }
    };

    fetchLyrics();
  }, [data.title, data.artist]);

  // Active lyric calculation
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
  const nextLyricLine =
    activeLyricIndex >= 0 && lyrics && activeLyricIndex + 1 < lyrics.length
      ? lyrics[activeLyricIndex + 1]?.text
      : null;

  let lyricDisplayText = "♪ No synced lyrics available ♪";
  let isInstrumentalText = false;

  if (isLoadingLyrics) {
    lyricDisplayText = "Fetching synchronized lyrics...";
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

  if (!data.title) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-500 opacity-60">
        <Music className="w-4 h-4 text-[#1DB954]" />
        <span>No Active Spotify Playback in Zen Mode</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center text-center space-y-4 font-sans select-none">
      {/* CINEMATIC GLOWING KARAOKE LYRIC DISPLAY */}
      <div className="min-h-[64px] flex flex-col items-center justify-center space-y-1 px-4">
        <div key={lyricDisplayText} className="animate-in slide-in-from-bottom-2 duration-500">
          {isLoadingLyrics ? (
            <p className="text-xs font-mono text-slate-400 italic">Fetching synchronized lyrics...</p>
          ) : hasLyricsLoaded ? (
            <h3
              className={cn(
                "text-lg md:text-xl font-bold tracking-wide transition-all",
                isInstrumentalText
                  ? "text-slate-400 opacity-70 italic font-mono text-sm"
                  : "text-[#1DB954] drop-shadow-[0_0_25px_rgba(29,185,84,0.4)]"
              )}
            >
              {lyricDisplayText}
            </h3>
          ) : (
            <p className="text-xs font-mono text-slate-500 italic">♪ Instrumental / No synced lyrics available ♪</p>
          )}
        </div>

        {nextLyricLine && (
          <p className="text-xs text-slate-400 opacity-50 font-medium truncate max-w-md">
            Up next: {nextLyricLine.trim() === "♪" ? "♪ Instrumental ♪" : nextLyricLine}
          </p>
        )}
      </div>


      {/* SLEEK HORIZONTAL PLAYER BAR */}
      <div className="flex items-center justify-between gap-4 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/10 shadow-2xl backdrop-blur-xl max-w-md w-full">
        {/* Album Art Vinyl */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/20 shrink-0 shadow-md">
            <img
              src={data.albumImageUrl || "/icon.png"}
              alt={data.title}
              className={cn(
                "w-full h-full object-cover",
                data.isPlaying && "animate-[spin_10s_linear_infinite]"
              )}
            />
            <div className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-slate-950 border border-white/40" />
          </div>

          <div className="flex flex-col text-left min-w-0">
            <span className="text-xs font-bold text-white truncate max-w-[150px] font-sans">
              {data.title}
            </span>
            <span className="text-[10px] text-slate-400 truncate max-w-[150px] font-mono">
              {data.artist}
            </span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            disabled={isControlling}
            onClick={() => handleControl("previous")}
            className="h-7 w-7 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Previous Track"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            disabled={isControlling}
            onClick={() => handleControl(data.isPlaying ? "pause" : "play")}
            className="h-8 w-8 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-md shadow-[#1DB954]/20 cursor-pointer font-bold"
            title={data.isPlaying ? "Pause" : "Play"}
          >
            {data.isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-black" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            disabled={isControlling}
            onClick={() => handleControl("next")}
            className="h-7 w-7 rounded-full text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
            title="Next Track"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
