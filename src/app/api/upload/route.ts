import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename to avoid collisions or invalid characters
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${Date.now()}-${sanitizedName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${uniqueFileName}`;

    // Infer asset type
    let assetType: "pdf" | "image" | "video" = "pdf";
    if (file.type.startsWith("image/")) {
      assetType = "image";
    } else if (file.type.startsWith("video/")) {
      assetType = "video";
    } else if (file.type.includes("pdf")) {
      assetType = "pdf";
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      originalName: file.name,
      size: file.size,
      type: assetType,
    });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
