import Dexie, { type Table } from "dexie";
import type { MetadataEvent, ImportSession, DailyAggregate, Platform, EventType } from "@/parsers/types";

class SaganDB extends Dexie {
  events!: Table<MetadataEvent, string>;
  imports!: Table<ImportSession, string>;
  dailyAggregates!: Table<DailyAggregate, string>;

  constructor() {
    super("SaganDB");
    this.version(1).stores({
      events: "id, source, eventType, timestamp, actor, *participants",
      imports: "id, platform, importedAt",
    });
    this.version(2).stores({
      events: "id, source, eventType, timestamp, actor, *participants, [source+eventType]",
      imports: "id, platform, importedAt",
      dailyAggregates: "id, source, category, date, [source+date], [category+date]",
    });
  }
}

export const db = new SaganDB();

export async function addEvents(events: MetadataEvent[]): Promise<void> {
  await db.events.bulkPut(events);
}

export async function addImportSession(
  session: ImportSession,
): Promise<void> {
  await db.imports.put(session);
}

export async function getEventsByPlatform(
  platform: Platform,
): Promise<MetadataEvent[]> {
  return db.events.where("source").equals(platform).toArray();
}

export async function getEventsByDateRange(
  start: Date,
  end: Date,
): Promise<MetadataEvent[]> {
  return db.events.where("timestamp").between(start, end).toArray();
}

export async function getAllEvents(): Promise<MetadataEvent[]> {
  return db.events.toArray();
}

export async function getEventCount(): Promise<number> {
  return db.events.count();
}

export async function getImportSessions(): Promise<ImportSession[]> {
  return db.imports.toArray();
}

export async function deleteImportSession(id: string): Promise<void> {
  const session = await db.imports.get(id);
  if (session) {
    await db.events.where("source").equals(session.platform).delete();
    await db.imports.delete(id);
  }
}

export async function addDailyAggregates(aggregates: DailyAggregate[]): Promise<void> {
  await db.dailyAggregates.bulkPut(aggregates);
}

export async function getDailyAggregates(): Promise<DailyAggregate[]> {
  return db.dailyAggregates.toArray();
}

export async function getDailyAggregatesByCategory(category: string): Promise<DailyAggregate[]> {
  return db.dailyAggregates.where("category").equals(category).toArray();
}

export async function getEventsBySourceAndType(source: Platform, eventType: EventType): Promise<MetadataEvent[]> {
  return db.events.where("[source+eventType]").equals([source, eventType]).toArray();
}

export async function clearAllData(): Promise<void> {
  await db.events.clear();
  await db.imports.clear();
  await db.dailyAggregates.clear();
}

export async function getDatabaseStats(): Promise<{
  totalEvents: number;
  platformCounts: Record<string, number>;
  importCount: number;
}> {
  const [totalEvents, imports] = await Promise.all([
    db.events.count(),
    db.imports.toArray(),
  ]);

  const platformCounts: Record<string, number> = {};
  for (const imp of imports) {
    platformCounts[imp.platform] =
      (platformCounts[imp.platform] ?? 0) + imp.eventCount;
  }

  return { totalEvents, platformCounts, importCount: imports.length };
}
