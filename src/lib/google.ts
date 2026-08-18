import { NextRequest } from "next/server";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive",
];

export function getGoogleRedirectUri(req?: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI?.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }

  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
    return `${baseUrl}/api/google/callback`;
  }

  if (process.env.VERCEL_URL?.trim()) {
    const baseUrl = `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
    return `${baseUrl}/api/google/callback`;
  }

  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "127.0.0.1:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      const cleanHost = host.replace("localhost", "127.0.0.1");
      return `http://${cleanHost}/api/google/callback`;
    }

    return `${proto}://${host}/api/google/callback`;
  }

  return "http://127.0.0.1:3000/api/google/callback";
}

export function getGoogleOAuth2Client(req?: NextRequest): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = getGoogleRedirectUri(req);

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleAuthUrl(req?: NextRequest): string {
  const oauth2Client = getGoogleOAuth2Client(req);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
  });
}

export async function getGoogleRefreshToken(): Promise<string | null> {
  const envToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const record = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "GOOGLE_REFRESH_TOKEN"))
      .limit(1);

    if (record.length > 0 && record[0].value) {
      return record[0].value.trim();
    }
  } catch (error) {
    console.error("[getGoogleRefreshToken DB query failed]:", error);
  }

  return null;
}

export async function saveGoogleRefreshToken(token: string): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "GOOGLE_REFRESH_TOKEN"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(systemSettings)
        .set({
          value: token,
          isSecret: true,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, "GOOGLE_REFRESH_TOKEN"));
    } else {
      await db.insert(systemSettings).values({
        key: "GOOGLE_REFRESH_TOKEN",
        value: token,
        isSecret: true,
      });
    }
  } catch (error) {
    console.error("[saveGoogleRefreshToken DB persist error]:", error);
  }
}

export function setGoogleCredentials(refreshToken: string, req?: NextRequest): OAuth2Client {
  const oauth2Client = getGoogleOAuth2Client(req);
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // Auto-listen for token rotations / renewals and persist newly minted refresh tokens
  oauth2Client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      saveGoogleRefreshToken(tokens.refresh_token).catch((err) =>
        console.error("[Google OAuth2 auto-rotation persist error]:", err)
      );
    }
  });

  return oauth2Client;
}

export async function getDriveClient(req?: NextRequest) {
  const refreshToken = await getGoogleRefreshToken();
  if (!refreshToken) {
    throw new Error("Google Drive is not connected. Missing GOOGLE_REFRESH_TOKEN.");
  }

  const oauth2Client = setGoogleCredentials(refreshToken, req);
  return google.drive({ version: "v3", auth: oauth2Client });
}
