import type { MetadataEvent } from "@/parsers/types";
import { useAppStore } from "@/store/app-store";
import { generateDemoData } from "./generate";

let _demoCache: MetadataEvent[] | null = null;

/** Get cached demo events (null if not yet generated). */
export function getDemoEvents(): MetadataEvent[] | null {
  return _demoCache;
}

/** Clear the in-memory demo cache (called when real import starts). */
export function clearDemoCache(): void {
  _demoCache = null;
}

export async function loadDemoData(): Promise<void> {
  _demoCache = generateDemoData();
  const store = useAppStore.getState();
  store.setDemoMode(true);
  store.bumpDataVersion();
}
