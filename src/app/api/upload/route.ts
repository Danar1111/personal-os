import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max timeout

export async function POST(req: Request) {
  try {
    let fileName = "file";
    let mimeType = "application/octet-stream";
    let isStreamUpload = false;

    const contentType = req.headers.get("content-type") || "";
    const headerFileName = req.headers.get("x-file-name");

    if (headerFileName) {
      fileName = decodeURIComponent(headerFileName);
      mimeType = req.headers.get("x-file-type") || contentType || mimeType;
      isStreamUpload = true;
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitizedName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    let fileSize = 0;

    if (isStreamUpload && req.body) {
      // Direct binary stream writing for large files
      const writeStream = fs.createWriteStream(filePath);
      // Convert Web ReadableStream to Node Readable
      const nodeStream = Readable.fromWeb(req.body as any);
      await pipeline(nodeStream, writeStream);
      const stat = fs.statSync(filePath);
      fileSize = stat.size;
    } else if (contentType.includes("multipart/form-data")) {
      // Standard FormData upload fallback
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file found in form data" },
          { status: 400 }
        );
      }

      fileName = file.name || fileName;
      mimeType = file.type || mimeType;
      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, fileBuffer);
      fileSize = fileBuffer.length;
    } else if (req.body) {
      // Raw body binary fallback
      const writeStream = fs.createWriteStream(filePath);
      const nodeStream = Readable.fromWeb(req.body as any);
      await pipeline(nodeStream, writeStream);
      const stat = fs.statSync(filePath);
      fileSize = stat.size;
    } else {
      return NextResponse.json(
        { success: false, error: "No binary payload received." },
        { status: 400 }
      );
    }

    const publicUrl = `/uploads/${uniqueFileName}`;

    let assetType: "pdf" | "image" | "video" = "pdf";
    const lowerName = fileName.toLowerCase();
    const ext = lowerName.split(".").pop() || "";

    if (
      mimeType.startsWith("image/") ||
      ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "ico"].includes(ext)
    ) {
      assetType = "image";
    } else if (
      mimeType.startsWith("video/") ||
      ["mp4", "webm", "mkv", "mov", "avi", "wmv", "flv"].includes(ext)
    ) {
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
