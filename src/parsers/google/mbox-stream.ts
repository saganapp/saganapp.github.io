import type { MetadataEvent, DailyAggregate } from "../types";
import { makeEvent } from "./utils";

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB
const BATCH_SIZE = 500;
const FROM_LINE = "\nFrom ";
const HEADER_END = "\n\n";
const DETECTION_SAMPLE_SIZE = 5000;

export interface MboxBatch {
  events: MetadataEvent[];
  aggregates: DailyAggregate[];
}

/** Parsed email header fields (lightweight, no full event yet). */
interface ParsedHeader {
  date: Date;
  from: string;
  to: string;
  subject: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  listId: string | null;
}

/**
 * Detects the user's email address by counting From: addresses.
 * The most frequent sender is assumed to be the user (their sent mail dominates).
 */
class UserEmailDetector {
  private counts = new Map<string, number>();
  private _resolved = false;
  private _userEmail: string | null = null;

  add(email: string): void {
    if (this._resolved) return;
    const lower = email.toLowerCase();
    this.counts.set(lower, (this.counts.get(lower) ?? 0) + 1);
  }

  resolve(): void {
    if (this._resolved) return;
    this._resolved = true;
    let topEmail = "";
    let topCount = 0;
    for (const [email, count] of this.counts) {
      if (count > topCount) {
        topEmail = email;
        topCount = count;
      }
    }
    this._userEmail = topEmail || null;
  }

  get resolved(): boolean {
    return this._resolved;
  }

  get userEmail(): string | null {
    return this._userEmail;
  }

  isUserEmail(addr: string): boolean {
    if (!this._userEmail) return false;
    return addr.toLowerCase() === this._userEmail;
  }
}

/**
 * Detects mailing list addresses by tracking To: addresses that co-occur
 * with List-Id headers. Addresses seen >= 2 times with a List-Id are
 * considered list addresses (excludes the user's own email, since
 * newsletters send To: user@me.com with List-Id).
 */
class MailingListDetector {
  private counts = new Map<string, number>();
  private listAddresses = new Set<string>();
  private _resolved = false;

  add(to: string, _listId: string): void {
    if (this._resolved || !to) return;
    const lower = to.toLowerCase();
    this.counts.set(lower, (this.counts.get(lower) ?? 0) + 1);
  }

  resolve(userEmail: string | null): void {
    if (this._resolved) return;
    this._resolved = true;
    const userLower = userEmail?.toLowerCase() ?? null;
    for (const [addr, count] of this.counts) {
      if (count >= 2 && addr !== userLower) {
        this.listAddresses.add(addr);
      }
    }
  }

  isListAddress(addr: string): boolean {
    return this.listAddresses.has(addr.toLowerCase());
  }
}

/**
 * Accumulates received emails into daily aggregates.
 * Keeps per-day count, hourly distribution, and top senders.
 */
class DailyAggregateAccumulator {
  private days = new Map<string, {
    count: number;
    hourly: number[];
    senderCounts: Map<string, number>;
  }>();

  add(date: Date, sender: string): void {
    const dateKey = date.toISOString().slice(0, 10);
    let day = this.days.get(dateKey);
    if (!day) {
      day = { count: 0, hourly: new Array(24).fill(0), senderCounts: new Map() };
      this.days.set(dateKey, day);
    }
    day.count++;
    day.hourly[date.getHours()]++;
    day.senderCounts.set(sender, (day.senderCounts.get(sender) ?? 0) + 1);
  }

  flush(): DailyAggregate[] {
    const aggregates: DailyAggregate[] = [];
    for (const [dateKey, day] of this.days) {
      const topParticipants = [...day.senderCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      aggregates.push({
        id: `google-gmail-received-${dateKey}`,
        source: "google",
        category: "gmail-received",
        date: dateKey,
        count: day.count,
        hourlyDistribution: day.hourly,
        topParticipants,
      });
    }
    this.days.clear();
    return aggregates;
  }
}

/**
 * Streaming mbox parser. Reads file in 8 MB chunks using File.slice(),
 * extracts only email headers, detects user email, classifies sent/received,
 * and yields batches of { events, aggregates }.
 *
 * Sent emails → individual MetadataEvent (message_sent)
 * Received emails → DailyAggregate (not individual rows)
 * Received emails with In-Reply-To matching a sent Message-ID → individual event (message_received)
 */
export async function* parseMboxStreaming(
  file: File,
  onProgress?: (bytesRead: number, totalBytes: number) => void,
): AsyncGenerator<MboxBatch> {
  const totalBytes = file.size;
  let offset = 0;
  let leftover = "";
  let eventBatch: MetadataEvent[] = [];

  const detector = new UserEmailDetector();
  const listDetector = new MailingListDetector();
  const aggregator = new DailyAggregateAccumulator();
  const sentMessageIds = new Set<string>();
  let headerBuffer: ParsedHeader[] = [];
  let sampleCount = 0;
  let phase: "detecting" | "streaming" = "detecting";

  // Flush aggregate batch periodically (every ~10K received emails worth of days)
  let receivedSinceLastFlush = 0;
  const AGGREGATE_FLUSH_INTERVAL = 10000;

  function classifyAndEmit(header: ParsedHeader): void {
    const isSent = detector.isUserEmail(header.from);

    if (isSent) {
      // Track sent message IDs for response-time matching
      if (header.messageId) {
        sentMessageIds.add(header.messageId);
      }

      const participants: string[] = [];
      if (header.to && !listDetector.isListAddress(header.to) && !detector.isUserEmail(header.to)) {
        participants.push(header.to);
      }

      eventBatch.push(
        makeEvent("message_sent", header.date, header.from, participants, {
          subSource: "Gmail",
          direction: "sent",
          messageId: header.messageId,
          inReplyTo: header.inReplyTo,
          hasSubject: !!header.subject,
          subjectLength: header.subject?.length ?? 0,
        }),
      );
    } else {
      // Received email — aggregate by day
      aggregator.add(header.date, header.from);
      receivedSinceLastFlush++;

      // If this is a reply to one of our sent emails, also store individually
      if (header.inReplyTo && sentMessageIds.has(header.inReplyTo)) {
        eventBatch.push(
          makeEvent("message_received", header.date, header.from, [header.from], {
            subSource: "Gmail",
            direction: "received",
            messageId: header.messageId,
            inReplyTo: header.inReplyTo,
            hasSubject: !!header.subject,
            subjectLength: header.subject?.length ?? 0,
          }),
        );
      }
    }
  }

  while (offset < totalBytes) {
    const end = Math.min(offset + CHUNK_SIZE, totalBytes);
    const slice = file.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    const text = leftover + new TextDecoder().decode(buffer);

    // Find all message boundaries
    const boundaries: number[] = [];
    if (offset === 0 && text.startsWith("From ")) {
      boundaries.push(0);
    }

    let pos = text.indexOf(FROM_LINE, 0);
    while (pos !== -1) {
      boundaries.push(pos + 1); // +1 to skip the leading \n
      pos = text.indexOf(FROM_LINE, pos + 1);
    }

    // Process complete messages
    for (let i = 0; i < boundaries.length; i++) {
      const msgStart = boundaries[i];
      const msgEnd = i + 1 < boundaries.length ? boundaries[i + 1] : -1;

      let headerSection: string;
      if (msgEnd === -1) {
        if (end >= totalBytes) {
          headerSection = extractHeaders(text.slice(msgStart));
        } else {
          break;
        }
      } else {
        headerSection = extractHeaders(text.slice(msgStart, msgEnd));
      }

      const parsed = parseHeaderFields(headerSection);
      if (!parsed) continue;

      if (phase === "detecting") {
        if (parsed.listId) {
          listDetector.add(parsed.to, parsed.listId);
        } else {
          detector.add(parsed.from);
        }
        headerBuffer.push(parsed);
        sampleCount++;

        if (sampleCount >= DETECTION_SAMPLE_SIZE) {
          // Resolve and process buffered headers
          detector.resolve();
          listDetector.resolve(detector.userEmail);
          phase = "streaming";
          for (const h of headerBuffer) {
            classifyAndEmit(h);
          }
          headerBuffer = [];
        }
      } else {
        classifyAndEmit(parsed);
      }

      // Yield batches
      if (eventBatch.length >= BATCH_SIZE) {
        const aggBatch = receivedSinceLastFlush >= AGGREGATE_FLUSH_INTERVAL
          ? aggregator.flush()
          : [];
        if (receivedSinceLastFlush >= AGGREGATE_FLUSH_INTERVAL) {
          receivedSinceLastFlush = 0;
        }
        yield { events: eventBatch, aggregates: aggBatch };
        eventBatch = [];
        await yieldToMain();
      }

      if (i === boundaries.length - 1 && msgEnd === -1 && end < totalBytes) {
        leftover = text.slice(msgStart);
      }
    }

    // Set leftover for next iteration
    if (boundaries.length === 0) {
      leftover = text;
    } else {
      const lastComplete =
        boundaries.length > 1 || end >= totalBytes
          ? boundaries[boundaries.length - 1]
          : boundaries[0];
      if (end < totalBytes) {
        leftover = text.slice(lastComplete);
      } else {
        leftover = "";
      }
    }

    offset = end;
    onProgress?.(offset, totalBytes);
  }

  // If we never hit the sample threshold, resolve now
  if (phase === "detecting") {
    detector.resolve();
    listDetector.resolve(detector.userEmail);
    for (const h of headerBuffer) {
      classifyAndEmit(h);
    }
    headerBuffer = [];
  }

  // Flush remaining
  const finalAggregates = aggregator.flush();
  if (eventBatch.length > 0 || finalAggregates.length > 0) {
    yield { events: eventBatch, aggregates: finalAggregates };
  }
}

/** Returns the detected user email (for passing to other parsers). */
export function getUserEmailFromDetector(): string | null {
  // This is handled via the parse context in the orchestrator
  return null;
}

function extractHeaders(message: string): string {
  const endIdx = message.indexOf(HEADER_END);
  if (endIdx === -1) return message;
  return message.slice(0, endIdx);
}

function parseHeaderFields(headerBlock: string): ParsedHeader | null {
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const lines = unfolded.split(/\r?\n/);

  let date: string | null = null;
  let from: string | null = null;
  let to: string | null = null;
  let subject: string | null = null;
  let messageId: string | null = null;
  let inReplyTo: string | null = null;
  let listId: string | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.startsWith("date:")) {
      date = line.slice(5).trim();
    } else if (lower.startsWith("from:") && !lower.startsWith("from ")) {
      from = extractEmailAddr(line.slice(5).trim());
    } else if (lower.startsWith("to:")) {
      to = extractEmailAddr(line.slice(3).trim());
    } else if (lower.startsWith("subject:")) {
      subject = line.slice(8).trim();
    } else if (lower.startsWith("message-id:")) {
      messageId = line.slice(11).trim().replace(/^<|>$/g, "");
    } else if (lower.startsWith("in-reply-to:")) {
      inReplyTo = line.slice(12).trim().replace(/^<|>$/g, "");
    } else if (lower.startsWith("list-id:")) {
      listId = line.slice(8).trim();
    }
  }

  if (!date) return null;
  const ts = new Date(date);
  if (isNaN(ts.getTime())) return null;

  return {
    date: ts,
    from: from ?? "unknown",
    to: to ?? "",
    subject,
    messageId,
    inReplyTo,
    listId,
  };
}

function extractEmailAddr(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1] : raw;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
