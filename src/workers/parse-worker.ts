import type { Platform } from "@/parsers/types";

export interface ParseRequest {
  platform: Platform;
  files: Map<string, ArrayBuffer>;
}

export interface ParseProgress {
  phase: "reading" | "parsing" | "storing" | "complete" | "error";
  progress: number;
  eventsProcessed: number;
  error?: string;
}

export async function parseFiles(
  _request: ParseRequest,
): Promise<ParseProgress> {
  // Stub — Phase 2 will implement actual parsers
  return {
    phase: "complete",
    progress: 100,
    eventsProcessed: 0,
  };
}

export async function ping(): Promise<string> {
  return "pong";
}
