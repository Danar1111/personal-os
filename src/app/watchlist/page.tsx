import React, { Suspense } from "react";
import { getWatchlist, getTrendingMovies, searchTmdbMovies } from "./actions";
import { WatchlistClient } from "./watchlist-client";

export const metadata = {
  title: "TMDB Watchlist & Recommendations | Personal OS",
  description: "TMDB Movie Search, 24h Cached Recommendations & Saved Watchlist",
};

export const dynamic = "force-dynamic";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = (await searchParams) || {};
  const initialWatchlist = await getWatchlist();
  const trendingRes = await getTrendingMovies();
  const trendingMovies = trendingRes.results || [];

  let initialSearchResults: any[] = [];
  let initialMissingKey = false;
  let initialSearchError: string | null = null;

  if (search && search.trim()) {
    const res = await searchTmdbMovies(search.trim());
    if (res.missingKey) {
      initialMissingKey = true;
    } else if (res.error) {
      initialSearchError = res.error;
    } else {
      initialSearchResults = res.results || [];
    }
  }

  return (
    <Suspense fallback={null}>
      <WatchlistClient
        initialWatchlist={initialWatchlist}
        trendingMovies={trendingMovies}
        initialSearchQuery={search?.trim() || ""}
        initialSearchResults={initialSearchResults}
        initialMissingKey={initialMissingKey}
        initialSearchError={initialSearchError}
      />
    </Suspense>
  );
}
