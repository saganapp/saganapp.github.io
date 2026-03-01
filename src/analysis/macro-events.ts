import type { MetadataEvent, MacroEvent, EventType } from "@/parsers/types";
import { EVENT_DURATION_SECONDS } from "@/parsers/types";

export function detectMacroEvents(
  events: MetadataEvent[],
  windowMs: number = 30 * 60 * 1000,
  minEvents: number = 5,
): MacroEvent[] {
  // Sort by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Group events by contact
  const byContact = new Map<string, MetadataEvent[]>();
  for (const e of sorted) {
    const contact = e.participants[0];
    if (!contact || contact === "You") continue;
    if (!byContact.has(contact)) byContact.set(contact, []);
    byContact.get(contact)!.push(e);
  }

  const macroEvents: MacroEvent[] = [];
  let idCounter = 0;

  for (const [contact, contactEvents] of byContact) {
    if (contactEvents.length < minEvents) continue;

    let windowStart = 0;
    for (let windowEnd = 0; windowEnd < contactEvents.length; windowEnd++) {
      // Advance window start to keep within windowMs
      while (
        windowStart < windowEnd &&
        contactEvents[windowEnd].timestamp.getTime() - contactEvents[windowStart].timestamp.getTime() > windowMs
      ) {
        windowStart++;
      }

      const count = windowEnd - windowStart + 1;
      if (count >= minEvents) {
        const windowEvents = contactEvents.slice(windowStart, windowEnd + 1);
        const startTime = windowEvents[0].timestamp;
        const endTime = windowEvents[windowEvents.length - 1].timestamp;
        const eventTypes = [...new Set(windowEvents.map((e) => e.eventType))];

        // Estimated duration: span + tail time for last event
        const spanSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
        const lastEventDur = EVENT_DURATION_SECONDS[windowEvents[windowEvents.length - 1].eventType];
        const estimatedDurationSeconds = spanSeconds + lastEventDur;

        macroEvents.push({
          id: `macro-${++idCounter}`,
          source: windowEvents[0].source,
          contact,
          startTime,
          endTime,
          eventCount: count,
          eventTypes: eventTypes as EventType[],
          estimatedDurationSeconds,
        });

        // Skip forward to avoid overlapping macro events for same contact
        windowStart = windowEnd + 1;
        windowEnd = windowStart - 1; // will be incremented by loop
      }
    }
  }

  // Sort by eventCount desc
  macroEvents.sort((a, b) => b.eventCount - a.eventCount);
  return macroEvents;
}
