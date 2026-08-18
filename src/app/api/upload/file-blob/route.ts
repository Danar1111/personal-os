import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const { path: fileUrlOrPath } = await req.json();

    if (!fileUrlOrPath || typeof fileUrlOrPath !== "string") {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
    }

    // Sanitize path to prevent directory traversal
    let relativePath = fileUrlOrPath;
    if (relativePath.startsWith("/")) {
      relativePath = relativePath.substring(1);
    }

    // Normalize slashes
    relativePath = relativePath.replace(/\\/g, "/");

    const fullPath = path.join(process.cwd(), "public", relativePath);

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: "File not found on server disk" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error reading file binary:", error);
    return NextResponse.json({ error: "Failed to read file binary" }, { status: 500 });
  }
}
