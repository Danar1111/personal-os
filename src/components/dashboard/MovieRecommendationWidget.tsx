"use client";

import React, { useState } from "react";
import {
  Film,
  Star,
  Plus,
  Check,
  ExternalLink,
  Info,
  Calendar,
  Globe,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { saveMovieToWatchlist } from "@/app/watchlist/actions";

interface MovieItem {
  tmdbId: number;
  title: string;
  overview?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  rating?: string;
  releaseDate?: string;
  originalLanguage?: string;
  voteCount?: number;
}

interface MovieRecommendationWidgetProps {
  movies?: MovieItem[];
}

function SingleMovieCard({ movie }: { movie: MovieItem }) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSaving(true);
    const res = await saveMovieToWatchlist(movie);
    if (res.success) {
      setIsSaved(true);
    } else {
      alert(res.message);
    }
    setIsSaving(false);
  };

  const bgImage = movie.backdropPath || movie.posterPath;

  return (
    <>
      {/* Movie Card */}
      <div
        onClick={() => setIsOpen(true)}
        className="group relative rounded-2xl overflow-hidden border border-white/10 p-3.5 bg-[#09090e] hover:bg-[#0e0e16] transition-all hover:border-purple-500/50 flex flex-col justify-between cursor-pointer min-h-[100px] shadow-lg hover:shadow-purple-950/20"
      >
        {/* Slid-to-Right Centered Image Container */}
        {bgImage ? (
          <div className="absolute right-0 top-0 bottom-0 w-[55%] h-full overflow-hidden pointer-events-none">
            <img
              src={bgImage}
              alt={movie.title}
              className="w-full h-full object-cover object-center opacity-70 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
            />
          </div>
        ) : (
          <div className="absolute right-0 top-0 bottom-0 w-[55%] h-full bg-gradient-to-l from-purple-900/40 to-transparent pointer-events-none" />
        )}

        {/* Left-to-Right Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090e] via-[#09090e]/95 via-45% to-transparent pointer-events-none" />

        {/* Card Content */}
        <div className="relative z-10 space-y-1.5 max-w-[65%]">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold font-mono text-white group-hover:text-purple-300 transition-colors truncate">
              {movie.title}
            </h4>
            {movie.rating && (
              <span className="text-[10px] font-mono text-amber-300 flex items-center gap-0.5 shrink-0 bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-500/30 backdrop-blur-md">
                <Star className="w-2.5 h-2.5 fill-amber-300" /> {movie.rating}
              </span>
            )}
          </div>

          <p className="text-[10px] text-slate-300 font-sans line-clamp-2 leading-relaxed">
            {movie.overview || "Click card for full details & overview..."}
          </p>
        </div>

        {/* Card Footer Actions */}
        <div className="relative z-10 pt-2 flex items-center justify-between">
          <Button
            onClick={handleSave}
            disabled={isSaved || isSaving}
            size="sm"
            className={`h-6 text-[10px] font-mono rounded-lg px-2.5 gap-1 ${
              isSaved
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-purple-600/90 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30"
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3 h-3" /> Saved
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" /> Watchlist
              </>
            )}
          </Button>

          <span className="text-[9px] font-mono text-slate-400 group-hover:text-purple-300 flex items-center gap-1 transition-colors bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
            <Info className="w-3 h-3 text-purple-400" /> Details
          </span>
        </div>
      </div>

      {/* Rich TMDB Detail Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl w-[92vw] bg-[#0e0e12]/95 border-white/15 text-slate-100 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-2xl">
          <DialogTitle className="sr-only">{movie.title} Details</DialogTitle>

          {/* Backdrop Header */}
          <div className="relative h-48 sm:h-64 w-full bg-black/60 overflow-hidden">
            {bgImage ? (
              <img
                src={bgImage}
                alt={movie.title}
                className="w-full h-full object-cover opacity-60 filter blur-xs scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-purple-900/50 to-indigo-900/50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e12] via-[#0e0e12]/60 to-transparent" />

            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-black/60 hover:bg-white/20 text-slate-300 hover:text-white transition-colors z-20 border border-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Poster Overlap & Metadata Header */}
            <div className="absolute bottom-4 left-6 flex items-end gap-4 z-10">
              <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-xl overflow-hidden bg-black border-2 border-white/20 shadow-2xl shrink-0">
                {movie.posterPath ? (
                  <img src={movie.posterPath} alt={movie.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-500 p-2 text-center">
                    No Poster
                  </div>
                )}
              </div>

              <div className="space-y-1.5 mb-1">
                <h2 className="text-lg sm:text-xl font-bold font-mono text-white tracking-wide leading-tight">
                  {movie.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-300" /> {movie.rating || "N/A"}
                  </span>
                  {movie.releaseDate && (
                    <span className="flex items-center gap-1 text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                      <Calendar className="w-3 h-3 text-indigo-400" /> {movie.releaseDate}
                    </span>
                  )}
                  {movie.originalLanguage && (
                    <span className="flex items-center gap-1 text-slate-300 uppercase bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                      <Globe className="w-3 h-3 text-cyan-400" /> {movie.originalLanguage}
                    </span>
                  )}
                  {movie.voteCount !== undefined && movie.voteCount > 0 && (
                    <span className="flex items-center gap-1 text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                      <ThumbsUp className="w-3 h-3 text-emerald-400" /> {movie.voteCount} votes
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Body Content */}
          <div className="p-6 space-y-5 font-sans text-sm leading-relaxed">
            <div className="space-y-2">
              <h3 className="text-xs font-bold font-mono text-purple-400 uppercase tracking-wider">SYNOPSIS / OVERVIEW</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans bg-white/[0.03] p-4 rounded-2xl border border-white/10">
                {movie.overview || "No detailed synopsis available for this title."}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              {movie.tmdbId && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-indigo-300 hover:text-white text-xs font-mono border border-white/10 transition-colors"
                >
                  <span>View on TMDB.org</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <Button
                onClick={(e) => handleSave(e)}
                disabled={isSaved || isSaving}
                className={`text-xs font-mono rounded-xl h-9 px-5 gap-1.5 ${
                  isSaved
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30"
                }`}
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4" /> Added to Watchlist
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Save to Watchlist
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MovieRecommendationWidget({ movies = [] }: MovieRecommendationWidgetProps) {
  if (!movies || movies.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-col justify-between h-[495px] font-mono text-xs text-slate-500 text-center">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
            <Film className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-white font-mono uppercase">TOP 3 MOVIES</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <p className="max-w-[200px] leading-relaxed">No TMDB recommendations found. Configure TMDB API key in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col justify-between h-[495px] border border-white/10 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white font-mono tracking-wider uppercase">
              TOP 3 MOVIES
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">TMDB Trending Weekly Picks</p>
          </div>
        </div>

        <a
          href="/watchlist"
          className="text-[10px] font-mono text-purple-400 hover:text-purple-300 underline flex items-center gap-1"
        >
          Watchlist →
        </a>
      </div>

      {/* Movie List (Top 3) */}
      <div className="space-y-2.5 flex-1 justify-center flex flex-col">
        {movies.slice(0, 3).map((m) => (
          <SingleMovieCard key={m.tmdbId} movie={m} />
        ))}
      </div>
    </div>
  );
}
