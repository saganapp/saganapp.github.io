import { useCallback, useRef, useState } from "react";
import { Upload, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n";
import { cn } from "@/lib/utils";

const SUPPORTED_EXTENSIONS = [".zip", ".mbox", ".json"];

function hasSupportedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

async function collectFilesFromEntry(
  entry: FileSystemDirectoryEntry,
): Promise<File[]> {
  const files: File[] = [];

  async function readDirectory(dir: FileSystemDirectoryEntry): Promise<void> {
    const reader = dir.createReader();
    let entries: FileSystemEntry[] = [];
    // readEntries may return results in batches — keep reading until empty
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      );
      entries = entries.concat(batch);
    } while (batch.length > 0);

    for (const e of entries) {
      if (e.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (e as FileSystemFileEntry).file(resolve, reject),
        );
        files.push(file);
      } else if (e.isDirectory) {
        await readDirectory(e as FileSystemDirectoryEntry);
      }
    }
  }

  await readDirectory(entry);
  return files;
}

export function FileDropZone({ onFiles, disabled }: FileDropZoneProps) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.setAttribute("webkitdirectory", "");
    folderInputElRef.current = node;
  }, []);
  const folderInputElRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;

      const items = e.dataTransfer.items;
      const collectedFiles: File[] = [];
      let hasDirectory = false;

      // Check for directory entries via webkitGetAsEntry
      if (items) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) {
            entries.push(entry);
            if (entry.isDirectory) hasDirectory = true;
          }
        }

        if (hasDirectory) {
          for (const entry of entries) {
            if (entry.isDirectory) {
              const files = await collectFilesFromEntry(
                entry as FileSystemDirectoryEntry,
              );
              collectedFiles.push(...files);
            } else if (entry.isFile) {
              const file = await new Promise<File>((resolve, reject) =>
                (entry as FileSystemFileEntry).file(resolve, reject),
              );
              collectedFiles.push(file);
            }
          }

          const filtered = collectedFiles.filter((f) =>
            hasSupportedExtension(f.name),
          );
          if (filtered.length > 0) onFiles(filtered);
          return;
        }
      }

      // Fallback: plain file drop
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        hasSupportedExtension(f.name),
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) onFiles(files);
      e.target.value = "";
    },
    [onFiles],
  );

  const handleFolderInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const allFiles = Array.from(e.target.files ?? []);
      const filtered = allFiles.filter((f) => hasSupportedExtension(f.name));
      if (filtered.length > 0) onFiles(filtered);
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <div
      role="region"
      aria-label={t("import.dropzone.title")}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-6 sm:py-10 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border/60 bg-muted/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Upload
        aria-hidden="true"
        className={cn(
          "h-8 w-8",
          dragging ? "text-primary" : "text-muted-foreground/60",
        )}
      />
      <p className="font-medium">{t("import.dropzone.title")}</p>
      <p className="text-sm text-muted-foreground">
        {t("import.dropzone.formats")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          {t("import.dropzone.browse")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => folderInputElRef.current?.click()}
          disabled={disabled}
        >
          <FolderOpen className="h-4 w-4" />
          {t("import.dropzone.browseFolder")}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".zip,.mbox,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleFolderInputChange}
      />
    </div>
  );
}
