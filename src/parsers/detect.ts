import { unzip } from "fflate";
import type { Platform, DetectedFile } from "./types";

const GOOGLE_TAKEOUT_ZIP = /^takeout-\d{8}T\d{6}Z-\d+-\d+\.zip$/i;
const TWITTER_ARCHIVE_ZIP = /^twitter-\d{4}-\d{2}-\d{2}-[a-f0-9]+\.zip$/i;
const INSTAGRAM_ARCHIVE_ZIP = /^instagram-.*\.zip$/i;
const TIKTOK_ARCHIVE_ZIP = /^TikTok_Data_\d+\.zip$/i;
const SPOTIFY_ARCHIVE_ZIP = /^my_spotify_data\.zip$/i;

/** Tier 1: instant filename-based detection */
function detectByFilename(file: File): DetectedFile | null {
  const name = file.name.toLowerCase();

  if (GOOGLE_TAKEOUT_ZIP.test(file.name)) {
    return { file, platform: "google", fileType: "zip", confidence: "filename" };
  }
  if (TWITTER_ARCHIVE_ZIP.test(file.name)) {
    return { file, platform: "twitter", fileType: "zip", confidence: "filename" };
  }
  if (INSTAGRAM_ARCHIVE_ZIP.test(file.name)) {
    return { file, platform: "instagram", fileType: "zip", confidence: "filename" };
  }
  if (TIKTOK_ARCHIVE_ZIP.test(file.name)) {
    return { file, platform: "tiktok", fileType: "zip", confidence: "filename" };
  }
  if (SPOTIFY_ARCHIVE_ZIP.test(file.name)) {
    return { file, platform: "spotify", fileType: "zip", confidence: "filename" };
  }
  if (name.endsWith(".mbox")) {
    return { file, platform: "google", fileType: "mbox", confidence: "filename" };
  }
  if (name === "result.json") {
    return { file, platform: "telegram", fileType: "json", confidence: "filename" };
  }

  return null;
}

/** Signature paths for content-based detection */
const CONTENT_SIGNATURES: { platform: Platform; paths: string[] }[] = [
  {
    platform: "twitter",
    paths: ["data/account.js", "data/tweets.js", "data/like.js"],
  },
  {
    platform: "google",
    paths: ["Takeout/My Activity/", "Takeout/Chrome/", "Takeout/"],
  },
  {
    platform: "instagram",
    paths: [
      "your_instagram_activity/messages/",
      "personal_information/personal_information/",
    ],
  },
  {
    platform: "telegram",
    paths: ["result.json"],
  },
  {
    platform: "tiktok",
    paths: ["user_data_tiktok.json"],
  },
  {
    platform: "whatsapp",
    paths: [
      "whatsapp_account_information/",
      "whatsapp_connections/",
    ],
  },
  {
    platform: "garmin",
    paths: [
      "IT_GLOBAL_EVENT/events.json",
      "DI_CONNECT/DI-Connect-User/",
    ],
  },
  {
    platform: "spotify",
    paths: [
      "Spotify Extended Streaming History/",
      "Streaming_History_Audio_",
    ],
  },
];

/** Read the zip central directory to collect filenames without decompressing */
function listZipEntries(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = new Uint8Array(reader.result as ArrayBuffer);
      const entries: string[] = [];

      unzip(
        data,
        {
          filter: (info) => {
            entries.push(info.name);
            return false; // reject all — we only want the listing
          },
        },
        (err) => {
          if (err) {
            // fflate may error when filter rejects everything, but we still have the entries
            // If we got entries, that's a success for our purposes
            if (entries.length > 0) {
              resolve(entries);
            } else {
              reject(err);
            }
          } else {
            resolve(entries);
          }
        },
      );
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** Tier 2: check zip entry names against known platform signatures */
function detectByContent(entries: string[]): Platform | null {
  for (const sig of CONTENT_SIGNATURES) {
    const matched = sig.paths.some((sigPath) =>
      entries.some((entry) => entry.startsWith(sigPath) || entry === sigPath),
    );
    if (matched) return sig.platform;
  }
  return null;
}

/**
 * Multi-tier file detection.
 * 1. Filename heuristic (instant)
 * 2. Content heuristic (zip listing, async) for unrecognized .zip files
 * 3. Null fallback — user must select platform manually
 */
export async function detectFiles(files: File[]): Promise<DetectedFile[]> {
  const detected: DetectedFile[] = [];

  for (const file of files) {
    // Tier 1: filename
    const byName = detectByFilename(file);
    if (byName) {
      detected.push(byName);
      continue;
    }

    // Tier 2: content (zip files only)
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const entries = await listZipEntries(file);
        const platform = detectByContent(entries);
        if (platform) {
          detected.push({ file, platform, fileType: "zip", confidence: "content" });
        } else {
          detected.push({ file, platform: null, fileType: "zip", confidence: "none" });
        }
      } catch {
        // If zip reading fails, still add as unknown
        detected.push({ file, platform: null, fileType: "zip", confidence: "none" });
      }
      continue;
    }

    // Tier 2: content (.json files) — check for Telegram structure
    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const slice = file.slice(0, 500);
        const text = await slice.text();
        if (text.includes("personal_information") && text.includes("chats")) {
          detected.push({ file, platform: "telegram", fileType: "json", confidence: "content" });
        } else {
          detected.push({ file, platform: null, fileType: "json", confidence: "none" });
        }
      } catch {
        detected.push({ file, platform: null, fileType: "json", confidence: "none" });
      }
      continue;
    }

    // Non-zip, non-mbox, non-json files are ignored
  }

  return detected;
}

// Re-export for testing
export { detectByFilename as _detectByFilename, detectByContent as _detectByContent };
