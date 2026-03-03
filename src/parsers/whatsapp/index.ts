import { unzip } from "fflate";
import type { MetadataEvent, DailyAggregate, DetectedFile, ParseProgressCallback } from "../types";
import { resetIdCounter } from "./utils";
import { parseRegistration } from "./registration";
import { parseUserInfo } from "./user-info";
import { buildDeviceInfoMap } from "./device-info";
import { extractChatName, parseChatExportMessages } from "./chat-export";

export interface WhatsAppBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

const TARGET_PATHS = [
  "whatsapp_account_information/registration_information.json",
  "whatsapp_account_information/user_information.json",
  "whatsapp_settings/account_settings.json",
];

const BATCH_SIZE = 1000;

/**
 * Parse a WhatsApp GDPR export.
 * Accepts .zip files containing whatsapp_account_information/,
 * whatsapp_connections/, and whatsapp_settings/ directories.
 */
export async function* parseWhatsAppExport(
  files: File[],
  onProgress?: ParseProgressCallback,
  detectedFiles?: DetectedFile[],
): AsyncGenerator<WhatsAppBatch> {
  resetIdCounter();
  let totalEvents = 0;

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    if (!file.name.toLowerCase().endsWith(".zip")) continue;

    // Check if this file has a chat export sender selected
    const detected = detectedFiles?.[fileIdx];
    const isChatExport = !!detected?.chatExportSelectedSender;

    onProgress?.({
      phase: "reading",
      progress: 0,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    if (isChatExport) {
      // ── Chat export path ──
      const chatName = extractChatName(file.name);
      const senderName = detected.chatExportSelectedSender!;

      const txtContent = await new Promise<string>((resolve, reject) => {
        unzip(data, (err, unzipped) => {
          if (err) { reject(err); return; }
          for (const key of Object.keys(unzipped)) {
            if (key.endsWith(".txt")) {
              resolve(new TextDecoder().decode(unzipped[key]));
              return;
            }
          }
          resolve("");
        });
      });

      onProgress?.({
        phase: "parsing",
        progress: 0.3,
        eventsProcessed: totalEvents,
        currentFile: file.name,
      });

      for (const batch of parseChatExportMessages(txtContent, chatName, senderName)) {
        totalEvents += batch.length;
        yield { events: batch, aggregates: [] };

        onProgress?.({
          phase: "parsing",
          progress: 0.3 + 0.7 * (totalEvents / (totalEvents + 1000)),
          eventsProcessed: totalEvents,
          currentFile: file.name,
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } else {
      // ── GDPR export path (unchanged) ──
      const jsonFiles = await new Promise<Map<string, string>>((resolve, reject) => {
        unzip(data, (err, unzipped) => {
          if (err) { reject(err); return; }
          const result = new Map<string, string>();
          for (const key of Object.keys(unzipped)) {
            const match = TARGET_PATHS.find(
              tp => key === tp || key.endsWith("/" + tp),
            );
            if (match) {
              result.set(match, new TextDecoder().decode(unzipped[key]));
            }
          }
          resolve(result);
        });
      });

      onProgress?.({
        phase: "parsing",
        progress: 0.3,
        eventsProcessed: totalEvents,
        currentFile: file.name,
      });

      // 1. Parse device info first (needed to enrich device activity events)
      const settingsJson = jsonFiles.get(
        "whatsapp_settings/account_settings.json",
      );
      const deviceInfoMap = buildDeviceInfoMap(
        settingsJson ? JSON.parse(settingsJson) : null,
      );

      // 2. Parse user information (gets phone number + user events)
      const userInfoJson = jsonFiles.get(
        "whatsapp_account_information/user_information.json",
      );
      const userInfoResult = parseUserInfo(
        userInfoJson ? JSON.parse(userInfoJson) : null,
        deviceInfoMap,
      );
      const actor = userInfoResult.phoneNumber || "Unknown";

      // 3. Parse registration
      const regJson = jsonFiles.get(
        "whatsapp_account_information/registration_information.json",
      );
      const regEvents = parseRegistration(
        regJson ? JSON.parse(regJson) : null,
        actor,
      );

      // Combine and sort all events
      const allEvents: MetadataEvent[] = [
        ...regEvents,
        ...userInfoResult.events,
      ];
      allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Yield in batches
      for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
        const batch = allEvents.slice(i, i + BATCH_SIZE);
        totalEvents += batch.length;
        yield { events: batch, aggregates: [] };

        onProgress?.({
          phase: "parsing",
          progress: 0.3 + 0.7 * (i / allEvents.length),
          eventsProcessed: totalEvents,
          currentFile: file.name,
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    onProgress?.({
      phase: "parsing",
      progress: 1,
      eventsProcessed: totalEvents,
      currentFile: file.name,
    });
  }
}
