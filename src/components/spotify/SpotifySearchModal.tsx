"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import {
  Search,
  Play,
  Pause,
  SkipForward,
  Shuffle,
  Music,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  Disc,
  CheckCircle2,
  Plus,
  ListMusic,
  Heart,
  Sparkles,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  albumUri?: string;
  imageUrl: string;
  uri: string;
  durationMs: number;
  externalUrl?: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  trackCount: number;
  uri: string;
  ownerName: string;
  externalUrl?: string;
}

interface NowPlayingState {
  isConnected: boolean;
  isPlaying: boolean;
  title?: string;
  artist?: string;
  album?: string;
  albumImageUrl?: string;
  songUrl?: string;
  progress_ms?: number;
  duration_ms?: number;
}

type ViewMode = "search" | "playlists" | "playlist-detail" | "liked-songs" | "queue";

function formatDuration(ms?: number): string {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const ITEM_HEIGHT = 52; // Fixed row height (px) for virtual scroll calculation
const OVERSCAN = 6; // Number of buffer rows rendered above & below viewport

interface VirtualTrackRowProps {
  track: SpotifyTrack;
  idx: number;
  isSelected: boolean;
  selectedActionIndex: number;
  isThisPlaying: boolean;
  isQueueing: boolean;
  isAIMixing: boolean;
  isActionPending: boolean;
  onSelect: (idx: number) => void;
  onPlayTrack: (track: SpotifyTrack, idx: number) => void;
  onPlayAIMix: (track: SpotifyTrack, e: React.MouseEvent) => void;
  onAddToQueue: (track: SpotifyTrack, e: React.MouseEvent) => void;
}

// Highly optimized memoized track row: only re-renders when its own focus or playback state changes!
const VirtualTrackRow = React.memo(function VirtualTrackRow({
  track,
  idx,
  isSelected,
  selectedActionIndex,
  isThisPlaying,
  isQueueing,
  isAIMixing,
  isActionPending,
  onSelect,
  onPlayTrack,
  onPlayAIMix,
  onAddToQueue,
}: VirtualTrackRowProps) {
  return (
    <div
      onMouseEnter={() => onSelect(idx)}
      onClick={() => onPlayTrack(track, idx)}
      className={cn(
        "h-11 flex items-center justify-between px-3 py-1 rounded-2xl cursor-pointer transition-all text-xs font-mono group border",
        isSelected
          ? "bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10"
          : "hover:bg-white/5 text-slate-300 border-transparent"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="w-4 text-[10px] text-slate-500 font-mono text-center shrink-0">
          {idx + 1}
        </span>

        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 relative shrink-0">
          {track.imageUrl ? (
            <img
              src={track.imageUrl}
              alt={track.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-600">
              <Music className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span
            className={cn(
              "font-bold truncate text-slate-100 transition-colors",
              isSelected ? "text-emerald-300" : "group-hover:text-white"
            )}
          >
            {track.name}
          </span>
          <span className="text-[10px] text-slate-400 font-sans truncate">
            {track.artists}
            {track.albumName && ` • ${track.albumName}`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline mr-1">
          {formatDuration(track.durationMs)}
        </span>

        {/* Option 0: AI Radio Mix */}
        <Button
          size="sm"
          variant="ghost"
          disabled={isAIMixing || isActionPending}
          onClick={(e) => onPlayAIMix(track, e)}
          className={cn(
            "h-6 px-1.5 rounded-lg border text-[10px] font-mono gap-1 cursor-pointer transition-all",
            isSelected && selectedActionIndex === 0
              ? "bg-purple-500 text-white font-bold border-purple-300 ring-2 ring-purple-400 shadow-md shadow-purple-500/30 scale-105"
              : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border-purple-500/30"
          )}
          title="Play AI Radio Mix (Arrow Left/Right to focus, Enter to play)"
        >
          {isAIMixing ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin text-purple-400" />
          ) : (
            <>
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              <span className="hidden md:inline">AI Mix</span>
            </>
          )}
        </Button>

        {/* Option 1: Add to Queue */}
        <Button
          size="sm"
          variant="ghost"
          disabled={isQueueing || isActionPending}
          onClick={(e) => onAddToQueue(track, e)}
          className={cn(
            "h-6 px-1.5 rounded-lg border text-[10px] font-mono gap-1 cursor-pointer transition-all",
            isSelected && selectedActionIndex === 1
              ? "bg-emerald-500 text-slate-950 font-bold border-emerald-300 ring-2 ring-emerald-400 shadow-md shadow-emerald-500/30 scale-105"
              : "bg-white/[0.04] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border-white/10 hover:border-emerald-500/40"
          )}
          title="Add to Spotify Queue"
        >
          {isQueueing ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400" />
          ) : (
            <>
              <Plus className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Queue</span>
            </>
          )}
        </Button>

        {/* Option 2: Play */}
        <Button
          size="sm"
          variant="ghost"
          disabled={isThisPlaying || isActionPending}
          onClick={(e) => {
            e.stopPropagation();
            onPlayTrack(track, idx);
          }}
          className={cn(
            "h-6 px-2 rounded-lg border transition-all text-[11px] font-mono gap-1 cursor-pointer",
            isSelected && selectedActionIndex === 2
              ? "bg-emerald-400 text-slate-950 font-bold border-emerald-300 ring-2 ring-emerald-300 shadow-md shadow-emerald-400/40 scale-105"
              : isSelected
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              : "bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border-emerald-500/30"
          )}
        >
          {isThisPlaying ? (
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          ) : (
            <Play className="w-2.5 h-2.5 fill-current" />
          )}
        </Button>
      </div>
    </div>
  );
});

export function SpotifySearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(2); // 0: AI Mix, 1: Queue, 2: Play (default)
  const [isSearching, setIsSearching] = useState(false);
  const [playingTrackUri, setPlayingTrackUri] = useState<string | null>(null);
  const [activeQueueingUri, setActiveQueueingUri] = useState<string | null>(null);
  const [activeAIMixUri, setActiveAIMixUri] = useState<string | null>(null);

  // Toast notifications with smooth enter/exit animations
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    isVisible: boolean;
  } | null>(null);
  const toastTimerRef = useRef<{ hide?: NodeJS.Timeout; remove?: NodeJS.Timeout }>({});

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current.hide) clearTimeout(toastTimerRef.current.hide);
    if (toastTimerRef.current.remove) clearTimeout(toastTimerRef.current.remove);

    setToast({ message, type, isVisible: false });

    requestAnimationFrame(() => {
      setToast({ message, type, isVisible: true });
    });

    toastTimerRef.current.hide = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, isVisible: false } : null));
    }, type === "error" ? 4000 : 2800);

    toastTimerRef.current.remove = setTimeout(() => {
      setToast(null);
    }, type === "error" ? 4400 : 3200);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimerRef.current.hide) clearTimeout(toastTimerRef.current.hide);
    if (toastTimerRef.current.remove) clearTimeout(toastTimerRef.current.remove);
    setToast((prev) => (prev ? { ...prev, isVisible: false } : null));
    toastTimerRef.current.remove = setTimeout(() => {
      setToast(null);
    }, 350);
  }, []);

  const setSuccessMessage = useCallback((msg: string | null) => {
    if (msg) showToast(msg, "success");
    else hideToast();
  }, [showToast, hideToast]);

  const setErrorMessage = useCallback((msg: string | null) => {
    if (msg) showToast(msg, "error");
    else hideToast();
  }, [showToast, hideToast]);

  const [isShuffleActive, setIsShuffleActive] = useState(false);

  // View navigation state
  const [viewMode, setViewMode] = useState<ViewMode>("playlists");

  // Playlists and Liked Songs state
  const [userPlaylists, setUserPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [likedTotalCount, setLikedTotalCount] = useState<number>(0);

  // Detail View State (Selected Playlist / Liked Tracks)
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [detailTracks, setDetailTracks] = useState<SpotifyTrack[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [detailTotalCount, setDetailTotalCount] = useState<number>(0);

  // Now playing state
  const [nowPlaying, setNowPlaying] = useState<NowPlayingState>({
    isConnected: false,
    isPlaying: false,
  });
  const [isActionPending, startTransition] = useTransition();

  // Live Queue State
  const [manualQueueTracks, setManualQueueTracks] = useState<SpotifyTrack[]>([]);
  const [nextUpTracks, setNextUpTracks] = useState<SpotifyTrack[]>([]);
  const [currentlyPlayingInQueue, setCurrentlyPlayingInQueue] = useState<SpotifyTrack | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [scrollTop, setScrollTop] = useState(0);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const abortSearchFetchRef = useRef<AbortController | null>(null);

  const handleTrackSelect = useCallback((idx: number) => {
    setSelectedIndex(idx);
  }, []);

  const isDetailView = viewMode === "playlist-detail" || viewMode === "liked-songs";

  const fetchLiveQueue = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoadingQueue(true);
    }
    try {
      const res = await fetch("/api/spotify/queue", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setManualQueueTracks(data.manualQueue || []);
        setNextUpTracks(data.nextUp || []);
        setCurrentlyPlayingInQueue(data.currentlyPlaying || null);
      }
    } catch (err) {
      console.warn("[SPOTIFY_FETCH_QUEUE_ERROR]", err);
    } finally {
      if (!silent) {
        setIsLoadingQueue(false);
      }
    }
  }, []);

  const handleOpenQueueView = () => {
    setViewMode("queue");
    setSelectedPlaylist(null);
    setSelectedIndex(0);
    setSelectedActionIndex(2);
    setSearchQuery("");
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    fetchLiveQueue();
    setTimeout(() => searchInputRef.current?.focus(), 60);
  };

  const handleClearQueue = async () => {
    setIsClearingQueue(true);
    try {
      const res = await fetch("/api/spotify/queue", { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Manual queue cleared successfully!");
        setManualQueueTracks([]);
        fetchLiveQueue(true);
      } else {
        setErrorMessage(data.error || data.message || "Failed to clear queue.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error while clearing queue.");
    } finally {
      setIsClearingQueue(false);
    }
  };

  // Background Deep Search: when searching in a playlist/liked-songs, automatically stream in remaining pages
  useEffect(() => {
    if (!isDetailView || !searchQuery.trim()) {
      if (abortSearchFetchRef.current) {
        abortSearchFetchRef.current.abort();
        abortSearchFetchRef.current = null;
      }
      setIsDeepSearching(false);
      return;
    }

    if (detailTracks.length >= detailTotalCount) {
      setIsDeepSearching(false);
      return;
    }

    const abortController = new AbortController();
    abortSearchFetchRef.current = abortController;
    setIsDeepSearching(true);

    let isCancelled = false;

    const fetchRemaining = async () => {
      let currentOffset = detailTracks.length;
      const targetTotal = detailTotalCount;

      while (currentOffset < targetTotal && !isCancelled && !abortController.signal.aborted) {
        try {
          let url = "";
          if (viewMode === "playlist-detail" && selectedPlaylist) {
            url = `/api/spotify/playlist-tracks?playlistId=${encodeURIComponent(selectedPlaylist.id)}&limit=50&offset=${currentOffset}`;
          } else if (viewMode === "liked-songs") {
            url = `/api/spotify/liked-tracks?limit=50&offset=${currentOffset}`;
          } else {
            break;
          }

          const res = await fetch(url, { signal: abortController.signal });
          const data = await res.json();
          if (isCancelled || abortController.signal.aborted) break;

          if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
            setDetailTracks((prev) => {
              const existingIds = new Set(prev.map((t) => t.id));
              const newTracks = data.tracks.filter((t: SpotifyTrack) => !existingIds.has(t.id));
              return [...prev, ...newTracks];
            });
            currentOffset += data.tracks.length;
            if (typeof data.total === "number") {
              setDetailTotalCount(data.total);
            }
          } else {
            break;
          }
        } catch (e: any) {
          if (e.name === "AbortError") break;
          console.warn("[SPOTIFY_DEEP_SEARCH_ERROR]", e);
          break;
        }
      }

      if (!isCancelled) {
        setIsDeepSearching(false);
      }
    };

    fetchRemaining();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [searchQuery, isDetailView, detailTotalCount, viewMode, selectedPlaylist?.id]);

  // In-Playlist / Liked Songs contextual filtering
  const filteredDetailTracks = React.useMemo(() => {
    if (!isDetailView || !searchQuery.trim()) return detailTracks;
    const q = searchQuery.toLowerCase().trim();
    return detailTracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artists.toLowerCase().includes(q) ||
        (t.albumName && t.albumName.toLowerCase().includes(q))
    );
  }, [isDetailView, searchQuery, detailTracks]);

  // Live Manual Queue contextual filtering
  const filteredManualQueueTracks = React.useMemo(() => {
    if (viewMode !== "queue") return [];
    if (!searchQuery.trim()) return manualQueueTracks;
    const q = searchQuery.toLowerCase().trim();
    return manualQueueTracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artists.toLowerCase().includes(q) ||
        (t.albumName && t.albumName.toLowerCase().includes(q))
    );
  }, [viewMode, searchQuery, manualQueueTracks]);

  // Live Next Up (Context stream) filtering
  const filteredNextUpTracks = React.useMemo(() => {
    if (viewMode !== "queue") return [];
    if (!searchQuery.trim()) return nextUpTracks;
    const q = searchQuery.toLowerCase().trim();
    return nextUpTracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artists.toLowerCase().includes(q) ||
        (t.albumName && t.albumName.toLowerCase().includes(q))
    );
  }, [viewMode, searchQuery, nextUpTracks]);

  // Combined tracks for queue keyboard navigation
  const allVisibleQueueTracks = React.useMemo(() => {
    return [...filteredManualQueueTracks, ...filteredNextUpTracks];
  }, [filteredManualQueueTracks, filteredNextUpTracks]);




  // Virtual Window Calculation for 120 FPS high-performance track list
  const totalTracks = filteredDetailTracks.length;
  const containerViewportHeight = 400; // approximate scroll viewport height

  const startIndex = isDetailView
    ? Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN)
    : 0;
  const endIndex = isDetailView
    ? Math.min(
        totalTracks - 1,
        Math.floor((scrollTop + containerViewportHeight) / ITEM_HEIGHT) + OVERSCAN
      )
    : totalTracks - 1;

  const topPadding = isDetailView && startIndex > 0 ? startIndex * ITEM_HEIGHT : 0;
  const bottomPadding =
    isDetailView && endIndex < totalTracks - 1
      ? Math.max(0, (totalTracks - 1 - endIndex) * ITEM_HEIGHT)
      : 0;
  const visibleDetailTracks = isDetailView
    ? filteredDetailTracks.slice(startIndex, endIndex + 1)
    : detailTracks;


  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ initialQuery?: string }>;
      setIsOpen(true);
      if (customEvent.detail?.initialQuery) {
        setSearchQuery(customEvent.detail.initialQuery);
        setViewMode("search");
      }
    };

    window.addEventListener("open-spotify-search", handleOpen);

    const onKey = (e: KeyboardEvent) => {
      const isAltS = e.altKey && e.key.toLowerCase() === "s";
      const isCtrlShiftS = (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s";

      if (isAltS || isCtrlShiftS) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("open-spotify-search", handleOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Fetch initial playlists and liked tracks count
  const fetchPlaylistsAndLiked = async () => {
    setIsLoadingPlaylists(true);
    try {
      const [playlistsRes, likedRes] = await Promise.all([
        fetch("/api/spotify/playlists", { cache: "no-store" }),
        fetch("/api/spotify/liked-tracks?limit=1&offset=0", { cache: "no-store" }),
      ]);

      const [playlistsData, likedData] = await Promise.all([
        playlistsRes.json().catch(() => ({})),
        likedRes.json().catch(() => ({})),
      ]);

      if (playlistsData.success && Array.isArray(playlistsData.playlists)) {
        setUserPlaylists(playlistsData.playlists);
      }
      if (likedData.success && typeof likedData.total === "number") {
        setLikedTotalCount(likedData.total);
      }
    } catch (e) {
      console.warn("[SPOTIFY_INITIAL_FETCH_ERROR]", e);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  // Focus input on modal open, fetch playlists, and reset on close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
      fetchPlaylistsAndLiked();
    } else {
      setSearchQuery("");
      setSearchResults([]);
      setViewMode("playlists");
      setSelectedPlaylist(null);
      setDetailTracks([]);
      setSelectedIndex(0);
      setSelectedActionIndex(2);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  // Poll now-playing status when modal is open
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const fetchNowPlaying = async () => {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        if (!res.ok) return;
        const data: NowPlayingState = await res.json();
        if (isMounted) {
          setNowPlaying(data);
          if (viewMode === "queue" && data.title && data.title !== currentlyPlayingInQueue?.name) {
            fetchLiveQueue(true);
          }
        }
      } catch (err) {
        // Silently ignore polling network errors
      }
    };

    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, viewMode, currentlyPlayingInQueue?.name, fetchLiveQueue]);

  // Debounced search effect: In-playlist filter is instant in-memory, while library search triggers Spotify API
  useEffect(() => {
    if (isDetailView) {
      // In-playlist filter is computed instantly in-memory, just reset index to top
      setSelectedIndex(0);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      if (viewMode === "search") {
        setViewMode("playlists");
      }
      setSelectedIndex(0);
      setSelectedActionIndex(2);
      return;
    }

    setViewMode("search");
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);
      try {
        const res = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(searchQuery.trim())}&limit=15`
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.tracks)) {
          setSearchResults(data.tracks);
          setSelectedIndex(0);
          setSelectedActionIndex(2);
        } else {
          setSearchResults([]);
          if (data.message && !data.message.includes("cancelled")) {
            setErrorMessage(data.message);
          }
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to search Spotify tracks.");
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isDetailView]);

  // Switch to Global Search explicitly from playlist detail view
  const handleSwitchToGlobalSearch = (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (!q) return;
    setViewMode("search");
    setIsSearching(true);
    setErrorMessage(null);
    setSelectedIndex(0);
    setSelectedActionIndex(2);

    fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=15`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tracks)) {
          setSearchResults(data.tracks);
        }
      })
      .catch((err) => setErrorMessage(err.message || "Failed to search Spotify."))
      .finally(() => setIsSearching(false));
  };


  // Scroll active item into view with virtualization awareness and bottom loading clearance
  useEffect(() => {
    if (!containerRef.current) return;

    if (selectedIndex === -1) {
      containerRef.current.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    if (viewMode === "playlist-detail" || viewMode === "liked-songs") {
      const headerOffset = 64; // height of detail header bar
      const itemTop = selectedIndex * ITEM_HEIGHT + headerOffset;
      const isAtOrNearEnd = selectedIndex >= detailTracks.length - 2;
      // Extra clearance when nearing the bottom so the loading banner is 100% visible and not cut in half
      const bottomClearance = isAtOrNearEnd ? 140 : 8;
      const itemBottom = itemTop + ITEM_HEIGHT + bottomClearance;
      const currentScroll = containerRef.current.scrollTop;
      const viewport = containerRef.current.clientHeight || 380;

      if (itemTop < currentScroll + headerOffset) {
        containerRef.current.scrollTo({
          top: Math.max(0, itemTop - headerOffset),
          behavior: "auto",
        });
      } else if (itemBottom > currentScroll + viewport) {
        containerRef.current.scrollTo({
          top: itemBottom - viewport,
          behavior: "auto",
        });
      }
    } else {
      const el = itemRefs.current.get(selectedIndex);
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [selectedIndex, viewMode, detailTracks.length, allVisibleQueueTracks.length]);

  // Ensure loading banner is smoothly in view when triggered near bottom
  useEffect(() => {
    if (
      isLoadingMore &&
      containerRef.current &&
      (viewMode === "playlist-detail" || viewMode === "liked-songs")
    ) {
      if (selectedIndex >= detailTracks.length - 3) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "auto",
        });
      }
    }
  }, [isLoadingMore, selectedIndex, viewMode, detailTracks.length]);


  // Open Playlist Detail View
  const handleOpenPlaylistDetail = async (playlist: SpotifyPlaylist) => {
    setSelectedPlaylist(playlist);
    setViewMode("playlist-detail");
    setIsLoadingDetail(true);
    setSelectedIndex(0);
    setSelectedActionIndex(2);
    setErrorMessage(null);
    setSearchQuery("");
    setDetailTotalCount(playlist.trackCount || 0);
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setTimeout(() => searchInputRef.current?.focus(), 60);

    try {
      const res = await fetch(
        `/api/spotify/playlist-tracks?playlistId=${encodeURIComponent(playlist.id)}&limit=50&offset=0`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks)) {
        setDetailTracks(data.tracks);
        if (typeof data.total === "number") setDetailTotalCount(data.total);
      } else {
        setErrorMessage(data.error || "Failed to load playlist tracks.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Error loading playlist tracks.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Open Liked Songs Detail View
  const handleOpenLikedSongsDetail = async () => {
    setSelectedPlaylist(null);
    setViewMode("liked-songs");
    setIsLoadingDetail(true);
    setSelectedIndex(0);
    setSelectedActionIndex(2);
    setErrorMessage(null);
    setSearchQuery("");
    setDetailTotalCount(likedTotalCount || 0);
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setTimeout(() => searchInputRef.current?.focus(), 60);

    try {
      const res = await fetch("/api/spotify/liked-tracks?limit=50&offset=0");
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks)) {
        setDetailTracks(data.tracks);
        const total = typeof data.total === "number" ? data.total : data.tracks.length;
        setDetailTotalCount(total);
        setLikedTotalCount(total);
      } else {
        setErrorMessage(data.error || "Failed to load liked songs.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Error loading liked songs.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Infinite Scroll: Load More Detail Tracks when reaching bottom (with smooth minimum duration buffer)
  const loadMoreDetailTracks = async () => {
    if (isLoadingMore || isLoadingDetail) return;
    if (detailTracks.length >= detailTotalCount) return;

    setIsLoadingMore(true);
    const minDisplayDelay = new Promise((resolve) => setTimeout(resolve, 350));

    try {
      if (viewMode === "playlist-detail" && selectedPlaylist) {
        const [res] = await Promise.all([
          fetch(
            `/api/spotify/playlist-tracks?playlistId=${encodeURIComponent(selectedPlaylist.id)}&limit=50&offset=${detailTracks.length}`
          ),
          minDisplayDelay,
        ]);
        const data = await res.json();
        if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setDetailTracks((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTracks = data.tracks.filter((t: SpotifyTrack) => !existingIds.has(t.id));
            return [...prev, ...newTracks];
          });
          if (typeof data.total === "number") {
            setDetailTotalCount(data.total);
            setSelectedPlaylist((prev) =>
              prev ? { ...prev, trackCount: data.total } : null
            );
          }
        }
      } else if (viewMode === "liked-songs") {
        const [res] = await Promise.all([
          fetch(`/api/spotify/liked-tracks?limit=50&offset=${detailTracks.length}`),
          minDisplayDelay,
        ]);
        const data = await res.json();
        if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setDetailTracks((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTracks = data.tracks.filter((t: SpotifyTrack) => !existingIds.has(t.id));
            return [...prev, ...newTracks];
          });
          if (typeof data.total === "number") {
            setDetailTotalCount(data.total);
            setLikedTotalCount(data.total);
          }
        }
      }
    } catch (e: any) {
      console.warn("[SPOTIFY_LOAD_MORE_ERROR]", e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Scroll event listener for virtualization and infinite scrolling
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop: newScrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setScrollTop(newScrollTop);

    if (scrollHeight - (newScrollTop + clientHeight) < 250) {
      if (
        !isLoadingDetail &&
        !isLoadingMore &&
        detailTracks.length < detailTotalCount
      ) {
        loadMoreDetailTracks();
      }
    }
  };

  // Return to playlists list
  const handleGoBack = () => {
    setViewMode("playlists");
    setSelectedPlaylist(null);
    setDetailTracks([]);
    setSelectedIndex(0);
    setSelectedActionIndex(2);
    setSearchQuery("");
    setScrollTop(0);
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    setTimeout(() => searchInputRef.current?.focus(), 60);
  };

  // Handle Play Track:
  // - In Playlist Detail: Uses native context_uri with offset so Spotify's queue contains the ENTIRE playlist in order!
  // - In Liked Songs: Finds track in master detailTracks list and queues all subsequent liked songs in order!
  // - In Search: Plays track with 30 continuous AI smart recommendations
  const handlePlayTrack = (track: SpotifyTrack, trackIndex?: number) => {
    setPlayingTrackUri(track.uri);
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        let bodyPayload: any = {};

        if (viewMode === "playlist-detail" && selectedPlaylist) {
          // Native playlist context playback: Spotify manages the full playlist queue starting at this track
          bodyPayload = {
            contextUri: selectedPlaylist.uri,
            trackUri: track.uri,
            shuffle: false,
          };
        } else if (viewMode === "liked-songs" && detailTracks.length > 0) {
          // Liked songs: locate track in the master detailTracks list to preserve the full sequence
          const actualIndex = detailTracks.findIndex(
            (t) => t.id === track.id || t.uri === track.uri
          );

          const uris =
            actualIndex >= 0
              ? detailTracks.slice(actualIndex).map((t) => t.uri)
              : [track.uri, ...detailTracks.map((t) => t.uri).filter((u) => u !== track.uri)];

          bodyPayload = {
            uris,
            shuffle: false,
          };
        } else {
          // Search mode: play single track with smart auto-recommendations
          bodyPayload = {
            trackUri: track.uri,
            shuffle: false,
          };
        }

        const res = await fetch("/api/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setIsShuffleActive(false);
          setSuccessMessage(`Playing "${track.name}"`);
          setNowPlaying((prev) => ({
            ...prev,
            isPlaying: true,
            title: track.name,
            artist: track.artists,
            album: track.albumName,
            albumImageUrl: track.imageUrl,
            duration_ms: track.durationMs,
            songUrl: track.externalUrl,
          }));
          setCurrentlyPlayingInQueue(track);
          if (viewMode === "queue") {
            setManualQueueTracks((prev) => prev.filter((t) => t.uri !== track.uri));
            setNextUpTracks((prev) => prev.filter((t) => t.uri !== track.uri));
            setTimeout(() => {
              fetchLiveQueue(true);
            }, 600);
          }
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setErrorMessage(
            data.message ||
              "No active Spotify device found. Please open Spotify on your phone or desktop first."
          );
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Network error while triggering playback.");
      } finally {
        setPlayingTrackUri(null);
      }
    });
  };

  // Handle Play AI Smart Mix (Personalized AI Radio of 30 smart recommendations)
  const handlePlayAIMix = (track: SpotifyTrack, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveAIMixUri(track.uri);
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackUri: track.uri,
            shuffle: false,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setIsShuffleActive(false);
          setSuccessMessage(`AI Radio Mix: "${track.name}"`);
          setNowPlaying((prev) => ({
            ...prev,
            isPlaying: true,
            title: track.name,
            artist: track.artists,
            album: track.albumName,
            albumImageUrl: track.imageUrl,
            duration_ms: track.durationMs,
            songUrl: track.externalUrl,
          }));
          setCurrentlyPlayingInQueue(track);
          if (viewMode === "queue") {
            setTimeout(() => {
              fetchLiveQueue(true);
            }, 600);
          }
          setTimeout(() => setSuccessMessage(null), 3500);
        } else {
          setErrorMessage(data.message || "No active Spotify device found.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to start AI Radio Mix.");
      } finally {
        setActiveAIMixUri(null);
      }
    });
  };

  // Handle Play Entire Playlist / Liked Songs List (uses filteredDetailTracks if search filter is active)
  const handlePlayAll = (shuffle = false) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        let bodyPayload: any = {};

        if (filteredDetailTracks.length > 0) {
          let trackUris = filteredDetailTracks.map((t) => t.uri);
          if (shuffle) {
            trackUris = [...trackUris].sort(() => Math.random() - 0.5);
          }
          bodyPayload = {
            uris: trackUris,
            shuffle: shuffle,
          };
        } else if (viewMode === "playlist-detail" && selectedPlaylist) {
          bodyPayload = {
            contextUri: selectedPlaylist.uri,
            shuffle: shuffle,
          };
        }

        const res = await fetch("/api/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setIsShuffleActive(shuffle);
          const name =
            viewMode === "liked-songs"
              ? "Liked Songs"
              : selectedPlaylist?.name || "Playlist";
          setSuccessMessage(
            shuffle ? `Shuffling "${name}"` : `Playing all "${name}"`
          );
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setErrorMessage(
            data.message || "No active Spotify device found. Please open Spotify first."
          );
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to start playback.");
      }
    });
  };

  // Handle Play Playlist directly from list item
  const handlePlayPlaylistDirect = (
    playlist: SpotifyPlaylist,
    shuffle = false,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/spotify/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextUri: playlist.uri,
            shuffle: shuffle,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setIsShuffleActive(shuffle);
          setSuccessMessage(
            shuffle
              ? `Shuffling "${playlist.name}"`
              : `Playing "${playlist.name}"`
          );
          setNowPlaying((prev) => ({
            ...prev,
            isPlaying: true,
            album: playlist.name,
            albumImageUrl: playlist.imageUrl,
          }));
          setTimeout(() => setSuccessMessage(null), 3000);
        } else {
          setErrorMessage(
            data.message || "No active Spotify device found. Please open Spotify first."
          );
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to play playlist.");
      }
    });
  };

  // Handle Add to Spotify Queue
  const handleAddToQueue = (track: SpotifyTrack, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveQueueingUri(track.uri);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/spotify/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackUri: track.uri }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setSuccessMessage(`Added "${track.name}" to Queue`);
          // Optimistic update: append to manual queue immediately so UI reflects the action
          setManualQueueTracks((prev) => {
            // Avoid duplicates
            if (prev.some((t) => t.uri === track.uri)) return prev;
            return [...prev, track];
          });
          // Always schedule a background refetch to get the real Spotify queue state
          setTimeout(() => {
            fetchLiveQueue(true);
          }, 800);
        } else {
          setErrorMessage(data.message || "Failed to add track to Spotify queue.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Network error while queueing track.");
      } finally {
        setActiveQueueingUri(null);
      }
    });
  };


  // Keyboard navigation controller with row, header, and action selection
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // '/' shortcut: Focus Search input instantly when not typing inside input
    if (e.key === "/" && document.activeElement !== searchInputRef.current) {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    // Alt+Q or Ctrl+Q shortcut: Toggle Live Queue view from anywhere (even when focused in search input)
    if ((e.altKey || e.ctrlKey) && (e.key === "q" || e.key === "Q" || e.code === "KeyQ")) {
      e.preventDefault();
      if (viewMode === "queue") {
        handleGoBack();
      } else {
        handleOpenQueueView();
      }
      return;
    }

    // Ctrl+Enter or Cmd+Enter or Alt+Enter: Instant keyboard shortcut to switch to Global Spotify Search
    if ((e.ctrlKey || e.metaKey || e.altKey) && e.key === "Enter") {
      e.preventDefault();
      if (searchQuery.trim()) {
        handleSwitchToGlobalSearch();
      } else {
        setViewMode("search");
        setSelectedIndex(0);
        setSelectedActionIndex(2);
      }
      return;
    }

    // Backspace to return to playlists if input is empty and in detail or queue view
    if (
      e.key === "Backspace" &&
      !searchQuery &&
      (viewMode === "playlist-detail" || viewMode === "liked-songs" || viewMode === "queue")
    ) {
      e.preventDefault();
      handleGoBack();
      return;
    }

    if (viewMode === "search") {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedActionIndex((prev) => (prev - 1 + 3) % 3);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedActionIndex((prev) => (prev + 1) % 3);
        return;
      }
      if (searchResults.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < searchResults.length - 1) {
          setSelectedIndex((prev) => prev + 1);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const track = searchResults[selectedIndex];
        if (track) {
          if (selectedActionIndex === 0) handlePlayAIMix(track);
          else if (selectedActionIndex === 1) handleAddToQueue(track);
          else handlePlayTrack(track);
        }
      }
    } else if (viewMode === "playlists") {
      const totalItems = 1 + userPlaylists.length; // Index 0 = Liked Songs, Index 1..N = Playlists
      if (totalItems === 0) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedActionIndex((prev) => (prev - 1 + 3) % 3);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedActionIndex((prev) => (prev + 1) % 3);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < totalItems - 1) {
          setSelectedIndex((prev) => prev + 1);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex === 0) {
          handleOpenLikedSongsDetail();
        } else {
          const pl = userPlaylists[selectedIndex - 1];
          if (pl) {
            if (selectedActionIndex === 0) handlePlayPlaylistDirect(pl, true);
            else if (selectedActionIndex === 1) handlePlayPlaylistDirect(pl, false);
            else handleOpenPlaylistDetail(pl);
          }
        }
      }
    } else if (viewMode === "playlist-detail" || viewMode === "liked-songs") {
      // Horizontal Arrow keys: select action
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (selectedIndex === -1) {
          setSelectedActionIndex(0); // Shuffle
        } else {
          setSelectedActionIndex((prev) => (prev - 1 + 3) % 3);
        }
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (selectedIndex === -1) {
          setSelectedActionIndex(1); // Play All
        } else {
          setSelectedActionIndex((prev) => (prev + 1) % 3);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex === -1) {
          // From Header down to First Track
          if (filteredDetailTracks.length > 0) {
            setSelectedIndex(0);
            setSelectedActionIndex(2); // Default to Play
          }
        } else if (selectedIndex < filteredDetailTracks.length - 1) {
          const nextIndex = selectedIndex + 1;
          setSelectedIndex(nextIndex);
          // Pre-fetch next page when 5 tracks away from bottom (only if not filtering)
          if (
            !searchQuery.trim() &&
            nextIndex >= filteredDetailTracks.length - 6 &&
            !isLoadingMore &&
            detailTracks.length < detailTotalCount
          ) {
            loadMoreDetailTracks();
          }
        } else if (!searchQuery.trim() && !isLoadingMore && detailTracks.length < detailTotalCount) {
          loadMoreDetailTracks();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1);
        } else if (selectedIndex === 0) {
          // Move up to Playlist Header Action Bar!
          setSelectedIndex(-1);
          setSelectedActionIndex(0); // Default focus on Shuffle
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredDetailTracks.length === 0 && searchQuery.trim()) {
          // If no matching tracks found in this playlist, pressing Enter triggers Global Search immediately!
          handleSwitchToGlobalSearch();
          return;
        }

        if (selectedIndex === -1) {
          // Header action: 0 = Shuffle, 1 = Play All
          if (selectedActionIndex === 0) {
            handlePlayAll(true);
          } else {
            handlePlayAll(false);
          }
        } else {
          const track = filteredDetailTracks[selectedIndex];
          if (track) {
            if (selectedActionIndex === 0) handlePlayAIMix(track);
            else if (selectedActionIndex === 1) handleAddToQueue(track);
            else handlePlayTrack(track, selectedIndex);
          }
        }
      }
    } else if (viewMode === "queue") {
      const tracksToNavigate = allVisibleQueueTracks;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < tracksToNavigate.length - 1) {
          setSelectedIndex((prev) => prev + 1);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1);
        }
      }
    }
  };


  // Player controls
  const handleTogglePlayPause = () => {
    const action = nowPlaying.isPlaying ? "pause" : "play";
    startTransition(async () => {
      try {
        const res = await fetch("/api/spotify/controls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (data.success) {
          setNowPlaying((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
        } else {
          setErrorMessage(data.message || "Could not toggle playback.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to control playback.");
      }
    });
  };

  const handleNextTrack = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/spotify/next", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setSuccessMessage("Skipped to next track.");
          if (viewMode === "queue") {
            setTimeout(() => {
              fetchLiveQueue(true);
            }, 600);
          }
          setTimeout(() => setSuccessMessage(null), 2500);
        } else {
          setErrorMessage(data.message || "Could not skip track.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to skip track.");
      }
    });
  };

  const handleToggleShuffle = () => {
    const nextState = !isShuffleActive;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/spotify/shuffle?state=${nextState}`, { method: "PUT" });
        const data = await res.json();
        if (data.success) {
          setIsShuffleActive(nextState);
          setSuccessMessage(`Shuffle mode ${nextState ? "ON" : "OFF"}`);
          setTimeout(() => setSuccessMessage(null), 2500);
        } else {
          setErrorMessage(data.message || "Could not toggle shuffle.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to toggle shuffle.");
      }
    });
  };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        showCloseButton={false}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent border-none ring-0 shadow-none text-slate-100 max-w-2xl w-[92vw] h-[580px] max-h-[85vh] p-0 flex flex-col overflow-visible font-mono focus-visible:outline-none"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Spotify Music Search &amp; Playback Command</DialogTitle>

        {/* Floating Top Island Toast (Emerges gracefully from behind the modal top & slides back in on exit) */}
        {toast && (
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl backdrop-blur-2xl shadow-2xl text-xs font-mono font-semibold flex items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              toast.type === "success"
                ? "bg-emerald-950/95 border border-emerald-500/50 shadow-emerald-500/25 text-emerald-300 pointer-events-none"
                : "bg-rose-950/95 border border-rose-500/50 shadow-rose-500/25 text-rose-200 pointer-events-auto",
              toast.isVisible
                ? "-top-12 translate-y-0 opacity-100 scale-100"
                : "-top-4 translate-y-6 opacity-0 scale-90"
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="truncate max-w-[70vw] sm:max-w-md">{toast.message}</span>
            {toast.type === "error" && (
              <button
                onClick={hideToast}
                className="p-0.5 text-rose-300 hover:text-white rounded-lg cursor-pointer ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Main Modal Box Container */}
        <div className="w-full h-full rounded-3xl bg-[#0a0a12]/90 border border-white/10 shadow-2xl backdrop-blur-3xl flex flex-col overflow-hidden">
          {/* Search Header Input */}
          <div className="p-3.5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02] shrink-0">
            {viewMode === "playlist-detail" || viewMode === "liked-songs" || viewMode === "queue" ? (
              <button
                onClick={handleGoBack}
                className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Back to Playlists (Backspace)"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Music className="w-4 h-4 text-emerald-400" />
              </div>
            )}

            {/* Scope Context Badge */}
            {viewMode === "liked-songs" ? (
              <Badge
                variant="outline"
                className="bg-purple-500/15 border-purple-500/30 text-purple-300 text-[10px] font-mono px-2 py-0.5 shrink-0 hidden sm:inline-flex"
              >
                Liked Songs Filter
              </Badge>
            ) : viewMode === "playlist-detail" ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/15 border-emerald-500/30 text-emerald-300 text-[10px] font-mono px-2 py-0.5 shrink-0 hidden sm:inline-flex"
              >
                Playlist Filter
              </Badge>
            ) : viewMode === "queue" ? (
              <Badge
                variant="outline"
                className="bg-indigo-500/15 border-indigo-500/30 text-indigo-300 text-[10px] font-mono px-2 py-0.5 shrink-0 hidden sm:inline-flex"
              >
                Live Queue
              </Badge>
            ) : null}

            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                viewMode === "liked-songs"
                  ? "Filter Liked Songs (title, artist, album)..."
                  : viewMode === "playlist-detail"
                  ? `Filter in "${selectedPlaylist?.name || "playlist"}"...`
                  : viewMode === "queue"
                  ? "Filter tracks in live queue..."
                  : "Search tracks, artists, albums on Spotify..."
              }
              className="bg-transparent border-none text-sm text-white placeholder:text-slate-500 focus-visible:ring-0 p-1.5 h-auto font-mono flex-1 shadow-none"
            />

            {isSearching && (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
            )}

            {/* Quick Action: Open Live Queue (Alt+Q) */}
            {viewMode !== "queue" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleOpenQueueView}
                className="h-6 px-2 text-[10px] font-mono text-slate-300 hover:text-indigo-300 bg-white/5 hover:bg-indigo-500/15 border border-white/10 rounded-lg shrink-0 gap-1.5 cursor-pointer transition-colors"
                title="View Live Playback Queue (Alt+Q)"
              >
                <ListMusic className="w-2.5 h-2.5 text-indigo-400" />
                <span className="hidden md:inline">Queue</span>
                <kbd className="px-1 py-0.2 bg-black/40 border border-white/15 rounded text-[8px] text-slate-400 font-mono">
                  Alt+Q
                </kbd>
              </Button>
            )}

            {/* Quick Action: Search Globally from Playlist Filter (Ctrl+Enter) */}
            {isDetailView && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSwitchToGlobalSearch()}
                className="h-6 px-2 text-[10px] font-mono text-slate-300 hover:text-emerald-300 bg-white/5 hover:bg-emerald-500/15 border border-white/10 rounded-lg shrink-0 gap-1.5 cursor-pointer transition-colors"
                title="Search across all of Spotify (Ctrl+Enter)"
              >
                <Search className="w-2.5 h-2.5" />
                <span className="hidden md:inline">Global Search</span>
                <kbd className="px-1 py-0.2 bg-black/40 border border-white/15 rounded text-[8px] text-slate-400 font-mono">
                  Ctrl+↵
                </kbd>
              </Button>
            )}

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <Badge
              variant="outline"
              className="border-white/15 text-slate-400 text-[10px] px-2 py-1 shrink-0 hidden sm:inline-flex font-mono"
            >
              ESC to close
            </Badge>
          </div>

        {/* Modal Main Body with High-Performance Virtual Scroll */}
        <div
          ref={containerRef}
          onScroll={handleContainerScroll}
          className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin min-h-0"
        >
          {/* 1. SEARCH RESULTS VIEW */}
          {viewMode === "search" && (
            searchResults.length > 0 ? (
              searchResults.map((track, idx) => {
                const isSelected = selectedIndex === idx;
                const isThisPlaying = playingTrackUri === track.uri;
                const isQueueing = activeQueueingUri === track.uri;
                const isAIMixing = activeAIMixUri === track.uri;

                return (
                  <div
                    key={track.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(idx, el);
                      else itemRefs.current.delete(idx);
                    }}
                    onMouseEnter={() => {
                      setSelectedIndex(idx);
                    }}
                    onClick={() => handlePlayTrack(track)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-2xl cursor-pointer transition-all text-xs font-mono group border",
                      isSelected
                        ? "bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10"
                        : "hover:bg-white/5 text-slate-300 border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/5 border border-white/10 relative shrink-0">
                        {track.imageUrl ? (
                          <img
                            src={track.imageUrl}
                            alt={track.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                        >
                          {isThisPlaying ? (
                            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span
                          className={cn(
                            "font-bold truncate text-slate-100 transition-colors",
                            isSelected ? "text-emerald-300" : "group-hover:text-white"
                          )}
                        >
                          {track.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans truncate">
                          {track.artists}
                          {track.albumName && (
                            <span className="text-slate-500"> • {track.albumName}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline mr-1">
                        {formatDuration(track.durationMs)}
                      </span>

                      {/* Option 0: AI Radio Mix Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isAIMixing || isActionPending}
                        onClick={(e) => handlePlayAIMix(track, e)}
                        className={cn(
                          "h-7 px-2 rounded-xl border text-[11px] font-mono gap-1 cursor-pointer transition-all",
                          isSelected && selectedActionIndex === 0
                            ? "bg-purple-500 text-white font-bold border-purple-300 ring-2 ring-purple-400 shadow-md shadow-purple-500/30 scale-105"
                            : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border-purple-500/30"
                        )}
                        title="AI Radio Mix (Arrow Left/Right to focus, Enter to play)"
                      >
                        {isAIMixing ? (
                          <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span className="hidden md:inline">AI Mix</span>
                          </>
                        )}
                      </Button>

                      {/* Option 1: Add to Queue Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isQueueing || isActionPending}
                        onClick={(e) => handleAddToQueue(track, e)}
                        className={cn(
                          "h-7 px-2 rounded-xl border text-[11px] font-mono gap-1 cursor-pointer transition-all",
                          isSelected && selectedActionIndex === 1
                            ? "bg-emerald-500 text-slate-950 font-bold border-emerald-300 ring-2 ring-emerald-400 shadow-md shadow-emerald-500/30 scale-105"
                            : "bg-white/[0.04] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border-white/10 hover:border-emerald-500/40"
                        )}
                        title="Add to Spotify Queue"
                      >
                        {isQueueing ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span className="hidden sm:inline">Queue</span>
                          </>
                        )}
                      </Button>

                      {/* Option 2: Play Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isThisPlaying || isActionPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayTrack(track);
                        }}
                        className={cn(
                          "h-7 px-2.5 rounded-xl border transition-all text-xs font-mono gap-1 cursor-pointer",
                          isSelected && selectedActionIndex === 2
                            ? "bg-emerald-400 text-slate-950 font-bold border-emerald-300 ring-2 ring-emerald-300 shadow-lg shadow-emerald-400/40 scale-105"
                            : isSelected
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border-emerald-500/30"
                        )}
                      >
                        {isThisPlaying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Play</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : !isSearching ? (
              <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-1">
                <Search className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                <p>No tracks found matching &quot;{searchQuery}&quot;</p>
                <p className="text-[10px] text-slate-600 font-sans">
                  Try searching by song title, artist, or album name
                </p>
              </div>
            ) : null
          )}

          {/* 2. PLAYLISTS LIST VIEW (Default Empty State) */}
          {viewMode === "playlists" && (
            <div className="space-y-1.5 p-1">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                    Your Library &amp; Playlists
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {userPlaylists.length + (likedTotalCount > 0 ? 1 : 0)} Total
                </span>
              </div>

              {/* Liked Songs Special Item (Index 0) */}
              <div
                ref={(el) => {
                  if (el) itemRefs.current.set(0, el);
                  else itemRefs.current.delete(0);
                }}
                onMouseEnter={() => {
                  setSelectedIndex(0);
                }}
                onClick={handleOpenLikedSongsDetail}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border group",
                  selectedIndex === 0
                    ? "bg-purple-500/20 border-purple-500/50 text-white shadow-lg shadow-purple-500/10"
                    : "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 text-slate-300"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shrink-0">
                    <Heart className="w-5 h-5 fill-white text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors font-mono truncate">
                        Liked Songs (Lagu yang Disukai)
                      </p>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px] px-1.5 py-0">
                        Library
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans truncate">
                      {likedTotalCount} saved tracks • Auto library
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLikedSongsDetail();
                    }}
                    className={cn(
                      "h-7 px-2.5 rounded-xl border text-xs font-mono transition-all",
                      selectedIndex === 0
                        ? "bg-purple-500 text-white font-bold border-purple-400 shadow-md shadow-purple-500/20 scale-105"
                        : "bg-white/[0.04] hover:bg-white/10 text-slate-300 hover:text-white border-white/10"
                    )}
                  >
                    Open
                  </Button>
                </div>
              </div>

              {/* Playlists List Items (Index 1..N) */}
              {isLoadingPlaylists ? (
                <div className="space-y-2 pt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 rounded-2xl bg-white/[0.02] animate-pulse border border-white/5"
                    />
                  ))}
                </div>
              ) : (
                userPlaylists.map((pl, plIdx) => {
                  const globalIdx = plIdx + 1;
                  const isSelected = selectedIndex === globalIdx;

                  return (
                    <div
                      key={pl.id}
                      ref={(el) => {
                        if (el) itemRefs.current.set(globalIdx, el);
                        else itemRefs.current.delete(globalIdx);
                      }}
                      onMouseEnter={() => {
                        setSelectedIndex(globalIdx);
                      }}
                      onClick={() => handleOpenPlaylistDetail(pl)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border group",
                        isSelected
                          ? "bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10"
                          : "bg-white/[0.02] hover:bg-white/[0.05] border-white/5 text-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0 relative">
                          {pl.imageUrl ? (
                            <img
                              src={pl.imageUrl}
                              alt={pl.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              <ListMusic className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors font-mono truncate">
                            {pl.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-sans truncate">
                            {pl.trackCount} tracks • {pl.ownerName}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Shuffle Play direct (Action 0) */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handlePlayPlaylistDirect(pl, true, e)}
                          className={cn(
                            "w-7 h-7 rounded-xl border transition-all",
                            isSelected && selectedActionIndex === 0
                              ? "bg-purple-500 text-white font-bold border-purple-300 ring-2 ring-purple-400 shadow-md shadow-purple-500/30 scale-105"
                              : "bg-white/[0.04] hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 border-white/10 hover:border-emerald-500/40"
                          )}
                          title={`Shuffle ${pl.name}`}
                        >
                          <Shuffle className="w-3 h-3" />
                        </Button>

                        {/* Play all direct (Action 1) */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handlePlayPlaylistDirect(pl, false, e)}
                          className={cn(
                            "w-7 h-7 rounded-xl border transition-all",
                            isSelected && selectedActionIndex === 1
                              ? "bg-emerald-400 text-slate-950 font-bold border-emerald-300 ring-2 ring-emerald-300 shadow-md shadow-emerald-400/40 scale-105"
                              : "bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border-emerald-500/30"
                          )}
                          title={`Play all ${pl.name}`}
                        >
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        </Button>

                        {/* Open Playlist button (Action 2) */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPlaylistDetail(pl);
                          }}
                          className={cn(
                            "h-7 px-2 rounded-xl border text-[11px] font-mono transition-all hidden sm:inline-flex",
                            isSelected && selectedActionIndex === 2
                              ? "bg-white/20 text-white font-bold border-white/40 ring-2 ring-white/30 scale-105"
                              : "bg-white/[0.03] text-slate-400 hover:text-white border-white/10"
                          )}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. PLAYLIST / LIKED SONGS DETAIL VIEW */}
          {(viewMode === "playlist-detail" || viewMode === "liked-songs") && (
            <div className="space-y-2">
              {/* Detail Header Summary Bar (Focusable with ArrowUp to index -1) */}
              <div
                ref={(el) => {
                  if (el) itemRefs.current.set(-1, el);
                  else itemRefs.current.delete(-1);
                }}
                onClick={() => {
                  setSelectedIndex(-1);
                }}
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer",
                  selectedIndex === -1
                    ? "bg-white/[0.07] border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                    : "bg-white/[0.03] border-white/10"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {viewMode === "liked-songs" ? (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0 shadow-lg">
                      <Heart className="w-5 h-5 fill-white" />
                    </div>
                  ) : selectedPlaylist?.imageUrl ? (
                    <img
                      src={selectedPlaylist.imageUrl}
                      alt={selectedPlaylist.name}
                      className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                      <ListMusic className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate font-mono">
                      {viewMode === "liked-songs"
                        ? "Liked Songs (Lagu yang Disukai)"
                        : selectedPlaylist?.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate font-sans">
                      {searchQuery.trim() ? (
                        <span className="flex items-center gap-1.5 text-emerald-300 font-mono font-medium">
                          {isDeepSearching && (
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-purple-400 shrink-0" />
                          )}
                          <span>Found {filteredDetailTracks.length} matching</span>
                          <span className="text-slate-400 font-normal">
                            ({detailTracks.length}/{detailTotalCount || detailTracks.length} checked)
                          </span>
                        </span>
                      ) : (
                        <>
                          {detailTracks.length} of {detailTotalCount || detailTracks.length} tracks loaded
                          {selectedPlaylist?.ownerName && ` • by ${selectedPlaylist.ownerName}`}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Playlist Action Bar: Shuffle (0) & Play All (1) */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(-1);
                      setSelectedActionIndex(0);
                      handlePlayAll(true);
                    }}
                    className={cn(
                      "h-7 px-2.5 rounded-xl border text-xs font-mono gap-1 transition-all cursor-pointer",
                      selectedIndex === -1 && selectedActionIndex === 0
                        ? "bg-purple-500 text-white font-bold border-purple-300 ring-2 ring-purple-400 shadow-lg shadow-purple-500/30 scale-105"
                        : "bg-white/[0.04] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border-white/10 hover:border-emerald-500/40"
                    )}
                    title="Shuffle Play Playlist (Focus with Arrow Up, Left/Right to choose, Enter to play)"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Shuffle</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(-1);
                      setSelectedActionIndex(1);
                      handlePlayAll(false);
                    }}
                    className={cn(
                      "h-7 px-3 rounded-xl shadow-md text-xs font-mono gap-1 transition-all cursor-pointer",
                      selectedIndex === -1 && selectedActionIndex === 1
                        ? "bg-emerald-400 text-slate-950 font-bold border border-emerald-300 ring-2 ring-emerald-300 shadow-lg shadow-emerald-400/40 scale-105"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    )}
                    title="Play all tracks (Focus with Arrow Up, Left/Right to choose, Enter to play)"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play All</span>
                  </Button>
                </div>
              </div>

              {/* Virtualized Tracks List (60/120 FPS Buttery Smooth) */}
              {isLoadingDetail ? (
                <div className="space-y-1.5 pt-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 rounded-2xl bg-white/[0.02] animate-pulse border border-white/5"
                    />
                  ))}
                </div>
              ) : filteredDetailTracks.length > 0 ? (
                <div className="pt-1 pb-4">
                  {/* Top Spacer for offscreen virtual tracks */}
                  {topPadding > 0 && (
                    <div style={{ height: `${topPadding}px` }} aria-hidden="true" />
                  )}

                  {/* Visible Window of Tracks */}
                  <div className="space-y-1">
                    {visibleDetailTracks.map((track, relativeIdx) => {
                      const actualIdx = startIndex + relativeIdx;
                      return (
                        <VirtualTrackRow
                          key={track.id || `${track.uri}-${actualIdx}`}
                          track={track}
                          idx={actualIdx}
                          isSelected={selectedIndex === actualIdx}
                          selectedActionIndex={selectedActionIndex}
                          isThisPlaying={playingTrackUri === track.uri}
                          isQueueing={activeQueueingUri === track.uri}
                          isAIMixing={activeAIMixUri === track.uri}
                          isActionPending={isActionPending}
                          onSelect={handleTrackSelect}
                          onPlayTrack={handlePlayTrack}
                          onPlayAIMix={handlePlayAIMix}
                          onAddToQueue={handleAddToQueue}
                        />
                      );
                    })}
                  </div>

                  {/* Bottom Spacer for offscreen virtual tracks */}
                  {bottomPadding > 0 && (
                    <div style={{ height: `${bottomPadding}px` }} aria-hidden="true" />
                  )}

                  {/* Infinite Scroll Loading Indicator */}
                  {isLoadingMore ? (
                    <div className="py-4 px-2 space-y-2 animate-in fade-in duration-300">
                      <div className="flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-mono shadow-xl backdrop-blur-md">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                        <span>Memuat lagu selanjutnya... ({detailTracks.length} / {detailTotalCount})</span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-11 rounded-2xl bg-white/[0.03] animate-pulse border border-white/5"
                          />
                        ))}
                      </div>
                    </div>
                  ) : !searchQuery.trim() && detailTracks.length < detailTotalCount ? (
                    <div className="py-4 text-center text-[10px] font-mono text-slate-500">
                      Scroll ke bawah untuk memuat lebih banyak ({detailTracks.length} / {detailTotalCount})
                    </div>
                  ) : !searchQuery.trim() && detailTracks.length > 0 ? (
                    <div className="py-4 text-center text-[10px] font-mono text-slate-500">
                      Semua lagu telah dimuat ({detailTracks.length} lagu)
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="py-12 text-center space-y-3 font-mono text-xs animate-in fade-in duration-200">
                  {searchQuery.trim() ? (
                    <div className="space-y-3 px-4 max-w-md mx-auto">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                        <Search className="w-5 h-5" />
                      </div>
                      <p className="text-slate-300">
                        Tidak ada lagu yang cocok dengan &quot;<span className="text-emerald-300 font-bold">{searchQuery}</span>&quot; di {viewMode === "liked-songs" ? "Liked Songs" : "playlist ini"}.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleSwitchToGlobalSearch()}
                        className="h-8 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Cari &quot;{searchQuery}&quot; di seluruh Spotify</span>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-slate-500">No tracks found in this playlist.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. LIVE PLAYBACK QUEUE VIEW */}
          {viewMode === "queue" && (
            <div className="space-y-3">
              {/* Unified Elegant Now Playing & Queue Header Banner */}
              <div className="relative overflow-hidden p-3.5 rounded-2xl bg-gradient-to-r from-[#0d121c] via-[#101827]/90 to-[#0a0e17] border border-white/10 shadow-xl flex items-center justify-between gap-4 group">
                {/* Ambient background cover image bleeding from right to center */}
                {(currentlyPlayingInQueue?.imageUrl || nowPlaying.albumImageUrl) && (
                  <>
                    <img
                      src={currentlyPlayingInQueue?.imageUrl || nowPlaying.albumImageUrl}
                      alt=""
                      className="absolute -right-6 top-0 bottom-0 w-72 h-full object-cover object-center opacity-25 filter blur-[2px] pointer-events-none transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d121c] via-[#0d121c]/85 to-transparent pointer-events-none" />
                  </>
                )}

                {/* Left side: Header Badge + Track Title & Artist Info */}
                <div className="relative z-10 min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-mono font-bold tracking-wider uppercase shadow-inner">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      NOW PLAYING
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      • {searchQuery.trim() ? "Filtering..." : `${filteredNextUpTracks.length} lagu di antrean`}
                    </span>
                  </div>

                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-bold text-white truncate font-sans tracking-tight">
                      {currentlyPlayingInQueue?.name || nowPlaying.title || "Tidak ada lagu yang sedang diputar"}
                    </p>
                    <p className="text-xs text-slate-400 truncate font-sans">
                      {currentlyPlayingInQueue?.artists || nowPlaying.artist || "Spotify Player"}
                      {(currentlyPlayingInQueue?.albumName || nowPlaying.album) && (
                        <span className="text-slate-500 font-normal">
                          {" "}• {currentlyPlayingInQueue?.albumName || nowPlaying.album}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right side: Crisp Album Thumbnail with subtle glow */}
                <div className="relative z-10 shrink-0">
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/20 shadow-2xl relative">
                    {currentlyPlayingInQueue?.imageUrl || nowPlaying.albumImageUrl ? (
                      <img
                        src={currentlyPlayingInQueue?.imageUrl || nowPlaying.albumImageUrl}
                        alt={currentlyPlayingInQueue?.name || nowPlaying.title || "Now Playing"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-emerald-400 bg-emerald-500/10">
                        <Music className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Queue Track List */}
              {isLoadingQueue ? (
                <div className="space-y-1.5 pt-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-12 rounded-2xl bg-white/[0.02] animate-pulse border border-white/5"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1 pt-1 pb-4">
                  {/* Section label */}
                  {filteredNextUpTracks.length > 0 && (
                    <div className="px-2 pb-1 text-[10px] font-mono text-emerald-300/90 font-semibold uppercase tracking-wider">
                      Queue ({filteredNextUpTracks.length})
                    </div>
                  )}

                  {filteredNextUpTracks.length > 0 ? (
                    filteredNextUpTracks.map((track, idx) => {
                      const isSelected = selectedIndex === idx;

                      return (
                        <div
                          key={`queue-${track.id}-${idx}`}
                          ref={(el) => {
                            if (el) itemRefs.current.set(idx, el);
                            else itemRefs.current.delete(idx);
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-2xl transition-all text-xs font-mono border",
                            isSelected
                              ? "bg-emerald-500/15 border-emerald-500/40 text-white shadow-md shadow-emerald-500/10"
                              : "bg-white/[0.02] border-white/5 text-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-5 text-center text-[10px] text-slate-500 font-mono shrink-0">
                              {idx + 1}
                            </span>
                            <div className="w-8 h-8 rounded-xl overflow-hidden bg-white/5 border border-white/10 relative shrink-0">
                              {track.imageUrl ? (
                                <img
                                  src={track.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                  <Music className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col min-w-0 flex-1">
                              <span
                                className={cn(
                                  "font-bold truncate text-slate-100 transition-colors",
                                  isSelected ? "text-emerald-300" : "text-white"
                                )}
                              >
                                {track.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans truncate">
                                {track.artists}
                                {track.albumName && (
                                  <span className="text-slate-500"> • {track.albumName}</span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDuration(track.durationMs)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center space-y-2 font-mono text-xs text-slate-500">
                      <ListMusic className="w-8 h-8 mx-auto opacity-30" />
                      <p>Queue kosong.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer: Live Now Playing & Remote Player Controls */}
        {nowPlaying.title && (
          <div className="pt-2 px-3 shrink-0">
            <div className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {nowPlaying.albumImageUrl ? (
                  <img
                    src={nowPlaying.albumImageUrl}
                    alt={nowPlaying.title}
                    className="w-8 h-8 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-emerald-300 truncate">
                    {nowPlaying.title}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {nowPlaying.artist}
                  </p>
                </div>
                {nowPlaying.songUrl && (
                  <a
                    href={nowPlaying.songUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                    title="Open on Spotify"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isActionPending}
                  onClick={handleOpenQueueView}
                  className={cn(
                    "w-7 h-7 rounded-xl border transition-all cursor-pointer",
                    viewMode === "queue"
                      ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                      : "bg-white/[0.03] text-slate-400 hover:text-white border-white/10 hover:bg-white/10"
                  )}
                  title="View Live Queue (Alt+Q)"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isActionPending}
                  onClick={handleToggleShuffle}
                  className={cn(
                    "w-7 h-7 rounded-xl border transition-all cursor-pointer",
                    isShuffleActive
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-white/[0.03] text-slate-400 hover:text-white border-white/10 hover:bg-white/10"
                  )}
                  title={isShuffleActive ? "Shuffle: ON" : "Shuffle: OFF"}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </Button>

                <Button
                  size="icon"
                  disabled={isActionPending}
                  onClick={handleTogglePlayPause}
                  className="w-7 h-7 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                  title={nowPlaying.isPlaying ? "Pause" : "Play"}
                >
                  {nowPlaying.isPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  disabled={isActionPending}
                  onClick={handleNextTrack}
                  className="w-7 h-7 rounded-xl bg-white/[0.03] hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer"
                  title="Next Track"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Shortcut Bar with Arrow Navigation Hints */}
        <div className="mt-2 px-4 py-2.5 border-t border-white/10 bg-black/40 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            {viewMode === "playlist-detail" || viewMode === "liked-songs" || viewMode === "queue" ? (
              <>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                    ← Backspace
                  </kbd>{" "}
                  Playlists
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                    Ctrl+↵
                  </kbd>{" "}
                  Global Search
                </span>
              </>
            ) : null}
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                ↑↓
              </kbd>{" "}
              Row
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                ←→
              </kbd>{" "}
              Action
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                ↵
              </kbd>{" "}
              Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                Alt+Q
              </kbd>{" "}
              Queue
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                /
              </kbd>{" "}
              Search
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10 text-slate-300">
                esc
              </kbd>{" "}
              Dismiss
            </span>
          </div>
          <span className="hidden sm:inline text-slate-500">Spotify Connect Hub</span>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
}

