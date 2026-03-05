"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FolderOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileDropZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles: number;
  maxTotalSize: number;
  acceptExtensions: string[];
  disabled?: boolean;
}

function getFileExtension(name: string): string {
  if (!name.includes(".")) return "";
  return `.${name.split(".").pop()!.toLowerCase()}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Recursively read all files from a FileSystemDirectoryEntry.
 * Returns File objects with `webkitRelativePath`-like naming via the path prefix.
 */
async function readDirectoryEntries(
  entry: FileSystemDirectoryEntry,
  pathPrefix: string,
): Promise<File[]> {
  const reader = entry.createReader();
  const files: File[] = [];

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let batch = await readBatch();
  while (batch.length > 0) {
    for (const child of batch) {
      if (child.isFile) {
        const fileEntry = child as FileSystemFileEntry;
        const file = await new Promise<File>((resolve, reject) =>
          fileEntry.file(resolve, reject),
        );
        // Create a new File with the relative path as the name
        const relativeName = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
        const namedFile = new File([file], relativeName, { type: file.type });
        files.push(namedFile);
      } else if (child.isDirectory) {
        const dirEntry = child as FileSystemDirectoryEntry;
        const dirPath = pathPrefix ? `${pathPrefix}/${child.name}` : child.name;
        const nested = await readDirectoryEntries(dirEntry, dirPath);
        files.push(...nested);
      }
    }
    batch = await readBatch();
  }

  return files;
}

/**
 * Process dropped items — supports both individual files and folder drops.
 * For folders, strips the root folder name to get relative paths.
 */
async function processDropItems(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry?.();

    if (entry?.isDirectory) {
      // Read folder recursively — paths are relative to inside the folder
      const dirFiles = await readDirectoryEntries(
        entry as FileSystemDirectoryEntry,
        "",
      );
      files.push(...dirFiles);
    } else if (entry?.isFile) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  return files;
}

export function FileDropZone({
  files,
  onFilesChange,
  maxFiles,
  maxTotalSize,
  acceptExtensions,
  disabled,
}: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFiles = useCallback(
    (incoming: File[]) => {
      setError(null);

      // Filter to allowed extensions
      const valid: File[] = [];
      const rejected: string[] = [];
      for (const f of incoming) {
        const ext = getFileExtension(f.name);
        if (acceptExtensions.includes(ext)) {
          valid.push(f);
        } else {
          rejected.push(f.name);
        }
      }

      if (rejected.length > 0) {
        setError(
          `${rejected.length} file${rejected.length !== 1 ? "s" : ""} rejected (only ${acceptExtensions.join(", ")} allowed): ${rejected.slice(0, 3).join(", ")}${rejected.length > 3 ? "…" : ""}`,
        );
      }

      if (valid.length === 0) return;

      const merged = [...files, ...valid].slice(0, maxFiles);
      const totalSize = merged.reduce((s, f) => s + f.size, 0);
      if (totalSize > maxTotalSize) {
        setError(`Total file size exceeds ${formatFileSize(maxTotalSize)}.`);
        return;
      }
      if (merged.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed.`);
        return;
      }

      onFilesChange(merged);
    },
    [files, onFilesChange, maxFiles, maxTotalSize, acceptExtensions],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;

      const droppedFiles = await processDropItems(e.dataTransfer.items);
      validateAndSetFiles(droppedFiles);
    },
    [disabled, validateAndSetFiles],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      validateAndSetFiles(selected);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [validateAndSetFiles],
  );

  const handleFolderInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      // For folder input, strip the root folder prefix from webkitRelativePath
      const renamed = selected.map((f) => {
        const relPath = f.webkitRelativePath;
        if (!relPath) return f;
        // Strip root folder: "my-folder/sub/file.md" -> "sub/file.md"
        const parts = relPath.split("/");
        const withoutRoot = parts.slice(1).join("/");
        return new File([f], withoutRoot || f.name, { type: f.type });
      });
      validateAndSetFiles(renamed);
      e.target.value = "";
    },
    [validateAndSetFiles],
  );

  const removeFile = useCallback(
    (index: number) => {
      const updated = files.filter((_, i) => i !== index);
      onFilesChange(updated);
      setError(null);
    },
    [files, onFilesChange],
  );

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Drop files or folders here
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {acceptExtensions.join(", ")} files accepted
          </p>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Browse files
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Browse folder
          </Button>
        </div>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptExtensions.join(",")}
        onChange={handleFileInput}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in React's input types
        webkitdirectory=""
        onChange={handleFolderInput}
        className="hidden"
      />

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1 rounded-md border p-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="min-w-0 truncate font-mono">{f.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-muted-foreground">
                  {formatFileSize(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="border-t pt-1 text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""},{" "}
            {formatFileSize(files.reduce((s, f) => s + f.size, 0))} total
          </div>
        </div>
      )}
    </div>
  );
}
