import { NextRequest, NextResponse } from "next/server";
import { getGoogleRefreshToken, getDriveClient } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const refreshToken = await getGoogleRefreshToken();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Google Drive not connected" },
        { status: 401 }
      );
    }

    const drive = await getDriveClient(req);
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim();

    let qClause = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";
    if (query) {
      const sanitized = query.replace(/'/g, "\\'");
      qClause += ` and name contains '${sanitized}'`;
    }

    // 1. Fetch matching folders from Google Drive API using search query
    const response = await drive.files.list({
      pageSize: 100,
      q: qClause,
      orderBy: "name asc",
      fields: "files(id, name, parents, modifiedTime)",
    });

    const matchingFolders = response.data.files || [];

    // Collect all parent IDs to resolve their names in one shot
    const parentIdsToFetch = new Set<string>();
    matchingFolders.forEach((f) => {
      if (f.parents && f.parents.length > 0) {
        f.parents.forEach((pid) => {
          if (pid && pid !== "root") parentIdsToFetch.add(pid);
        });
      }
    });

    // 2. Fetch parent folder names concurrently
    const parentNameMap = new Map<string, string>();
    if (parentIdsToFetch.size > 0) {
      await Promise.all(
        Array.from(parentIdsToFetch).slice(0, 40).map(async (pid) => {
          try {
            const pRes = await drive.files.get({
              fileId: pid,
              fields: "id, name",
            });
            if (pRes.data.id && pRes.data.name) {
              parentNameMap.set(pRes.data.id, pRes.data.name);
            }
          } catch {}
        })
      );
    }

    const allFolders: Array<{ id: string; name: string; path: string }> = [];

    // Prepend Root (My Drive) if no query or if "root" / "my drive" matches query
    if (!query || "root".includes(query.toLowerCase()) || "my drive".includes(query.toLowerCase())) {
      allFolders.push({
        id: "root",
        name: "Root (My Drive)",
        path: "My Drive",
      });
    }

    matchingFolders.forEach((f) => {
      if (f.id && f.name) {
        let parentName = "My Drive";
        if (f.parents && f.parents.length > 0) {
          const pid = f.parents[0];
          if (pid && pid !== "root" && parentNameMap.has(pid)) {
            parentName = `My Drive > ${parentNameMap.get(pid)}`;
          }
        }
        allFolders.push({
          id: f.id,
          name: f.name,
          path: `${parentName} > ${f.name}`,
        });
      }
    });

    return NextResponse.json({ folders: allFolders });
  } catch (error: any) {
    console.error("[DRIVE_FOLDERS_API_ERROR]", error);
    const status = error.code === 401 || error.status === 401 ? 401 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to fetch Google Drive folders" },
      { status }
    );
  }
}
