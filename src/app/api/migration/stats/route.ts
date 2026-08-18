import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getDirectoryStats(dirPath: string): { fileCount: number; totalSizeBytes: number } {
  let fileCount = 0;
  let totalSizeBytes = 0;

  if (!fs.existsSync(dirPath)) {
    return { fileCount, totalSizeBytes };
  }

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        fileCount++;
        try {
          const stat = fs.statSync(fullPath);
          totalSizeBytes += stat.size;
        } catch {
          // ignore read errors
        }
      }
    }
  }

  walk(dirPath);
  return { fileCount, totalSizeBytes };
}

export async function GET() {
  try {
    // 1. DYNAMIC TABLE DISCOVERY via SHOW TABLES
    const [tablesResult]: any = await db.execute(sql.raw("SHOW TABLES;"));
    const tableNames: string[] = Array.isArray(tablesResult)
      ? tablesResult.map((row: any) => Object.values(row)[0] as string)
      : [];

    const tableCounts: Record<string, number> = {};
    let totalDbRows = 0;

    // 2. Dynamically count rows for each discovered table
    for (const tableName of tableNames) {
      try {
        const [cntRes]: any = await db.execute(
          sql.raw(`SELECT COUNT(*) as count FROM \`${tableName}\`;`)
        );
        const count = Number(cntRes[0]?.count || 0);
        tableCounts[tableName] = count;
        totalDbRows += count;
      } catch (countErr) {
        console.warn(`[Stats Warning] Could not count table ${tableName}:`, countErr);
        tableCounts[tableName] = 0;
      }
    }

    // 3. Storage directory statistics (/public/uploads)
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const { fileCount, totalSizeBytes } = getDirectoryStats(uploadsDir);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      tablesCount: tableNames.length,
      tableCounts,
      totalDbRows,
      uploads: {
        fileCount,
        totalSizeBytes,
        totalSizeMB,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Migration Stats API Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch migration stats" },
      { status: 500 }
    );
  }
}
