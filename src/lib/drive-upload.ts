/**
 * Client-Side Direct Resumable Upload to Google Drive API v3
 * 
 * Bypasses Next.js server payload limits and streams files directly from the browser
 * with accurate XMLHttpRequest progress tracking.
 */

export interface ResumableUploadOptions {
  file: Blob | File;
  fileName: string;
  accessToken: string;
  folderId?: string;
  onProgress?: (percent: number) => void;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
}

export async function uploadFileToDrive({
  file,
  fileName,
  accessToken,
  folderId,
  onProgress,
}: ResumableUploadOptions): Promise<DriveUploadResult> {
  // Determine MIME type
  const mimeType = file.type || "application/octet-stream";
  const fileSize = file.size;

  // Metadata for Google Drive file
  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };

  if (folderId && folderId !== "root") {
    metadata.parents = [folderId];
  }

  // 1. Initialize Resumable Upload Session
  const initResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": fileSize.toString(),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initResponse.ok) {
    const errBody = await initResponse.text().catch(() => "");
    throw new Error(`Google Drive Resumable Upload Init failed (${initResponse.status}): ${errBody}`);
  }

  // Extract session upload URL from Location header
  const uploadUrl = initResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("No Location header returned from Google Drive Resumable Init");
  }

  // 2. Stream Binary to Resumable Session via XMLHttpRequest to track accurate progress
  return new Promise<DriveUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);

    xhr.setRequestHeader("Content-Type", mimeType);

    // Track upload progress
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const resJson = JSON.parse(xhr.responseText);
          onProgress?.(100);
          resolve({
            id: resJson.id,
            name: resJson.name || fileName,
            mimeType: resJson.mimeType || mimeType,
            webViewLink: resJson.webViewLink || `https://drive.google.com/file/d/${resJson.id}/view`,
          });
        } catch {
          resolve({
            id: "unknown",
            name: fileName,
          });
        }
      } else {
        reject(
          new Error(
            `Google Drive Upload failed with status ${xhr.status}: ${xhr.responseText || xhr.statusText}`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during direct Google Drive upload."));
    };

    xhr.onabort = () => {
      reject(new Error("Google Drive upload was aborted."));
    };

    xhr.send(file);
  });
}
