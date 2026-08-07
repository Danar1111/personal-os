import React from "react";
import { getWatchlist, getTrendingMovies } from "./actions";
import { WatchlistClient } from "./watchlist-client";

export const metadata = {
  title: "TMDB Watchlist & Recommendations | Personal OS",
  description: "TMDB Movie Search, 24h Cached Recommendations & Saved Watchlist",
};

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const initialWatchlist = await getWatchlist();
  const trendingRes = await getTrendingMovies();
  const trendingMovies = trendingRes.results || [];

  return (
    <WatchlistClient
      initialWatchlist={initialWatchlist}
      trendingMovies={trendingMovies}
    />
  );
}
