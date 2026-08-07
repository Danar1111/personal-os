"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Film,
  Search,
  Plus,
  Trash2,
  Star,
  Settings,
  AlertCircle,
  AlertTriangle,
  BookmarkCheck,
  Loader2,
  X,
  ExternalLink,
  Info,
  Calendar,
  Globe,
  ThumbsUp,
  Flame,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WatchlistMovie } from "@/db/schema";
import { searchTmdbMovies, saveMovieToWatchlist, removeMovieFromWatchlist } from "./actions";
import { cn } from "@/lib/utils";

interface WatchlistClientProps {
  initialWatchlist: WatchlistMovie[];
  trendingMovies: any[];
}

export function WatchlistClient({ initialWatchlist, trendingMovies }: WatchlistClientProps) {
  const [watchlistItems, setWatchlistItems] = useState<WatchlistMovie[]>(initialWatchlist);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [watchlistVisibleLimit, setWatchlistVisibleLimit] = useState<number>(6);

  // Selected Movie for Detail Modal
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);

  // Custom Glassmorphic Delete Confirmation Modal State (Popup Verif)
  const [deletingMovieConfirm, setDeletingMovieConfirm] = useState<{ id: number; title: string } | null>(null);

  // Status feedback toast
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setMissingKey(false);

    const res = await searchTmdbMovies(searchQuery);
    if (res.missingKey) {
      setMissingKey(true);
      setSearchResults([]);
    } else if (res.error) {
      setSearchError(res.error);
      setSearchResults([]);
    } else {
      setSearchResults(res.results);
    }

    setIsSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  const handleSaveMovie = async (movie: any) => {
    const res = await saveMovieToWatchlist(movie);
    if (res.success) {
      triggerFeedback(res.message);
      setWatchlistItems((prev) => [
        {
          id: Date.now(),
          title: movie.title,
          overview: movie.overview,
          posterPath: movie.posterPath,
          tmdbId: movie.tmdbId,
          rating: movie.rating,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    } else {
      alert(res.message);
    }
  };

  const isSavedInWatchlist = (tmdbId: number) => {
    return watchlistItems.some((w) => w.tmdbId === tmdbId);
  };

  const getSavedWatchlistItem = (tmdbId: number) => {
    return watchlistItems.find((w) => w.tmdbId === tmdbId);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-mono">
      {/* Toast Notification */}
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-mono flex items-center justify-between shadow-lg backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="w-4.5 h-4.5 text-purple-400" />
            <span>{feedback}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-slate-900/50 border border-white/10 glass-panel backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/20 border border-white/20">
            <Film className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-white tracking-wide flex items-center gap-2">
              TMDB MOVIE WATCHLIST &amp; RECOMMENDATIONS
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Click Any Movie for Rich Details &amp; Full Overview • 24-Hour Cached Recommendations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10 font-mono text-xs py-1.5 px-3">
            {watchlistItems.length} Saved Movies
          </Badge>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/10 shadow-lg">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any movie on TMDB (e.g. Inception, Interstellar, Dune)..."
              className="pl-10 pr-10 bg-white/[0.04] border-white/15 text-xs text-white placeholder:text-slate-500 rounded-2xl h-11 focus:border-purple-500/50 font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs rounded-2xl h-11 px-6 gap-2 shadow-lg shadow-purple-600/20 shrink-0 cursor-pointer"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search TMDB</span>
          </Button>
        </form>

        {/* Missing Key Warning */}
        {missingKey && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>TMDB API Key is required. Please configure it in System Settings.</span>
            </div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-xs font-mono text-amber-300 hover:text-white underline shrink-0"
            >
              <Settings className="w-3.5 h-3.5" /> Settings →
            </Link>
          </div>
        )}

        {searchError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            {searchError}
          </div>
        )}

        {/* Search Results Grid */}
        {searchResults.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">
              <span>SEARCH RESULTS ({searchResults.length})</span>
              <button onClick={clearSearch} className="text-slate-400 hover:text-white text-[11px] underline">
                Clear Results
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {searchResults.map((movie) => {
                const saved = isSavedInWatchlist(movie.tmdbId);
                return (
                  <div
                    key={movie.tmdbId}
                    onClick={() => setSelectedMovie(movie)}
                    className="group relative p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/50 cursor-pointer flex flex-col justify-between space-y-2.5 transition-all shadow-md hover:-translate-y-1"
                  >
                    <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-black/40 border border-white/10">
                      {movie.posterPath ? (
                        <img
                          src={movie.posterPath}
                          alt={movie.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono p-2 text-center">
                          No Poster
                        </div>
                      )}
                      {movie.rating && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur text-[10px] font-mono text-amber-300 font-bold flex items-center gap-1 border border-white/10">
                          <Star className="w-3 h-3 fill-amber-300" />
                          <span>{movie.rating}</span>
                        </div>
                      )}

                      {/* Hover Info Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono font-semibold gap-1 backdrop-blur-xs">
                        <Info className="w-4 h-4 text-purple-400" /> Details
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold font-mono text-white truncate group-hover:text-purple-300 transition-colors">
                        {movie.title}
                      </h4>
                    </div>

                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (saved) {
                          const savedItem = getSavedWatchlistItem(movie.tmdbId);
                          if (savedItem) setDeletingMovieConfirm({ id: savedItem.id, title: movie.title });
                        } else {
                          handleSaveMovie(movie);
                        }
                      }}
                      className={cn(
                        "w-full h-8 text-[11px] font-mono rounded-xl cursor-pointer transition-all",
                        saved
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40"
                          : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20"
                      )}
                    >
                      {saved ? "Saved ✓" : "+ Watchlist"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recommended Movies Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Flame className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold font-mono text-white tracking-wider uppercase">
              RECOMMENDED &amp; TRENDING MOVIES
            </h2>
          </div>
          <Badge variant="outline" className="border-white/10 text-slate-400 font-mono text-[10px]">
            TMDB Daily Top 10
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {trendingMovies.slice(0, 10).map((movie) => {
            const saved = isSavedInWatchlist(movie.tmdbId);
            return (
              <div
                key={movie.tmdbId}
                onClick={() => setSelectedMovie(movie)}
                className="group relative p-3.5 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-purple-500/50 cursor-pointer flex flex-col justify-between space-y-2.5 transition-all shadow-lg hover:-translate-y-1"
              >
                <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-black/40 border border-white/10">
                  {movie.posterPath ? (
                    <img
                      src={movie.posterPath}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono p-2 text-center">
                      No Poster
                    </div>
                  )}
                  {movie.rating && (
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur text-[10px] font-mono text-amber-300 font-bold flex items-center gap-1 border border-white/10">
                      <Star className="w-3 h-3 fill-amber-300" />
                      <span>{movie.rating}</span>
                    </div>
                  )}

                  {/* Hover Info Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono font-semibold gap-1 backdrop-blur-xs">
                    <Info className="w-4 h-4 text-purple-400" /> View Details
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold font-mono text-white truncate group-hover:text-purple-300 transition-colors">
                    {movie.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                    {movie.overview || "Click for details..."}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (saved) {
                      const savedItem = getSavedWatchlistItem(movie.tmdbId);
                      if (savedItem) setDeletingMovieConfirm({ id: savedItem.id, title: movie.title });
                    } else {
                      handleSaveMovie(movie);
                    }
                  }}
                  className={cn(
                    "w-full h-8 text-[11px] font-mono rounded-2xl cursor-pointer transition-all",
                    saved
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20"
                  )}
                >
                  {saved ? "In Watchlist ✓" : "+ Add Watchlist"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saved Watchlist Grid Section */}
      <div className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <BookmarkCheck className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold font-mono text-white tracking-wider uppercase">
              MY SAVED WATCHLIST ({watchlistItems.length})
            </h2>
          </div>
        </div>

        {watchlistItems.length === 0 ? (
          <div className="py-16 glass-panel rounded-3xl border border-white/10 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
            No movies in your saved watchlist yet. Search or pick from recommendations above!
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {watchlistItems.slice(0, watchlistVisibleLimit).map((movie) => (
                <div
                  key={movie.id}
                  onClick={() => setSelectedMovie(movie)}
                  className="group relative p-3.5 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-purple-500/50 cursor-pointer flex flex-col justify-between space-y-2.5 transition-all shadow-lg hover:-translate-y-1"
                >
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingMovieConfirm({ id: movie.id, title: movie.title });
                    }}
                    title="Remove from Watchlist"
                    className="absolute top-4 right-4 p-1.5 rounded-xl bg-black/80 text-slate-300 hover:text-rose-400 hover:bg-rose-600 transition-colors z-10 border border-white/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-black/40 border border-white/10">
                    {movie.posterPath ? (
                      <img
                        src={movie.posterPath}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-mono p-2 text-center">
                        No Poster
                      </div>
                    )}
                    {movie.rating && (
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur text-[10px] font-mono text-amber-300 font-bold flex items-center gap-1 border border-white/10">
                        <Star className="w-3 h-3 fill-amber-300" />
                        <span>{movie.rating}</span>
                      </div>
                    )}

                    {/* Hover Info Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono font-semibold gap-1 backdrop-blur-xs">
                      <Info className="w-4 h-4 text-purple-400" /> View Details
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold font-mono text-white truncate group-hover:text-purple-300 transition-colors">
                      {movie.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                      {movie.overview || "Click for details..."}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Show More / Show Less Expander Button */}
            {watchlistItems.length > 6 && (
              <div className="flex justify-center pt-4">
                {watchlistVisibleLimit < watchlistItems.length ? (
                  <Button
                    onClick={() => setWatchlistVisibleLimit(watchlistItems.length)}
                    className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 font-mono text-xs rounded-2xl h-10 px-6 gap-2 shadow-lg cursor-pointer transition-all"
                  >
                    Show More (+{watchlistItems.length - watchlistVisibleLimit} more movies)
                  </Button>
                ) : (
                  <Button
                    onClick={() => setWatchlistVisibleLimit(6)}
                    variant="outline"
                    className="border-white/15 text-slate-400 hover:text-white font-mono text-xs rounded-2xl h-10 px-6 cursor-pointer"
                  >
                    Show Less
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MOVIE DETAIL OBSIDIAN GLASS MODAL DIALOG */}
      {/* ========================================================================= */}
      {selectedMovie && (
        <Dialog open={!!selectedMovie} onOpenChange={() => setSelectedMovie(null)}>
          <DialogContent showCloseButton={false} className="sm:max-w-2xl w-[92vw] bg-[#14141e] border-white/15 text-slate-100 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-2xl font-mono">
            <DialogTitle className="sr-only">{selectedMovie.title} Details</DialogTitle>

            {/* Backdrop Header */}
            <div className="relative h-48 sm:h-64 w-full bg-black/60 overflow-hidden">
              {selectedMovie.backdropPath || selectedMovie.posterPath ? (
                <img
                  src={selectedMovie.backdropPath || selectedMovie.posterPath}
                  alt={selectedMovie.title}
                  className="w-full h-full object-cover opacity-60 filter blur-xs scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-purple-900/50 to-indigo-900/50" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#14141e] via-[#14141e]/60 to-transparent" />

              {/* Close Button */}
              <button
                onClick={() => setSelectedMovie(null)}
                className="absolute top-4 right-4 p-2 rounded-2xl bg-black/60 hover:bg-white/20 text-slate-300 hover:text-white transition-colors z-20 border border-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Poster Overlap */}
              <div className="absolute bottom-4 left-6 flex items-end gap-4 z-10">
                <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-2xl overflow-hidden bg-black border-2 border-white/20 shadow-2xl shrink-0">
                  {selectedMovie.posterPath ? (
                    <img src={selectedMovie.posterPath} alt={selectedMovie.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-500 p-2 text-center">
                      No Poster
                    </div>
                  )}
                </div>

                <div className="space-y-1 mb-1">
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-white tracking-wide leading-tight">
                    {selectedMovie.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-300" /> {selectedMovie.rating || "N/A"}
                    </span>
                    {selectedMovie.releaseDate && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" /> {selectedMovie.releaseDate}
                      </span>
                    )}
                    {selectedMovie.originalLanguage && (
                      <span className="flex items-center gap-1 text-slate-400 uppercase">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" /> {selectedMovie.originalLanguage}
                      </span>
                    )}
                    {selectedMovie.voteCount > 0 && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" /> {selectedMovie.voteCount} votes
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 space-y-5 text-sm leading-relaxed">
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">SYNOPSIS / OVERVIEW</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                  {selectedMovie.overview || "No detailed synopsis available for this title."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                {selectedMovie.tmdbId ? (
                  <a
                    href={`https://www.themoviedb.org/movie/${selectedMovie.tmdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-indigo-300 hover:text-white text-xs font-mono border border-white/10 transition-colors"
                  >
                    <span>View on TMDB.org</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : <div />}

                <div className="flex items-center gap-2">
                  {isSavedInWatchlist(selectedMovie.tmdbId) ? (
                    <Button
                      onClick={() => {
                        const savedItem = getSavedWatchlistItem(selectedMovie.tmdbId);
                        if (savedItem) setDeletingMovieConfirm({ id: savedItem.id, title: selectedMovie.title });
                      }}
                      className="bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 text-xs font-mono rounded-2xl h-11 px-4 gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Remove from Watchlist
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSaveMovie(selectedMovie)}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono rounded-2xl h-11 px-5 gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Save to Watchlist
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* COOL GLASSMORPHIC DELETE MOVIE CONFIRMATION DIALOG (Popup Verif) */}
      {deletingMovieConfirm && (
        <Dialog open={!!deletingMovieConfirm} onOpenChange={() => setDeletingMovieConfirm(null)}>
          <DialogContent showCloseButton={false} className="bg-[#16131c] border-rose-500/30 text-slate-100 rounded-3xl max-w-md p-6 shadow-2xl backdrop-blur-2xl font-mono text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">REMOVE FROM WATCHLIST</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                Are you sure you want to remove <span className="text-rose-300 font-bold">&quot;{deletingMovieConfirm.title}&quot;</span> from your TMDB saved watchlist?
              </p>
              <p className="text-[10px] text-slate-500 mt-1">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingMovieConfirm(null)}
                className="flex-1 border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl h-11 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const targetMovie = deletingMovieConfirm;
                  setDeletingMovieConfirm(null);
                  setWatchlistItems((prev) => prev.filter((m) => m.id !== targetMovie.id));
                  if (selectedMovie && selectedMovie.id === targetMovie.id) {
                    setSelectedMovie(null);
                  }
                  const res = await removeMovieFromWatchlist(targetMovie.id);
                  if (res.success) {
                    triggerFeedback(res.message);
                  } else {
                    alert(res.message);
                    setWatchlistItems(initialWatchlist);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl h-11 text-xs font-mono font-bold shadow-lg shadow-rose-600/40 cursor-pointer"
              >
                Remove Movie
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
