import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseTelegramMessages } from "./messages";
import { parseTelegramContacts, type TelegramContact } from "./contacts";

export interface TelegramBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

interface TelegramData {
  personal_information?: {
    user_id?: number;
  };
  chats?: {
    list: unknown[];
  };
  contacts?: {
    list?: TelegramContact[];
  };
}

/**
 * Parse a Telegram GDPR export.
 * Accepts .json files (result.json) or .zip files containing result.json.
 */
export async function* parseTelegramExport(
  files: File[],
  onProgress?: ParseProgressCallback,
): AsyncGenerator<TelegramBatch> {
  resetIdCounter();
  let totalEvents = 0;

  for (const file of files) {
    onProgress?.({
      phase: "reading",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    let jsonText: string;

    if (file.name.toLowerCase().endsWith(".json")) {
      jsonText = await file.text();
    } else if (file.name.toLowerCase().endsWith(".zip")) {
      // Extract result.json from ZIP using fflate
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      jsonText = await new Promise<string>((resolve, reject) => {
        unzip(data, (err, unzipped) => {
          if (err) {
            reject(err);
            return;
          }
          // Find result.json in the zip
          const resultKey = Object.keys(unzipped).find(
            (k) => k === "result.json" || k.endsWith("/result.json"),
          );
          if (!resultKey) {
            reject(new Error("No result.json found in ZIP"));
            return;
          }
          resolve(new TextDecoder().decode(unzipped[resultKey]));
        });
      });
    } else {
      continue;
    }

    onProgress?.({
      phase: "parsing",
      progress: 0.3,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const parsed: TelegramData = JSON.parse(jsonText);
    const userId = String(parsed.personal_information?.user_id ?? "");

    if (!userId) {
      continue;
    }

    // Parse messages if chats exist
    if (parsed.chats) {
      const messageGen = parseTelegramMessages(
        parsed.chats as { list: never[] },
        userId,
      );

      for (const batch of messageGen) {
        totalEvents += batch.length;
        yield { events: batch, aggregates: [] };

        onProgress?.({
          phase: "parsing",
          progress: 0.3 + 0.6 * (totalEvents / 30000), // approximate
          eventsProcessed: totalEvents,
          currentFile: file.name,
        });

        // Yield to main thread between batches
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // Parse contacts if present
    const contactEvents = parseTelegramContacts(parsed.contacts?.list);
    if (contactEvents.length > 0) {
      totalEvents += contactEvents.length;
      yield { events: contactEvents, aggregates: [] };
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });
  }
}
