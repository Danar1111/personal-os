import { NextRequest } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";
const PLAYER_ENDPOINT = "https://api.spotify.com/v1/me/player";

export function getSpotifyRedirectUri(req?: NextRequest): string {
  if (process.env.SPOTIFY_REDIRECT_URI?.trim()) {
    return process.env.SPOTIFY_REDIRECT_URI.trim();
  }

  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
    return `${baseUrl}/api/spotify/callback`;
  }

  if (process.env.VERCEL_URL?.trim()) {
    const baseUrl = `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
    return `${baseUrl}/api/spotify/callback`;
  }

  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "127.0.0.1:3000";
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      const cleanHost = host.replace("localhost", "127.0.0.1");
      return `http://${cleanHost}/api/spotify/callback`;
    }

    return `${proto}://${host}/api/spotify/callback`;
  }

  return "http://127.0.0.1:3000/api/spotify/callback";
}


export async function getSpotifyRefreshToken(): Promise<string | null> {
  const envToken = process.env.SPOTIFY_REFRESH_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "SPOTIFY_REFRESH_TOKEN"));
    return row?.value?.trim() || null;
  } catch (e) {
    console.warn("[SPOTIFY] Failed to read SPOTIFY_REFRESH_TOKEN from DB:", e);
    return null;
  }
}

export async function saveSpotifyRefreshToken(newToken: string) {
  try {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "SPOTIFY_REFRESH_TOKEN"));

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({
          value: newToken,
          isSecret: true,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, "SPOTIFY_REFRESH_TOKEN"));
    } else {
      await db.insert(systemSettings).values({
        key: "SPOTIFY_REFRESH_TOKEN",
        value: newToken,
        isSecret: true,
      });
    }
  } catch (err) {
    console.error("[SPOTIFY] Failed to save rotated refresh token to DB:", err);
  }
}

export async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const refreshToken = await getSpotifyRefreshToken();

  if (!clientId || !clientSecret || !refreshToken) {
    console.warn("[SPOTIFY] Missing credentials or refresh token.");
    return null;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    console.error("[SPOTIFY] Failed to refresh access token:", response.status, await response.text());
    return null;
  }

  const data = await response.json();

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.log("[SPOTIFY] Received rotated refresh token from Spotify. Saving to DB...");
    await saveSpotifyRefreshToken(data.refresh_token);
  }

  return data.access_token || null;
}

export async function getNowPlaying() {
  const refreshToken = await getSpotifyRefreshToken();
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    return { isConnected: false, isPlaying: false, error: "Not connected to Spotify" };
  }

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { isConnected: false, isPlaying: false, error: "Failed to obtain access token" };
  }

  const res = await fetch(NOW_PLAYING_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });

  return { isConnected: true, response: res, accessToken };
}



export async function controlPlayback(action: "play" | "pause" | "next" | "previous") {
  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, message: "No access token" };

  let url = PLAYER_ENDPOINT;
  let method = "POST";

  if (action === "play") {
    url += "/play";
    method = "PUT";
  } else if (action === "pause") {
    url += "/pause";
    method = "PUT";
  } else if (action === "next") {
    url += "/next";
    method = "POST";
  } else if (action === "previous") {
    url += "/previous";
    method = "POST";
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 204 || res.ok) {
      return { success: true };
    }

    const errText = await res.text();
    return { success: false, message: errText || `Failed to ${action}` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export interface SpotifyTrackResult {
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

export async function searchTracks(query: string, limit: number = 10): Promise<{
  success: boolean;
  tracks: SpotifyTrackResult[];
  error?: string;
}> {
  if (!query?.trim()) {
    return { success: true, tracks: [] };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, tracks: [], error: "Not connected to Spotify or token expired." };
  }

  try {
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query.trim())}&type=track&limit=${Math.min(limit, 50)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, tracks: [], error: `Spotify search failed (${res.status}): ${errText}` };
    }

    const data = await res.json();
    const items = data.tracks?.items || [];

    const tracks: SpotifyTrackResult[] = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      artists: item.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
      albumName: item.album?.name || "",
      albumUri: item.album?.uri || "",
      imageUrl: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || "",
      uri: item.uri,
      durationMs: item.duration_ms || 0,
      externalUrl: item.external_urls?.spotify || "",
    }));

    return { success: true, tracks };
  } catch (err: any) {
    console.error("[SPOTIFY_SEARCH_ERROR]", err);
    return { success: false, tracks: [], error: err.message || "Failed to search Spotify tracks" };
  }
}

export interface SpotifyPlaylistResult {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  trackCount: number;
  uri: string;
  ownerName: string;
  externalUrl?: string;
}

export async function getUserPlaylists(limit: number = 20): Promise<{
  success: boolean;
  playlists: SpotifyPlaylistResult[];
  error?: string;
}> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, playlists: [], error: "Not connected to Spotify or token expired." };
  }

  try {
    const url = `https://api.spotify.com/v1/me/playlists?limit=${Math.min(limit, 50)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, playlists: [], error: `Failed to fetch playlists (${res.status}): ${errText}` };
    }

    const data = await res.json();
    const items = data.items || [];

    const playlists: SpotifyPlaylistResult[] = items.filter(Boolean).map((item: any) => ({
      id: item.id,
      name: item.name || "Untitled Playlist",
      description: item.description || "",
      imageUrl: item.images?.[0]?.url || item.images?.[1]?.url || "",
      trackCount: item.tracks?.total || 0,
      uri: item.uri,
      ownerName: item.owner?.display_name || "Spotify User",
      externalUrl: item.external_urls?.spotify || "",
    }));

    return { success: true, playlists };
  } catch (err: any) {
    console.error("[SPOTIFY_PLAYLISTS_ERROR]", err);
    return { success: false, playlists: [], error: err.message || "Failed to fetch Spotify playlists" };
  }
}

export async function addToQueue(
  trackUri: string,
  deviceId?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: "NOT_CONNECTED", message: "Not connected to Spotify or token expired." };
  }

  try {
    const url = `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}${
      deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
    }`;

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.ok) {
      return { success: true, message: "Added to queue." };
    }

    const errText = await res.text();
    let parsedErr: any = null;
    try {
      parsedErr = JSON.parse(errText);
    } catch {}

    const reason = parsedErr?.error?.reason;
    const msg = parsedErr?.error?.message || errText;

    if (res.status === 404 || reason === "NO_ACTIVE_DEVICE" || msg?.toLowerCase().includes("no active device")) {
      return { success: false, error: "NO_ACTIVE_DEVICE", message: "No active Spotify device found. Please open Spotify first." };
    }

    if (res.status === 403) {
      return { success: false, error: "PREMIUM_REQUIRED", message: "Spotify Premium is required to modify queue." };
    }

    return { success: false, error: "QUEUE_ERROR", message: msg || `Failed to add to queue (${res.status})` };
  } catch (err: any) {
    console.error("[SPOTIFY_ADD_QUEUE_ERROR]", err);
    return { success: false, error: "NETWORK_ERROR", message: err.message || "Failed to add to queue" };
  }
}

export async function getPlaylistTracks(
  playlistId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{
  success: boolean;
  tracks: SpotifyTrackResult[];
  total: number;
  error?: string;
}> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, tracks: [], total: 0, error: "Not connected to Spotify or token expired." };
  }

  try {
    const cleanId = playlistId.replace("spotify:playlist:", "");
    const url = `https://api.spotify.com/v1/playlists/${cleanId}/tracks?limit=${Math.min(limit, 100)}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, tracks: [], total: 0, error: `Failed to fetch playlist tracks (${res.status}): ${errText}` };
    }

    const data = await res.json();
    const items = data.items || [];

    const tracks: SpotifyTrackResult[] = items
      .filter((item: any) => item?.track && item.track.id)
      .map((item: any) => {
        const t = item.track;
        return {
          id: t.id,
          name: t.name || "Untitled Track",
          artists: t.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
          albumName: t.album?.name || "",
          albumUri: t.album?.uri || "",
          imageUrl: t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || "",
          uri: t.uri,
          durationMs: t.duration_ms || 0,
          externalUrl: t.external_urls?.spotify || "",
        };
      });

    return { success: true, tracks, total: data.total || tracks.length };
  } catch (err: any) {
    console.error("[SPOTIFY_PLAYLIST_TRACKS_ERROR]", err);
    return { success: false, tracks: [], total: 0, error: err.message || "Failed to fetch playlist tracks" };
  }
}

export async function getLikedTracks(limit: number = 50, offset: number = 0): Promise<{
  success: boolean;
  tracks: SpotifyTrackResult[];
  total: number;
  error?: string;
}> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, tracks: [], total: 0, error: "Not connected to Spotify or token expired." };
  }

  try {
    const url = `https://api.spotify.com/v1/me/tracks?limit=${Math.min(limit, 50)}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, tracks: [], total: 0, error: `Failed to fetch liked tracks (${res.status}): ${errText}` };
    }

    const data = await res.json();
    const items = data.items || [];

    const tracks: SpotifyTrackResult[] = items
      .filter((item: any) => item?.track && item.track.id)
      .map((item: any) => {
        const t = item.track;
        return {
          id: t.id,
          name: t.name || "Untitled Track",
          artists: t.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
          albumName: t.album?.name || "",
          albumUri: t.album?.uri || "",
          imageUrl: t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || "",
          uri: t.uri,
          durationMs: t.duration_ms || 0,
          externalUrl: t.external_urls?.spotify || "",
        };
      });

    return { success: true, tracks, total: data.total || tracks.length };
  } catch (err: any) {
    console.error("[SPOTIFY_LIKED_TRACKS_ERROR]", err);
    return { success: false, tracks: [], total: 0, error: err.message || "Failed to fetch liked tracks" };
  }
}




/**
 * Fetches diverse related track URIs for continuous autoplay.
 * Primary: Spotify /v1/recommendations (seed_tracks + seed_artists)
 * Fallback: artist's own top tracks shuffled
 */
export async function getRelatedRecommendationUris(
  trackId: string,
  accessToken: string,
  limit: number = 8
): Promise<string[]> {
  try {
    const cleanId = trackId.replace("spotify:track:", "");
    console.log(`[SPOTIFY_RECS] Fetching recommendations for track: ${cleanId}`);

    // Step 1: Get the track to find its primary artist
    const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${cleanId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!trackRes.ok) {
      console.warn("[SPOTIFY_RECS] Failed to fetch track info:", trackRes.status);
      return [];
    }
    const trackData = await trackRes.json();
    const primaryArtistId = trackData.artists?.[0]?.id;
    const primaryArtistName = trackData.artists?.[0]?.name;
    if (!primaryArtistId) {
      console.warn("[SPOTIFY_RECS] No primary artist found for track:", cleanId);
      return [];
    }
    console.log(`[SPOTIFY_RECS] Primary artist: ${primaryArtistName} (${primaryArtistId})`);

    // Step 2: Use /v1/recommendations with seed_tracks + seed_artists
    // Despite being marked "deprecated" in docs, this endpoint still works and is the best option
    const recUrl = `https://api.spotify.com/v1/recommendations?seed_tracks=${cleanId}&seed_artists=${primaryArtistId}&limit=${limit + 4}`;
    const recRes = await fetch(recUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (recRes.ok) {
      const recData = await recRes.json();
      const recTracks: any[] = recData.tracks || [];
      console.log(`[SPOTIFY_RECS] /recommendations returned ${recTracks.length} tracks`);

      const uris = recTracks
        .filter((t: any) => t?.uri && t.id !== cleanId)
        .sort(() => Math.random() - 0.5)
        .slice(0, limit)
        .map((t: any) => t.uri as string);

      if (uris.length > 0) {
        console.log(`[SPOTIFY_RECS] ✅ Returning ${uris.length} recommendation URIs from /recommendations`);
        return uris;
      }
    } else {
      console.warn(`[SPOTIFY_RECS] /recommendations failed (${recRes.status}), falling back to artist top-tracks`);
    }

    // Fallback: Get artist's own top tracks (with market=from_token)
    const topRes = await fetch(
      `https://api.spotify.com/v1/artists/${primaryArtistId}/top-tracks?market=from_token`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    if (!topRes.ok) {
      console.warn("[SPOTIFY_RECS] Fallback top-tracks also failed:", topRes.status);
      return [];
    }

    const topData = await topRes.json();
    const topTracks: any[] = topData.tracks || [];

    const fallbackUris = topTracks
      .filter((t: any) => t?.uri && t.id !== cleanId)
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map((t: any) => t.uri as string);

    console.log(`[SPOTIFY_RECS] ✅ Returning ${fallbackUris.length} URIs from artist top-tracks fallback`);
    return fallbackUris;
  } catch (err) {
    console.error("[SPOTIFY_RECS_ERROR]", err);
    return [];
  }
}


/** @deprecated Use getRelatedRecommendationUris instead */
export async function queuePersonalizedRecommendations(
  trackId: string,
  accessToken: string,
  deviceId?: string
) {
  const uris = await getRelatedRecommendationUris(trackId, accessToken, 8);
  for (const uri of uris) {
    await fetch(
      `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}${
        deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
      }`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    ).catch(() => {});
  }
}

let lastQueueRefillTime = 0;
let lastRefillTrackId = "";

/**
 * Ensures Spotify's playback queue is always populated with diverse recommendations.
 * If the queue drops below 4 tracks, it automatically enqueues 12 more fresh tracks.
 */
export async function ensureQueuePopulated(
  currentTrackId: string,
  accessToken: string,
  deviceId?: string
) {
  const now = Date.now();
  // Throttle: don't refill more often than once every 25 seconds unless track changed
  if (currentTrackId === lastRefillTrackId && now - lastQueueRefillTime < 25000) {
    return;
  }

  try {
    const queueRes = await fetch("https://api.spotify.com/v1/me/player/queue", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!queueRes.ok) return;

    const queueData = await queueRes.json().catch(() => null);
    const remainingQueue = queueData?.queue || [];

    // If less than 4 songs left in the upcoming queue, refill with 12 fresh recommendations!
    if (remainingQueue.length < 4) {
      lastQueueRefillTime = now;
      lastRefillTrackId = currentTrackId;

      console.log(`[SPOTIFY_AUTO_REFILL] Queue has only ${remainingQueue.length} tracks. Refilling 12 fresh recommendations...`);
      const newRecUris = await getRelatedRecommendationUris(currentTrackId, accessToken, 12);
      for (const uri of newRecUris) {
        await fetch(
          `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}${
            deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
          }`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        ).catch(() => {});
      }
      console.log(`[SPOTIFY_AUTO_REFILL] ✅ Successfully enqueued ${newRecUris.length} more tracks!`);
    }
  } catch (err) {
    console.warn("[SPOTIFY_AUTO_REFILL_ERROR]", err);
  }
}

export async function playTrack({
  trackUri,
  contextUri,
  uris,
  deviceId,
  autoQueueRecommendations = true,
  shuffle,
}: {
  trackUri?: string;
  contextUri?: string;
  uris?: string[];
  deviceId?: string;
  autoQueueRecommendations?: boolean;
  shuffle?: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, error: "NOT_CONNECTED", message: "Not connected to Spotify or token expired." };
  }

  // Explicitly update Spotify's shuffle mode if requested
  if (typeof shuffle === "boolean") {
    try {
      await fetch(
        `https://api.spotify.com/v1/me/player/shuffle?state=${shuffle ? "true" : "false"}${
          deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
        }`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (e) {
      console.warn("[SPOTIFY_PLAY] Could not set shuffle mode:", e);
    }
  }

  const url = `https://api.spotify.com/v1/me/player/play${deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : ""}`;
  
  let bodyPayload: any = {};

  if (uris && uris.length > 0) {
    bodyPayload.uris = uris;
  } else if (contextUri) {
    // Context URI mode (album/playlist)
    bodyPayload.context_uri = contextUri;
    if (trackUri) {
      bodyPayload.offset = { uri: trackUri };
    }
  } else if (trackUri) {
    // Single track mode: pre-fetch 30 diverse randomized recommendations
    // and send them all directly in the uris[] payload.
    // This loads the entire 30+ track radio playlist directly into Spotify's player in 1 request!
    let allUris = [trackUri];
    if (autoQueueRecommendations) {
      try {
        const recUris = await getRelatedRecommendationUris(trackUri, accessToken, 30);
        if (recUris.length > 0) {
          allUris = [trackUri, ...recUris];
          console.log(`[SPOTIFY_PLAY] ✅ Playing track with ${recUris.length} diverse recommendations in player queue`);
        }
      } catch (e) {
        console.warn("[SPOTIFY_PLAY] Failed to fetch recommendations, playing single track:", e);
      }
    }
    bodyPayload.uris = allUris;
  }

  try {
    let res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: Object.keys(bodyPayload).length > 0 ? JSON.stringify(bodyPayload) : undefined,
    });

    // Fallback: If context playback fails with offset issue, play track directly with recommendations
    if (!res.ok && contextUri && trackUri) {
      const fallbackUris = [trackUri];
      res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: fallbackUris }),
      });
    }

    if (res.status === 204 || res.ok) {
      if (trackUri) {
        lastRefillTrackId = trackUri.replace("spotify:track:", "");
        lastQueueRefillTime = Date.now();
      }
      return { success: true, message: "Playback started." };
    }




    const errText = await res.text();
    let parsedErr: any = null;
    try {
      parsedErr = JSON.parse(errText);
    } catch {}

    const reason = parsedErr?.error?.reason;
    const msg = parsedErr?.error?.message || errText;

    if (
      res.status === 404 ||
      res.status === 403 ||
      reason === "NO_ACTIVE_DEVICE" ||
      msg?.toLowerCase().includes("no active device")
    ) {
      return {
        success: false,
        error: "NO_ACTIVE_DEVICE",
        message: "No active Spotify device found. Please open Spotify on your device first.",
      };
    }

    if (res.status === 403 && (reason === "PREMIUM_REQUIRED" || msg?.toLowerCase().includes("premium"))) {
      return {
        success: false,
        error: "PREMIUM_REQUIRED",
        message: "Spotify Premium is required for direct remote playback control.",
      };
    }

    return {
      success: false,
      error: "PLAYBACK_ERROR",
      message: msg || `Failed to start playback (status ${res.status}).`,
    };
  } catch (err: any) {
    console.error("[SPOTIFY_PLAY_ERROR]", err);
    return {
      success: false,
      error: "NETWORK_ERROR",
      message: err.message || "Network error while connecting to Spotify.",
    };
  }
}

export async function setShuffle(
  state: boolean = true,
  deviceId?: string
): Promise<{ success: boolean; state?: boolean; message?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { success: false, message: "Not connected to Spotify or token expired." };
  }

  const url = `https://api.spotify.com/v1/me/player/shuffle?state=${state ? "true" : "false"}${
    deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
  }`;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 204 || res.ok) {
      return { success: true, state };
    }

    const errText = await res.text();
    return { success: false, message: errText || "Failed to set shuffle mode." };
  } catch (err: any) {
    return { success: false, message: err.message || "Network error" };
  }
}

export async function getQueue(): Promise<{
  success: boolean;
  currentlyPlaying: SpotifyTrackResult | null;
  manualQueue: SpotifyTrackResult[];
  nextUp: SpotifyTrackResult[];
  queue: SpotifyTrackResult[];
  error?: string;
}> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      currentlyPlaying: null,
      manualQueue: [],
      nextUp: [],
      queue: [],
      error: "NOT_CONNECTED",
    };
  }

  try {
    const [queueRes, playerRes] = await Promise.all([
      fetch("https://api.spotify.com/v1/me/player/queue", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
      fetch("https://api.spotify.com/v1/me/player", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }),
    ]);

    if (!queueRes.ok) {
      return {
        success: false,
        currentlyPlaying: null,
        manualQueue: [],
        nextUp: [],
        queue: [],
        error: `Failed to fetch queue (${queueRes.status})`,
      };
    }

    const data = await queueRes.json().catch(() => null);
    const playerData = playerRes.ok ? await playerRes.json().catch(() => null) : null;

    const mapTrack = (item: any): SpotifyTrackResult => ({
      id: item?.id || "",
      name: item?.name || "Unknown Track",
      artists: item?.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
      albumName: item?.album?.name || "Unknown Album",
      albumUri: item?.album?.uri || "",
      imageUrl: item?.album?.images?.[0]?.url || "",
      durationMs: item?.duration_ms || 0,
      uri: item?.uri || "",
      externalUrl: item?.external_urls?.spotify || "",
    });

    const currentlyPlaying = data?.currently_playing ? mapTrack(data.currently_playing) : null;
    const rawQueue: SpotifyTrackResult[] = Array.isArray(data?.queue) ? data.queue.map(mapTrack) : [];

    // No heuristic splitting — Spotify's API provides a flat queue with no reliable
    // way to distinguish "manually queued" from "auto-radio / context" tracks.
    // We expose the entire queue as-is.
    return {
      success: true,
      currentlyPlaying,
      manualQueue: [],
      nextUp: rawQueue,
      queue: rawQueue,
    };

  } catch (err: any) {
    console.error("[SPOTIFY_GET_QUEUE_ERROR]", err);
    return {
      success: false,
      currentlyPlaying: null,
      manualQueue: [],
      nextUp: [],
      queue: [],
      error: err.message || "Network error fetching queue",
    };
  }
}
