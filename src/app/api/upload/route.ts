import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let fileName = "file";
    let fileSize = 0;
    let fileBuffer: Buffer | null = null;
    let mimeType = "application/octet-stream";

    const contentType = req.headers.get("content-type") || "";

    // Strategy 1: Try parsing standard multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (file) {
          fileName = file.name || fileName;
          fileSize = file.size;
          mimeType = file.type || mimeType;
          const arrayBuffer = await file.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        }
      } catch (formErr: any) {
        console.warn("[Upload API] FormData parsing failed, attempting binary fallback:", formErr?.message);
      }
    }

    // Strategy 2: Fallback to direct binary payload (X-File-Name header)
    if (!fileBuffer || fileBuffer.length === 0) {
      const headerFileName = req.headers.get("x-file-name");
      if (headerFileName) {
        fileName = decodeURIComponent(headerFileName);
      }
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        fileBuffer = Buffer.from(arrayBuffer);
        fileSize = fileBuffer.length;
        mimeType = req.headers.get("x-file-type") || contentType || mimeType;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "No file binary data received or failed to parse form data." },
        { status: 400 }
      );
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitizedName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    fs.writeFileSync(filePath, fileBuffer);

    const publicUrl = `/uploads/${uniqueFileName}`;

    let assetType: "pdf" | "image" | "video" = "pdf";
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split(".").pop() || "";

    if (mimeType.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "ico"].includes(ext)) {
      assetType = "image";
    } else if (mimeType.startsWith("video/") || ["mp4", "webm", "mkv", "mov", "avi", "wmv", "flv"].includes(ext)) {
      assetType = "video";
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      originalName: fileName,
      size: fileSize,
      type: assetType,
    });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process file upload" },
      { status: 500 }
    );
  }
}
