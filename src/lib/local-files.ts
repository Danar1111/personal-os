import fs from "fs";
import path from "path";

export interface LocalFile {
  name: string;
  path: string;
  size: number;
  modifiedTime: string;
  extension: string;
}

export function getLocalFiles(): LocalFile[] {
  try {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(uploadsDir);
    const result: LocalFile[] = [];

    for (const fileName of files) {
      const fullPath = path.join(uploadsDir, fileName);

      try {
        const stats = fs.statSync(fullPath);

        if (stats.isFile()) {
          const ext = path.extname(fileName).toLowerCase().replace(".", "");
          result.push({
            name: fileName,
            path: `/uploads/${fileName}`,
            size: stats.size,
            modifiedTime: stats.mtime.toISOString(),
            extension: ext || "file",
          });
        }
      } catch (statError) {
        console.warn(`[LocalFiles] Failed to read stat for ${fileName}:`, statError);
      }
    }

    // Sort by modified time descending (newest first)
    result.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());

    return result;
  } catch (error) {
    console.error("[LocalFiles] Error reading uploads directory:", error);
    return [];
  }
}
