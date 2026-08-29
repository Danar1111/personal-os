import { NextRequest, NextResponse } from "next/server";
import { getGoogleRefreshToken, getDriveClient } from "@/lib/google";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!fileId) {
    return new NextResponse("Missing file ID", { status: 400 });
  }

  try {
    const refreshToken = await getGoogleRefreshToken();
    if (!refreshToken) {
      // Fallback redirect to Google's public thumbnail link if token not set
      return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
    }

    const drive = await getDriveClient(req);

    // 1. Get file metadata
    const meta = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size",
    });

    const mimeType = meta.data.mimeType || "image/jpeg";

    // 2. Fetch the file media stream
    const mediaRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    const nodeStream = mediaRes.data as unknown as Readable;
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(meta.data.name || fileId)}"`,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (error: any) {
    console.error("[Drive Preview API Error]:", error?.message || error);
    // Graceful fallback to lh3 thumbnail
    return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}=w1600`);
  }
}
