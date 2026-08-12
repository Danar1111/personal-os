import { NextRequest } from "next/server";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  return data.access_token || null;
}

export async function getNowPlaying() {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return { isPlaying: false, error: "No access token" };
  }

  return fetch(NOW_PLAYING_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    next: { revalidate: 0 },
  });
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
