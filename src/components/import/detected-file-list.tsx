import { X, FileArchive, Mail, ChevronDown, AlertTriangle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { PLATFORM_META } from "@/utils/platform";
import { PLATFORMS } from "@/parsers/types";
import type { Platform } from "@/parsers/types";
import { useLocale } from "@/i18n";
import type { DetectedFile } from "@/parsers/types";

interface DetectedFileListProps {
  files: DetectedFile[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onPlatformChange: (index: number, platform: Platform) => void;
  onSenderSelect?: (index: number, sender: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DetectedFileList({
  files,
  onRemove,
  onClear,
  onPlatformChange,
  onSenderSelect,
}: DetectedFileListProps) {
  const { t } = useLocale();

  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("import.files.title")}</h3>
        <Button variant="ghost" size="xs" onClick={onClear}>
          {t("import.files.clear")}
        </Button>
      </div>
      <ul className="space-y-2">
        {files.map((df, i) => {
          const isUnknown = df.platform === null;
          const FileIcon = df.fileType === "mbox" ? Mail : FileArchive;

          return (
            <li
              key={`${df.file.name}-${i}`}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                isUnknown
                  ? "border-amber-500/50 bg-amber-500/5"
                  : "border-border/50 bg-card"
              }`}
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {df.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(df.file.size)}
                </p>
              </div>

              {/* Platform selector dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isUnknown ? "outline" : "secondary"}
                    size="sm"
                    className={`shrink-0 gap-1.5 text-xs ${
                      isUnknown
                        ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                        : ""
                    }`}
                  >
                    {df.platform === null ? (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        {t("import.files.selectSource")}
                      </>
                    ) : (
                      <>
                        {(() => {
                          const meta = PLATFORM_META[df.platform];
                          const Icon = meta.icon;
                          return (
                            <Icon
                              className="h-3 w-3"
                              style={{ color: `var(${meta.cssVar})` }}
                            />
                          );
                        })()}
                        {PLATFORM_META[df.platform].name}
                      </>
                    )}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={df.platform ?? ""}
                    onValueChange={(value) =>
                      onPlatformChange(i, value as Platform)
                    }
                  >
                    {PLATFORMS.map((p) => {
                      const meta = PLATFORM_META[p];
                      const PIcon = meta.icon;
                      return (
                        <DropdownMenuRadioItem key={p} value={p}>
                          <PIcon
                            className="h-3.5 w-3.5"
                            style={{ color: `var(${meta.cssVar})` }}
                          />
                          {meta.name}
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Sender selector for WhatsApp chat exports */}
              {df.chatExportSenders && df.chatExportSenders.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={df.chatExportSelectedSender ? "secondary" : "outline"}
                      size="sm"
                      className={`shrink-0 gap-1.5 text-xs ${
                        !df.chatExportSelectedSender
                          ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                          : ""
                      }`}
                    >
                      {df.chatExportSelectedSender ? (
                        <>
                          <User className="h-3 w-3" />
                          {df.chatExportSelectedSender}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          {t("import.chat.selectSender")}
                        </>
                      )}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={df.chatExportSelectedSender ?? ""}
                      onValueChange={(value) =>
                        onSenderSelect?.(i, value)
                      }
                    >
                      {df.chatExportSenders.map((sender) => (
                        <DropdownMenuRadioItem key={sender} value={sender}>
                          {sender}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <span className="text-xs text-muted-foreground uppercase">
                {df.fileType}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemove(i)}
                aria-label={t("import.files.remove")}
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
