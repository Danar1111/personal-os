import { NextResponse } from "next/server";
import { poolConnection } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  try {
    await poolConnection.query("SELECT 1 AS ping");
    const latencyMs = Date.now() - startTime;
    return NextResponse.json({
      connected: true,
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[DB_HEALTH_CHECK_ERROR]", error);
    return NextResponse.json(
      {
        connected: false,
        error: error?.message || "Database connection failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
