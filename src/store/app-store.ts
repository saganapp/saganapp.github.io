import { create } from "zustand";
import type { Platform, EventType } from "@/parsers/types";
import { getDatabaseStats } from "@/store/db";

interface ImportProgress {
  phase: "reading" | "extracting" | "parsing" | "storing" | "complete" | "error" | "warning";
  progress: number;
  eventsProcessed: number;
  currentFile?: string;
  error?: string;
}

interface DashboardFilters {
  platforms: Platform[];
  dateRange: { start: Date; end: Date } | null;
  eventTypes: EventType[];
  searchQuery: string;
}

interface DataSummary {
  totalEvents: number;
  platformCounts: Partial<Record<Platform, number>>;
}

interface AppState {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;

  demoMode: boolean;
  setDemoMode: (on: boolean) => void;

  activeImports: Partial<Record<Platform, ImportProgress>>;
  setImportProgress: (platform: Platform, progress: ImportProgress) => void;
  clearImportProgress: (platform: Platform) => void;
  clearAllImports: () => void;

  filters: DashboardFilters;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  resetFilters: () => void;

  dataSummary: DataSummary;
  setDataSummary: (summary: DataSummary) => void;
  hydrateDataSummary: () => Promise<void>;

  selectedYear: number | null;
  setSelectedYear: (year: number | null) => void;

  selectedPlatform: Platform | "all";
  setSelectedPlatform: (platform: Platform | "all") => void;

  dataVersion: number;
  bumpDataVersion: () => void;
}

const defaultFilters: DashboardFilters = {
  platforms: [],
  dateRange: null,
  eventTypes: [],
  searchQuery: "",
};

export const useAppStore = create<AppState>((set) => ({
  navOpen: false,
  setNavOpen: (open) => set({ navOpen: open }),

  demoMode: false,
  setDemoMode: (on) => set({ demoMode: on }),

  activeImports: {},
  setImportProgress: (platform, progress) =>
    set((state) => ({
      activeImports: { ...state.activeImports, [platform]: progress },
    })),
  clearImportProgress: (platform) =>
    set((state) => {
      const next = { ...state.activeImports };
      delete next[platform];
      return { activeImports: next };
    }),
  clearAllImports: () => set({ activeImports: {} }),

  filters: defaultFilters,
  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: defaultFilters }),

  dataSummary: { totalEvents: 0, platformCounts: {} },
  setDataSummary: (summary) => set({ dataSummary: summary }),
  hydrateDataSummary: async () => {
    const stats = await getDatabaseStats();
    set({ dataSummary: { totalEvents: stats.totalEvents, platformCounts: stats.platformCounts } });
  },

  selectedYear: null,
  setSelectedYear: (year) => set({ selectedYear: year }),

  selectedPlatform: "all",
  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),

  dataVersion: 0,
  bumpDataVersion: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),
}));
