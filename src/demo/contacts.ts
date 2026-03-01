import type { Platform } from "@/parsers/types";

export interface DemoContact {
  name: string;
  platforms: Platform[];
  weight: number;
  isGroup: boolean;
}

export const DEMO_CONTACTS: DemoContact[] = [
  { name: "Alex Chen", platforms: ["instagram", "telegram"], weight: 0.15, isGroup: false },
  { name: "Maria Santos", platforms: ["instagram", "telegram", "tiktok"], weight: 0.13, isGroup: false },
  { name: "James Wilson", platforms: ["telegram"], weight: 0.10, isGroup: false },
  { name: "Priya Sharma", platforms: ["instagram"], weight: 0.09, isGroup: false },
  { name: "Tom Baker", platforms: ["tiktok", "twitter"], weight: 0.07, isGroup: false },
  { name: "Lena Müller", platforms: ["telegram"], weight: 0.06, isGroup: false },
  { name: "David Kim", platforms: ["instagram", "twitter"], weight: 0.05, isGroup: false },
  { name: "Sophie Laurent", platforms: ["instagram"], weight: 0.05, isGroup: false },
  { name: "Omar Hassan", platforms: ["telegram"], weight: 0.04, isGroup: false },
  { name: "Rachel Green", platforms: ["tiktok", "instagram"], weight: 0.03, isGroup: false },
  { name: "Weekend Hikers", platforms: ["telegram"], weight: 0.08, isGroup: true },
  { name: "Work Team", platforms: ["telegram"], weight: 0.07, isGroup: true },
  { name: "Book Club", platforms: ["tiktok"], weight: 0.03, isGroup: true },
];
