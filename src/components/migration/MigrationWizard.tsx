"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  UploadCloud,
  Database,
  FileArchive,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Folder,
  Search,
  ExternalLink,
  Check,
  Cloud,
  FileText,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MigrationStats {
  tablesCount: number;
  tableCounts: Record<string, number>;
  totalDbRows: number;
  uploads: {
    fileCount: number;
    totalSizeBytes: number;
    totalSizeMB: string;
  };
  timestamp: string;
}

interface DriveFolder {
  id: string;
  name: string;
  path: string;
}

interface DriveBackupFile {
  id: string;
  name: string;
  sizeDisplay: string;
  modifiedTime: string;
  webViewLink?: string;
}

interface MigrationWizardProps {
  mode?: "export" | "import";
  trigger?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MigrationWizard({
  mode = "export",
  trigger,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
}: MigrationWizardProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const setIsOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalIsOpen;

  // EXPORT STEPS: 1 = Keterangan, 2 = Informasi Data (Stats), 3 = Destination Choice, 4 = Processing/Result
  const [exportStep, setExportStep] = useState<1 | 2 | 3 | 4>(1);

  // IMPORT STEPS: 1 = Keterangan & Source Choice, 2 = Validation, 3 = Danger Confirmation, 4 = Processing/Result
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState<{
    percentage: number;
    statusText: string;
  } | null>(null);
  const [importValidationData, setImportValidationData] = useState<{
    fileName: string;
    tempId: string;
    tablesCount: number;
    tableCounts: Record<string, number>;
    totalDbRows: number;
    uploads: { fileCount: number; totalSizeBytes: number; totalSizeMB: string };
  } | null>(null);

  // EXPORT DESTINATION: 'local' | 'gdrive'
  const [exportDestination, setExportDestination] = useState<"local" | "gdrive">("local");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("root");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("My Drive (Root)");
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [gdriveConnected, setGdriveConnected] = useState<boolean | null>(null);

  // IMPORT SOURCE: 'local' | 'gdrive'
  const [importSource, setImportSource] = useState<"local" | "gdrive">("local");
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string | null>(null);
  const [selectedDriveFileName, setSelectedDriveFileName] = useState<string | null>(null);
  const [driveBackupsSearch, setDriveBackupsSearch] = useState("");
  const [driveBackupFiles, setDriveBackupFiles] = useState<DriveBackupFile[]>([]);
  const [isLoadingDriveBackups, setIsLoadingDriveBackups] = useState(false);

  // Stats & Execution States
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportDriveResult, setExportDriveResult] = useState<{ id: string; name: string; webViewLink?: string } | null>(null);

  // Import States
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);

  // Error & Drag States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isProcessing = isExporting || isRestoring;

  // Reset & Initialize on Modal Open / Cleanup on Close
  const prevIsOpenRef = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Modal just opened: reset all wizard states to clean defaults
      setErrorMsg(null);
      setExportDone(false);
      setRestoreDone(false);
      setConfirmText("");
      setExportDriveResult(null);
      setImportFile(null);
      setSelectedDriveFileId(null);
      setSelectedDriveFileName(null);
      setDriveBackupsSearch("");
      setImportValidationData(null);
      setImportSource("local");
      setExportDestination("local");

      if (mode === "export") {
        setExportStep(1);
      } else {
        setImportStep(1);
      }
    } else if (!isOpen && prevIsOpenRef.current) {
      // Modal just closed: cleanup temporary files and reset selections
      if (importValidationData?.tempId) {
        fetch("/api/migration/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempId: importValidationData.tempId }),
        }).catch(console.error);
      }
      setImportValidationData(null);
      setImportFile(null);
      setSelectedDriveFileId(null);
      setSelectedDriveFileName(null);
      setDriveBackupsSearch("");
      setConfirmText("");
      setErrorMsg(null);
      setImportStep(1);
      setExportStep(1);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, mode, importValidationData]);

  // Fetch Migration Stats
  const fetchStats = async () => {
    setIsLoadingStats(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/migration/stats");
      if (!res.ok) throw new Error("Failed to fetch migration statistics.");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load database stats.");
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load database statistics");
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch Google Drive Folders
  const fetchDriveFolders = async (query = "") => {
    setIsLoadingFolders(true);
    try {
      const res = await fetch(`/api/drive/folders?q=${encodeURIComponent(query)}`);
      if (res.status === 401) {
        setGdriveConnected(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch Google Drive folders");
      const data = await res.json();
      setDriveFolders(data.folders || []);
      setGdriveConnected(true);
    } catch (err: any) {
      console.error(err);
      setGdriveConnected(false);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Fetch Google Drive Backup ZIP files
  const fetchDriveBackups = async (query = "") => {
    setIsLoadingDriveBackups(true);
    try {
      const res = await fetch(`/api/drive/backups?q=${encodeURIComponent(query)}`);
      if (res.status === 401) {
        setGdriveConnected(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch Google Drive backup files");
      const data = await res.json();
      setDriveBackupFiles(data.files || []);
      setGdriveConnected(true);
    } catch (err: any) {
      console.error(err);
      setGdriveConnected(false);
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  // Load Google Drive resources when entering relevant steps
  useEffect(() => {
    if (exportDestination === "gdrive" && mode === "export" && exportStep === 3) {
      fetchDriveFolders(folderSearchQuery);
    }
  }, [exportDestination, folderSearchQuery, mode, exportStep]);

  useEffect(() => {
    if (importSource === "gdrive" && mode === "import" && importStep === 1) {
      fetchDriveBackups(driveBackupsSearch);
    }
  }, [importSource, driveBackupsSearch, mode, importStep]);

  const handleNextToStats = () => {
    setExportStep(2);
    fetchStats();
  };

  // Execute Export Action
  const handleStartExport = async () => {
    setIsExporting(true);
    setExportStep(4);
    setErrorMsg(null);

    try {
      if (exportDestination === "gdrive") {
        const res = await fetch(`/api/migration/export?destination=gdrive&folderId=${encodeURIComponent(selectedFolderId)}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to upload export file to Google Drive.");
        }
        setExportDriveResult(data.driveFile);
        setExportDone(true);
      } else {
        // Stream download to Local PC
        const res = await fetch("/api/migration/export?destination=local");
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to export backup archive.");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const disposition = res.headers.get("content-disposition");

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        let fileName = `PersonalOS_Backup_${yyyy}${mm}${dd}_${hh}${min}.zip`;
        if (disposition && disposition.includes("filename=")) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) fileName = match[1];
        }

        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setExportDone(true);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Export process failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Import Local File Selection
  const handleFileChange = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErrorMsg("Please select a valid .zip backup archive file.");
      return;
    }
    setImportFile(file);
    setErrorMsg(null);
  };

  // Execute Import Validation with Real-time Progress Tracking
  const handleImportValidation = async () => {
    if (importSource === "local" && !importFile) return;
    if (importSource === "gdrive" && !selectedDriveFileId) return;

    setIsValidating(true);
    setImportValidationData(null);
    setErrorMsg(null);
    setValidationProgress({ percentage: 5, statusText: "Connecting to server..." });
    
    try {
      if (importSource === "gdrive") {
        // Google Drive validation using SSE stream reader
        const res = await fetch("/api/migration/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driveFileId: selectedDriveFileId, fileName: selectedDriveFileName }),
        });

        if (!res.ok) {
          throw new Error("Failed to connect to validation server.");
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalData: any = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const payload = JSON.parse(line.replace(/^data:\s*/, ""));
                  if (payload.step === "error") {
                    throw new Error(payload.error || "Validation error");
                  }
                  if (payload.message) {
                    setValidationProgress({
                      percentage: payload.progress ?? 50,
                      statusText: payload.message,
                    });
                  }
                  if (payload.step === "done" && payload.data) {
                    finalData = payload.data;
                  }
                } catch (parseErr: any) {
                  if (parseErr.message !== "Unexpected end of JSON input") {
                    throw parseErr;
                  }
                }
              }
            }
          }
        }

        if (!finalData) {
          throw new Error("Validation ended without result data.");
        }

        setImportValidationData(finalData);
        setImportStep(2); // Go to Validation view
      } else {
        // Local upload using XMLHttpRequest for accurate upload progress
        const formData = new FormData();
        formData.append("file", importFile!);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/migration/validate");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 75);
              const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
              const totalMB = (e.total / (1024 * 1024)).toFixed(1);
              setValidationProgress({
                percentage: pct,
                statusText: `Uploading: ${loadedMB} MB / ${totalMB} MB (${pct}%)`,
              });
            }
          };

          xhr.upload.onload = () => {
            setValidationProgress({
              percentage: 85,
              statusText: "Unzipping & analyzing backup on server...",
            });
          };

          xhr.onload = () => {
            try {
              const json = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300 && json.success) {
                setValidationProgress({ percentage: 100, statusText: "Complete!" });
                setImportValidationData(json.data);
                setImportStep(2);
                resolve();
              } else {
                reject(new Error(json.error || "Validation failed on server"));
              }
            } catch (err: any) {
              reject(new Error("Failed to parse server response"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during file upload."));
          xhr.send(formData);
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Validation failed: ${err.message}`);
    } finally {
      setIsValidating(false);
      setValidationProgress(null);
    }
  };

  const handleCancelValidation = async () => {
    if (importValidationData?.tempId) {
      // Fire and forget cleanup
      fetch("/api/migration/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempId: importValidationData.tempId }),
      }).catch(console.error);
      
      setImportValidationData(null);
    }
    setImportStep(1);
    setConfirmText("");
  };

  // Execute Restore Action
  const handleStartRestore = async () => {
    if (!importValidationData?.tempId) {
      setErrorMsg("Validation data missing. Please go back and re-select the file.");
      return;
    }
    if (confirmText.trim() !== "RESTORE") {
      setErrorMsg("Please type 'RESTORE' to confirm the operation.");
      return;
    }

    setIsRestoring(true);
    setImportStep(4);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/migration/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempId: importValidationData.tempId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to restore backup archive.");
      }

      setRestoreDone(true);
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Restore operation failed. Please check server logs.");
      setImportStep(3); // Go back to Danger Confirmation on error
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      {trigger && (
        React.isValidElement(trigger)
          ? React.cloneElement(trigger as React.ReactElement<any>, {
              onClick: (e: React.MouseEvent) => {
                setIsOpen(true);
                if ((trigger.props as any).onClick) {
                  (trigger.props as any).onClick(e);
                }
              },
            })
          : (
            <span
              role="button"
              tabIndex={0}
              onClick={() => setIsOpen(true)}
              onKeyDown={(e) => e.key === "Enter" && setIsOpen(true)}
              style={{ display: "contents" }}
            >
              {trigger}
            </span>
          )
      )}

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!isProcessing) {
            setIsOpen(open);
          }
        }}
      >

      <DialogContent
        showCloseButton={!isProcessing}
        className={cn(
          "bg-[#0e0e1a]/95 border border-white/15 text-slate-100 rounded-3xl max-w-2xl p-6 shadow-2xl backdrop-blur-2xl font-mono space-y-4",
          mode === "import" && "border-amber-500/40 shadow-amber-500/10"
        )}
      >
        {/* Isolated Header */}
        <DialogHeader className="flex flex-row items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "p-2 rounded-2xl border",
                mode === "export"
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              )}
            >
              {mode === "export" ? <Download className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white font-mono flex items-center gap-2 uppercase tracking-wide">
                <span>{mode === "export" ? "EXPORT BACKUP WIZARD" : "RESTORE BACKUP WIZARD"}</span>
              </DialogTitle>
              <p className="text-[11px] text-slate-400 font-mono">
                {mode === "export"
                  ? `Step ${exportStep} of 4: ${
                      exportStep === 1
                        ? "Overview & Details"
                        : exportStep === 2
                        ? "Inspect Database Data"
                        : exportStep === 3
                        ? "Select Destination"
                        : "Processing Export"
                    }`
                  : `Step ${importStep} of 4: ${
                      importStep === 1
                        ? "Overview & Select Source"
                        : importStep === 2
                        ? "Validation Results"
                        : importStep === 3
                        ? "Danger Confirmation"
                        : "Processing Restore"
                    }`}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Migration Error:</span>
              <p className="text-[11px] text-rose-200/90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODE 1: DEDICATED EXPORT WIZARD (4 STEPS)
        ═══════════════════════════════════════════════════════════════════ */}
        {mode === "export" && (
          <div className="space-y-4">
            {/* STEP 1: OVERVIEW & KETERANGAN */}
            {exportStep === 1 && (
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase">Overview Backup Data System</h4>
                      <p className="text-[11px] text-slate-400">
                        Penjelasan proses ekspor dan pencadangan sistem Personal OS.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 font-sans leading-relaxed">
                    <p>
                      Wizard ini akan mengompresi dan mengekspor seluruh data sistem Anda ke dalam satu berkas terkompresi <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">PersonalOS_Backup_*.zip</code>.
                    </p>
                    <ul className="text-[11px] text-slate-300 space-y-1.5 pl-4 list-disc font-mono">
                      <li><strong>Database MySQL Dump:</strong> Mengekspor seluruh baris data dari 17+ tabel secara otomatis ke file <code className="text-indigo-300">database.json</code>.</li>
                      <li><strong>Local Media Storage:</strong> Membundel seluruh foto, PDF, dan dokumen di <code className="text-emerald-300">/public/uploads</code>.</li>
                      <li><strong>Dynamic Auto-Discovery:</strong> Tabel baru yang ditambahkan di masa depan akan otomatis ikut ter-backup tanpa ubah kode.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl text-xs h-10 px-4 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNextToStats}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <span>Next: Inspect Database Stats</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: INFORMASI DATA (STATS) */}
            {exportStep === 2 && (
              <div className="space-y-4">
                {isLoadingStats ? (
                  <div className="p-8 text-center space-y-3">
                    <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 font-mono">Discovering database tables and measuring media storage...</p>
                  </div>
                ) : stats ? (
                  <div className="space-y-3">
                    {/* Top Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                        <div className="flex items-center justify-between text-indigo-300 text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5" /> Database Records
                          </span>
                          <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px]">
                            {stats.tablesCount} Tables
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-white">{stats.totalDbRows} Total Rows</p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                        <div className="flex items-center justify-between text-emerald-300 text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5" /> Storage Size
                          </span>
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                            {stats.uploads.fileCount} Files
                          </Badge>
                        </div>
                        <p className="text-lg font-bold text-white">{stats.uploads.totalSizeMB} MB</p>
                      </div>
                    </div>

                    {/* DYNAMIC DATABASE TABLES GRID */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Discovered MySQL Tables ({stats.tablesCount}):
                        </span>
                        <Badge variant="outline" className="border-white/10 text-slate-400 text-[10px]">
                          100% Dynamic Schema
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-[11px] max-h-44 overflow-y-auto pr-1">
                        {Object.entries(stats.tableCounts).map(([tblName, rowCnt]) => (
                          <div key={tblName} className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
                            <span className="text-slate-400 block text-[10px] truncate font-mono" title={tblName}>
                              {tblName}
                            </span>
                            <span className="font-bold text-white">{rowCnt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setExportStep(1)}
                        className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl text-xs h-10 px-4 gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setExportStep(3)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                      >
                        <span>Next: Select Destination</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* STEP 3: DESTINATION SELECTION (DOWNLOAD VS DRIVE) */}
            {exportStep === 3 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <span className="text-[11px] uppercase font-bold text-slate-300">
                    Select Export Destination:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportDestination("local")}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left space-y-1 transition-all cursor-pointer",
                        exportDestination === "local"
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-indigo-400" /> Download to PC
                        </span>
                        {exportDestination === "local" && <Check className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400">Save ZIP file directly to computer downloads.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportDestination("gdrive")}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left space-y-1 transition-all cursor-pointer",
                        exportDestination === "gdrive"
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-indigo-400" /> Save to Google Drive
                        </span>
                        {exportDestination === "gdrive" && <Check className="w-4 h-4 text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-slate-400">Upload ZIP directly to cloud folder.</p>
                    </button>
                  </div>

                  {/* GOOGLE DRIVE FOLDER PICKER & PATH DISPLAY */}
                  {exportDestination === "gdrive" && (
                    <div className="space-y-2.5 pt-2 border-t border-white/10">
                      {gdriveConnected === false ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                          <span>Google Drive is not connected. Please connect Google Drive in Settings.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5 text-indigo-400" /> Target Google Drive Folder:
                            </label>
                            {isLoadingFolders && (
                              <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
                            )}
                          </div>

                          {/* Search Folder Input & Floating Dropdown */}
                          <div className="space-y-2">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <Input
                                value={folderSearchQuery}
                                onFocus={() => setIsFolderDropdownOpen(true)}
                                onChange={(e) => {
                                  setFolderSearchQuery(e.target.value);
                                  setIsFolderDropdownOpen(true);
                                }}
                                placeholder="Search folder by name (e.g. 'Backup')..."
                                className="pl-8 pr-16 bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-8 font-mono"
                              />

                              {isFolderDropdownOpen && (
                                <button
                                  type="button"
                                  onClick={() => setIsFolderDropdownOpen(false)}
                                  className="absolute right-2 top-1.5 text-[10px] text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded-lg cursor-pointer"
                                >
                                  Close
                                </button>
                              )}

                              {/* Floating Folder Options List */}
                              {isFolderDropdownOpen && driveFolders.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto space-y-1 bg-[#151522] border border-indigo-500/40 rounded-xl p-1.5 shadow-2xl z-50">
                                  {driveFolders.map((f) => (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedFolderId(f.id);
                                        setSelectedFolderPath(f.path);
                                        setFolderSearchQuery("");
                                        setIsFolderDropdownOpen(false);
                                      }}
                                      className={cn(
                                        "w-full text-left p-2 rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer",
                                        selectedFolderId === f.id
                                          ? "bg-indigo-600/30 text-white font-bold border border-indigo-500/40"
                                          : "text-slate-300 hover:bg-white/10"
                                      )}
                                    >
                                      <span className="truncate pr-2">{f.path}</span>
                                      {selectedFolderId === f.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Selected Folder Status Badge */}
                            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs flex items-center justify-between font-mono">
                              <div className="flex items-center gap-2 truncate">
                                <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="text-slate-300 text-[11px] truncate">
                                  Selected: <strong className="text-white">{selectedFolderPath}</strong>
                                </span>
                              </div>
                              {selectedFolderId !== "root" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFolderId("root");
                                    setSelectedFolderPath("My Drive (Root)");
                                  }}
                                  className="text-[10px] text-indigo-300 hover:text-white hover:underline shrink-0 ml-2 cursor-pointer"
                                >
                                  Reset to Root
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExportStep(2)}
                    className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl text-xs h-10 px-4 gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleStartExport}
                    disabled={exportDestination === "gdrive" && gdriveConnected === false}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {exportDestination === "gdrive"
                        ? "Export & Upload to Google Drive"
                        : "Start Export & Download ZIP"}
                    </span>
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: PROCESSING & RESULT */}
            {exportStep === 4 && (
              <div className="p-6 text-center space-y-4 rounded-3xl bg-white/[0.02] border border-white/10">
                {isExporting ? (
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto animate-pulse shadow-xl shadow-indigo-500/20">
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Packaging Export Archive...</h4>
                      <p className="text-xs text-slate-400">
                        {exportDestination === "gdrive"
                          ? "Dumping database JSON, archiving uploads, and uploading to Google Drive..."
                          : "Compiling database JSON dump and archiving /public/uploads directory..."}
                      </p>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-[shimmer_1.5s_infinite] w-full" />
                    </div>
                  </div>
                ) : exportDone ? (
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-xl shadow-emerald-500/20">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Backup Export Completed!</h4>
                      <p className="text-xs text-slate-300">
                        {exportDriveResult
                          ? `Saved to Google Drive: "${exportDriveResult.name}"`
                          : "Your Personal OS backup archive has been downloaded to your computer."}
                      </p>
                    </div>

                    {exportDriveResult?.webViewLink && (
                      <div className="pt-2">
                        <a
                          href={exportDriveResult.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono hover:bg-indigo-500/20 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View File in Google Drive
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-2xl h-10 px-6 shadow-lg shadow-emerald-600/30 cursor-pointer"
                      >
                        Finish & Close
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODE 2: DEDICATED RESTORE WIZARD (3 STEPS)
        ═══════════════════════════════════════════════════════════════════ */}
        {mode === "import" && (
          <div className="space-y-4">
            {/* STEP 1: OVERVIEW & SOURCE SELECTION */}
            {importStep === 1 && (
              <div className="space-y-4">
                {/* SOURCE SELECTOR */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportSource("local")}
                    className={cn(
                      "py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2",
                      importSource === "local"
                        ? "bg-amber-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    <UploadCloud className="w-3.5 h-3.5" /> Upload Local ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportSource("gdrive")}
                    className={cn(
                      "py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2",
                      importSource === "gdrive"
                        ? "bg-amber-600 text-white shadow-md"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    <Cloud className="w-3.5 h-3.5" /> Select from Google Drive
                  </button>
                </div>



                {/* OPTION A: LOCAL FILE UPLOAD DROPZONE */}
                {importSource === "local" && (
                  <div className="space-y-3">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          handleFileChange(e.dataTransfer.files[0]);
                        }
                      }}
                      className={cn(
                        "border-2 border-dashed rounded-3xl p-5 text-center cursor-pointer transition-all group relative",
                        isDragging
                          ? "border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/20"
                          : importFile
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-white/15 hover:border-amber-400/50 bg-white/[0.02] hover:bg-white/[0.04]"
                      )}
                    >
                      <input
                        type="file"
                        id="migration-zip-upload-isolated"
                        accept=".zip"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileChange(e.target.files[0]);
                          }
                        }}
                      />
                      <label
                        htmlFor="migration-zip-upload-isolated"
                        className="cursor-pointer flex flex-col items-center justify-center space-y-2 w-full"
                      >
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shadow-lg">
                          {importFile ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <UploadCloud className="w-5 h-5 text-amber-400" />
                          )}
                        </div>

                        <div className="space-y-0.5 text-center">
                          <p className="text-xs font-bold text-white">
                            {importFile ? importFile.name : "Click to browse or drag & drop Backup ZIP"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {importFile
                              ? `${(importFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for restore`
                              : "Supports PersonalOS_Backup_*.zip archives"}
                          </p>
                        </div>
                      </label>
                    </div>

                    {importFile && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setImportFile(null)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline font-mono cursor-pointer"
                        >
                          Clear selected file
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* OPTION B: GOOGLE DRIVE BACKUP FILE PICKER */}
                {importSource === "gdrive" && (
                  <div className="space-y-3">
                    {gdriveConnected === false ? (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                        Google Drive is not connected. Please connect Google Drive in Settings.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1.5">
                            <Cloud className="w-3.5 h-3.5 text-amber-400" /> Select Backup ZIP from Google Drive:
                          </label>
                          {isLoadingDriveBackups && (
                            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                          )}
                        </div>

                        {selectedDriveFileId && selectedDriveFileName ? (
                          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between font-mono">
                            <div className="flex items-center gap-2 truncate">
                              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-slate-200 text-[11px] truncate">
                                Selected: <strong className="text-white font-bold">{selectedDriveFileName}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDriveFileId(null);
                                setSelectedDriveFileName(null);
                              }}
                              className="text-[10px] text-amber-300 hover:text-white hover:underline shrink-0 ml-2 cursor-pointer"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Search Input */}
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                              <Input
                                value={driveBackupsSearch}
                                onChange={(e) => setDriveBackupsSearch(e.target.value)}
                                placeholder="Filter backup ZIP files..."
                                className="pl-8 bg-white/[0.04] border-white/15 text-xs text-white rounded-xl h-8 font-mono"
                              />
                            </div>

                            {/* Drive Backups List */}
                            <div className="max-h-36 overflow-y-auto space-y-1 bg-black/40 border border-white/10 rounded-2xl p-1.5">
                              {driveBackupFiles.length === 0 ? (
                                <div className="p-3 text-center text-xs text-slate-400 font-mono">
                                  No backup ZIP files found in Google Drive.
                                </div>
                              ) : (
                                driveBackupFiles.map((bf) => (
                                  <button
                                    key={bf.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDriveFileId(bf.id);
                                      setSelectedDriveFileName(bf.name);
                                    }}
                                    className={cn(
                                      "w-full text-left p-2 rounded-xl text-xs font-mono flex items-center justify-between transition-colors cursor-pointer",
                                      selectedDriveFileId === bf.id
                                        ? "bg-amber-600/30 text-white font-bold border border-amber-500/40"
                                        : "text-slate-300 hover:bg-white/5"
                                    )}
                                  >
                                    <div className="space-y-0.5 truncate pr-2">
                                      <span className="truncate block font-bold">{bf.name}</span>
                                      <span className="text-[10px] text-slate-400 block">{bf.sizeDisplay}</span>
                                    </div>
                                    {selectedDriveFileId === bf.id && (
                                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Real-time Download / Upload Progress Bar */}
                {isValidating && validationProgress && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2 animate-in fade-in duration-200 font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-bold flex items-center gap-2 truncate pr-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                        <span className="truncate">{validationProgress.statusText || "Processing Backup Archive..."}</span>
                      </span>
                      <span className="text-amber-400 font-bold text-xs shrink-0 font-mono">
                        {validationProgress.percentage}%
                      </span>
                    </div>
                    {/* Progress Track */}
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 rounded-full transition-all duration-300 ease-out shadow-sm shadow-amber-500/50"
                        style={{ width: `${Math.max(5, validationProgress.percentage)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl text-xs h-10 px-4 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      (importSource === "local" ? !importFile : !selectedDriveFileId) || isValidating
                    }
                    onClick={handleImportValidation}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-amber-600/30 cursor-pointer"
                  >
                    {isValidating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Reading Archive...</span>
                      </>
                    ) : (
                      <>
                        <span>Next: Validate Backup</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: VALIDATION RESULTS */}
            {importStep === 2 && importValidationData && (
              <div className="space-y-4">
                <div className="space-y-3">
                  {/* Top Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                      <div className="flex items-center justify-between text-indigo-300 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Database className="w-3.5 h-3.5" /> Database Records
                        </span>
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-300 text-[10px]">
                          {importValidationData.tablesCount} Tables
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-white">{importValidationData.totalDbRows} Total Rows</p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <div className="flex items-center justify-between text-emerald-300 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5" /> Storage Size
                        </span>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                          {importValidationData.uploads.fileCount} Files
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-white">{importValidationData.uploads.totalSizeMB} MB</p>
                    </div>
                  </div>

                  {/* DYNAMIC DATABASE TABLES GRID */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Discovered MySQL Tables ({importValidationData.tablesCount}):
                      </span>
                      <Badge variant="outline" className="border-white/10 text-slate-400 text-[10px]">
                        Valid JSON Format
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-[11px] max-h-44 overflow-y-auto pr-1">
                      {Object.entries(importValidationData.tableCounts).map(([tblName, rowCnt]) => (
                        <div key={tblName} className="p-2 rounded-xl bg-white/[0.03] border border-white/5 space-y-0.5">
                          <span className="text-slate-400 block text-[10px] truncate font-mono" title={tblName}>
                            {tblName}
                          </span>
                          <span className="font-bold text-white">{rowCnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportStep(1)}
                    className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl text-xs h-10 px-4 gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setImportStep(3)}
                    className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-amber-600/30 cursor-pointer"
                  >
                    <span>Next: Danger Confirmation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: DANGER CONFIRMATION */}
            {importStep === 3 && (
              <div className="space-y-4">
                <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-rose-300 uppercase">DANGER ZONE: OVERWRITE WARNING</h4>
                      <p className="text-[11px] text-rose-200/80">
                        Selected Archive: <span className="font-bold text-white">{importValidationData?.fileName}</span>
                      </p>
                    </div>
                  </div>

                  <ul className="text-[11px] text-rose-200/90 space-y-1 pl-4 list-disc">
                    <li>Executes full <strong>TRUNCATE</strong> on all discovered MySQL database tables.</li>
                    <li>Overwrites existing files in <code className="bg-black/40 px-1 rounded">/public/uploads</code>.</li>
                    <li>This operation <strong>CANNOT BE UNDONE</strong>.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">
                    Type &quot;<span className="text-rose-400 font-mono">RESTORE</span>&quot; to confirm:
                  </label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RESTORE here"
                    className="bg-white/[0.04] border-white/15 text-xs text-white rounded-2xl h-10 px-3.5 font-mono uppercase focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportStep(2)}
                    className="border-white/15 text-slate-300 hover:bg-white/10 rounded-2xl text-xs h-10 px-4 gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={confirmText.trim() !== "RESTORE"}
                    onClick={handleStartRestore}
                    className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold rounded-2xl h-10 px-5 gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Execute Full Database & Files Restore</span>
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: PROCESSING & RESULT */}
            {importStep === 4 && (
              <div className="p-6 text-center space-y-4 rounded-3xl bg-white/[0.02] border border-white/10">
                {isRestoring ? (
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto animate-pulse shadow-xl shadow-amber-500/20">
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Restoring Personal OS Database & Files...</h4>
                      <p className="text-xs text-slate-400">
                        Disabling foreign keys, truncating tables, bulk inserting records & extracting uploads...
                      </p>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-[shimmer_1.5s_infinite] w-full" />
                    </div>
                  </div>
                ) : restoreDone ? (
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-xl shadow-emerald-500/20">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-emerald-300">Restore Completed Successfully!</h4>
                      <p className="text-xs text-slate-300">
                        Database tables populated & files extracted. Refreshing Personal OS now...
                      </p>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Auto-reloading application state...</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
