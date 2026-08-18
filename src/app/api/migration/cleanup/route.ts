import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { tempId } = await req.json();

    if (!tempId) {
      return NextResponse.json({ success: true, message: "No tempId provided" });
    }

    // Ensure tempId doesn't contain directory traversal sequences
    if (tempId.includes("/") || tempId.includes("\\") || tempId.includes("..")) {
        return NextResponse.json({ success: false, error: "Invalid tempId" }, { status: 400 });
    }

    const projectTempPath = path.join(process.cwd(), ".tmp_migrations", tempId);
    const osTempPath = path.join(os.tmpdir(), tempId);
    const tempPath = fs.existsSync(projectTempPath) ? projectTempPath : osTempPath;
    
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
      return NextResponse.json({ success: true, message: "Cleaned up temporary directory" });
    }

    return NextResponse.json({ success: true, message: "File already cleaned up or not found" });
  } catch (error: any) {
    console.error("[CLEANUP_BACKUP_ERROR]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cleanup backup file" },
      { status: 500 }
    );
  }
}
