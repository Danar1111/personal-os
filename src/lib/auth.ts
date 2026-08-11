import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export function sanitizePin(val?: string | null): string | null {
  if (!val) return null;
  const cleaned = val.replace(/^["']|["']$/g, "").replace(/\r/g, "").trim();
  return cleaned || null;
}

export async function getStoredPin(): Promise<string | null> {
  let pin = sanitizePin(process.env.ACCESS_PIN) || sanitizePin(process.env.PIN) || sanitizePin(process.env.ACCESS_PASSWORD);
  if (!pin) {
    try {
      const [row] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "access_pin"));
      pin = sanitizePin(row?.value);
    } catch (e) {
      console.warn("Could not read systemSettings for access_pin:", e);
    }
  }
  return pin;
}

export async function createSessionHash(pin: string): Promise<string> {
  const secret = process.env.SESSION_SECRET || "personal_os_super_secret_auth_key_2026";
  const encoder = new TextEncoder();
  const data = encoder.encode(`${secret}:${pin}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  
  // First check env ACCESS_PIN (fast, edge-compatible)
  const envPin = sanitizePin(process.env.ACCESS_PIN) || sanitizePin(process.env.PIN) || sanitizePin(process.env.ACCESS_PASSWORD);
  let pin = envPin;

  if (!pin) {
    // DB fallback
    pin = await getStoredPin();
  }

  if (!pin) return true; // If no PIN configured anywhere, allow access

  const expectedHash = await createSessionHash(pin);
  return token === expectedHash;
}
