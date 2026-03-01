import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { streamTwitterDataFiles, type ExtractedFile } from "./zip-extractor";
import { parseTwitterJs, resetIdCounter } from "./utils";
import { parseTweets } from "./tweets";
import { parseDMHeaders } from "./direct-messages";
import { parseLikes } from "./likes";
import { parseAdEngagements } from "./ads";

export interface TwitterBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

interface AccountEntry {
  account: {
    accountId: string;
    username: string;
    accountDisplayName?: string;
  };
}

/** Non-tweet data files that can be parsed independently. */
const SIMPLE_PARSERS: Record<string, (data: Uint8Array) => MetadataEvent[]> = {
  "data/like.js": parseLikes,
  "data/ad-engagements.js": parseAdEngagements,
};

/** DM files that require accountId for sent/received classification. */
const DM_FILES = new Set([
  "data/direct-message-headers.js",
  "data/direct-message-group-headers.js",
]);

const KNOWN_FILE_COUNT = Object.keys(SIMPLE_PARSERS).length + 1 /* tweets.js */ + DM_FILES.size;

/**
 * Parse all files from a Twitter GDPR archive.
 * Streams the ZIP one file at a time to avoid loading the entire archive into memory.
 * Yields batches of { events, aggregates }.
 */
export async function* parseTwitterArchive(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<TwitterBatch> {
  resetIdCounter();

  const zips = files.filter((f) => f.name.toLowerCase().endsWith(".zip"));
  let totalEvents = 0;

  for (const zip of zips) {
    onProgress?.({
      phase: "extracting",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });

    let accountId = "";
    const idMap = new Map<string, string>();
    const deferredDMs: ExtractedFile[] = [];
    let filesProcessed = 0;

    const onChunkRead = (bytesRead: number, totalBytes: number) => {
      onProgress?.({
        phase: "extracting",
        progress: 0.5 * (bytesRead / totalBytes),
        eventsProcessed: totalEvents,
        currentFile: zip.name,
      });
    };

    for await (const { name, data } of streamTwitterDataFiles(zip, onChunkRead)) {
      // --- account.js: extract accountId and add to idMap ---
      if (name === "data/account.js") {
        try {
          const accounts = parseTwitterJs<AccountEntry>(data);
          const acct = accounts[0]?.account;
          accountId = acct?.accountId ?? "";
          if (acct?.accountId && acct?.username) {
            idMap.set(acct.accountId, acct.username);
          }
        } catch {
          accountId = "";
        }
        continue;
      }

      // --- tweets.js: parse events and collect ID map ---
      if (name === "data/tweets.js") {
        const result = parseTweets(data);
        for (const [id, username] of result.idMap) {
          idMap.set(id, username);
        }
        if (result.events.length > 0) {
          totalEvents += result.events.length;
          yield { events: result.events, aggregates: [] };
        }
        filesProcessed++;
        reportParsingProgress(onProgress, filesProcessed, totalEvents, name);
        await yieldToMain();
        continue;
      }

      // --- Simple data files (likes, ads) ---
      const parser = SIMPLE_PARSERS[name];
      if (parser) {
        const events = parser(data);
        if (events.length > 0) {
          totalEvents += events.length;
          yield { events, aggregates: [] };
        }
        filesProcessed++;
        reportParsingProgress(onProgress, filesProcessed, totalEvents, name);
        await yieldToMain();
        continue;
      }

      // --- DM files: always defer until all other files are processed ---
      if (DM_FILES.has(name)) {
        deferredDMs.push({ name, data });
        continue;
      }

      // Unknown data/*.js file — skip
    }

    // Process all deferred DMs now that we have accountId and idMap
    for (const deferred of deferredDMs) {
      yield* processDMFile(deferred.data, accountId, idMap);
      filesProcessed++;
      reportParsingProgress(onProgress, filesProcessed, totalEvents, deferred.name);
      await yieldToMain();
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: zip.name,
    });
  }

  /**
   * Parse a DM file and yield events in batches of 1000.
   * Updates totalEvents in the enclosing scope.
   */
  function* processDMFile(
    data: Uint8Array,
    acctId: string,
    idMapArg?: Map<string, string>,
  ): Generator<TwitterBatch> {
    const events = parseDMHeaders(data, acctId, idMapArg);
    for (let i = 0; i < events.length; i += 1000) {
      const batch = events.slice(i, i + 1000);
      totalEvents += batch.length;
      yield { events: batch, aggregates: [] };
    }
  }
}

function reportParsingProgress(
  onProgress: ParseProgressCallback | undefined,
  filesProcessed: number,
  totalEvents: number,
  currentFile: string,
): void {
  onProgress?.({
    phase: "parsing",
    progress: 0.5 + (0.5 * filesProcessed) / KNOWN_FILE_COUNT,
    eventsProcessed: totalEvents,
    currentFile,
  });
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
