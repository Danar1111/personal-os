"use server";

import { db } from "@/db";
import { watchlist, systemSettings, WatchlistMovie } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getWatchlist(): Promise<WatchlistMovie[]> {
  try {
    const rows = await db
      .select()
      .from(watchlist)
      .orderBy(desc(watchlist.createdAt));
    return rows;
  } catch (error) {
    console.error("[getWatchlist error]:", error);
    return [];
  }
}

export async function getTrendingMovies() {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "tmdb_api_key"));

    const apiKey = row?.value?.trim();
    if (!apiKey) {
      return { results: [], missingKey: true, error: "TMDB API Key is not configured in Settings." };
    }

    // Cache trending movies for 24 hours (86,400 seconds) so page access/refresh does not hit API constantly
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return { results: [], missingKey: false, error: `TMDB API error: ${res.status} ${res.statusText}` };
    }

    const data = await res.json();
    const results = (data?.results || []).slice(0, 10).map((m: any) => ({
      tmdbId: m.id,
      title: m.title,
      overview: m.overview || "",
      posterPath: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropPath: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
      rating: m.vote_average ? `${m.vote_average.toFixed(1)} / 10` : "N/A",
      releaseDate: m.release_date || "N/A",
      originalLanguage: m.original_language ? m.original_language.toUpperCase() : "EN",
      voteCount: m.vote_count || 0,
    }));

    return { results, missingKey: false, error: null };
  } catch (error: any) {
    console.error("[getTrendingMovies error]:", error);
    return { results: [], missingKey: false, error: error.message || "Failed to fetch trending movies" };
  }
}

export async function searchTmdbMovies(query: string) {
  if (!query || !query.trim()) return { results: [], missingKey: false, error: null };

  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "tmdb_api_key"));

    const apiKey = row?.value?.trim();
    if (!apiKey) {
      return { results: [], missingKey: true, error: "TMDB API Key is not configured in Settings." };
    }

    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query.trim())}&api_key=${apiKey}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 1800 },
      }
    );

    if (!res.ok) {
      return { results: [], missingKey: false, error: `TMDB API error: ${res.status} ${res.statusText}` };
    }

    const data = await res.json();
    const results = (data?.results || []).map((m: any) => ({
      tmdbId: m.id,
      title: m.title,
      overview: m.overview || "",
      posterPath: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      backdropPath: m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null,
      rating: m.vote_average ? `${m.vote_average.toFixed(1)} / 10` : "N/A",
      releaseDate: m.release_date || "N/A",
      originalLanguage: m.original_language ? m.original_language.toUpperCase() : "EN",
      voteCount: m.vote_count || 0,
    }));

    return { results, missingKey: false, error: null };
  } catch (error: any) {
    console.error("[searchTmdbMovies error]:", error);
    return { results: [], missingKey: false, error: error.message || "Failed to search TMDB" };
  }
}

export async function saveMovieToWatchlist(movie: {
  title: string;
  overview?: string;
  posterPath?: string | null;
  tmdbId: number;
  rating?: string;
}) {
  try {
    const existing = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.tmdbId, movie.tmdbId));

    if (existing.length > 0) {
      return { success: false, message: `"${movie.title}" is already in your Watchlist!` };
    }

    await db.insert(watchlist).values({
      title: movie.title,
      overview: movie.overview || "",
      posterPath: movie.posterPath || null,
      tmdbId: movie.tmdbId,
      rating: movie.rating || "N/A",
    });

    revalidatePath("/watchlist");
    revalidatePath("/");
    return { success: true, message: `"${movie.title}" saved to Watchlist!` };
  } catch (error: any) {
    console.error("[saveMovieToWatchlist error]:", error);
    return { success: false, message: error.message || "Failed to save movie" };
  }
}

export async function removeMovieFromWatchlist(id: number) {
  try {
    await db.delete(watchlist).where(eq(watchlist.id, id));
    revalidatePath("/watchlist");
    revalidatePath("/");
    return { success: true, message: "Movie removed from Watchlist!" };
  } catch (error: any) {
    console.error("[removeMovieFromWatchlist error]:", error);
    return { success: false, message: error.message || "Failed to remove movie" };
  }
}
