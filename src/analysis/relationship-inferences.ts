import type { MetadataEvent, ContactRanking } from "@/parsers/types";
import type { InferenceCard, DashboardStats } from "@/hooks/use-dashboard-data";
import {
  computeReciprocity,
  computeRelationshipTrends,
  computeResponseLatency,
  computeSocialCircles,
} from "./relationships";

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = (ms / 3600000).toFixed(1);
  return `${hours}h`;
}

/**
 * Most imbalanced contact by reciprocity ratio.
 */
export function computeReciprocityInference(events: MetadataEvent[]): InferenceCard | null {
  const scores = computeReciprocity(events);
  if (scores.length === 0) return null;

  // Find the most imbalanced (furthest from 0.5)
  const most = scores[0];
  if (Math.abs(most.ratio - 0.5) < 0.15) return null; // Not imbalanced enough

  const pct = Math.round(most.ratio * 100);
  // Only report if you initiate (ratio > 0.65)
  if (most.ratio < 0.65) return null;

  return {
    id: "reciprocity",
    icon: "scale",
    titleKey: "inference.reciprocity.title",
    titleParams: { pct, contact: most.contact },
    descKey: "inference.reciprocity.desc",
    descParams: { total: most.sent + most.received },
    privacyKey: "inference.reciprocity.privacy",
  };
}

/**
 * Steepest relationship trend change.
 */
export function computeRelationshipTrendInference(
  events: MetadataEvent[],
  stats: DashboardStats,
): InferenceCard | null {
  const trends = computeRelationshipTrends(events, stats);
  if (trends.length === 0) return null;

  // Find the steepest non-stable change
  const significant = trends.filter((t) => t.direction !== "stable");
  if (significant.length === 0) return null;

  const steepest = significant[0]; // Already sorted by |changePct|

  const direction = steepest.direction === "fading" ? "fading" : "growing";

  return {
    id: "relationship-trend",
    icon: "trending-down",
    titleKey: "inference.relationshipTrend.title",
    titleParams: { contact: steepest.contact, direction },
    descKey: "inference.relationshipTrend.desc",
    descParams: { changePct: Math.abs(steepest.changePct) },
    privacyKey: "inference.relationshipTrend.privacy",
  };
}

/**
 * Largest response latency asymmetry.
 */
export function computeResponseLatencyInference(events: MetadataEvent[]): InferenceCard | null {
  const latencies = computeResponseLatency(events);
  if (latencies.length === 0) return null;

  const top = latencies[0]; // Already sorted by asymmetry ratio
  const ratio = Math.max(top.yourMedianMs, top.theirMedianMs) /
    Math.max(Math.min(top.yourMedianMs, top.theirMedianMs), 1);
  if (ratio < 2) return null; // Not asymmetric enough

  return {
    id: "response-latency",
    icon: "timer",
    titleKey: "inference.responseLatency.title",
    titleParams: {
      yourTime: formatDuration(top.yourMedianMs),
      theirTime: formatDuration(top.theirMedianMs),
      contact: top.contact,
    },
    descKey: "inference.responseLatency.desc",
    descParams: { count: top.pairCount },
    privacyKey: "inference.responseLatency.privacy",
  };
}

/**
 * Social circles summary.
 */
export function computeSocialCirclesInference(
  events: MetadataEvent[],
  rankings: ContactRanking[],
): InferenceCard | null {
  const circles = computeSocialCircles(events, rankings);
  if (circles.length === 0) return null;

  const circleLabels = circles
    .map((c) => `${c.label} (${c.contacts.length})`)
    .join(", ");

  return {
    id: "social-circles",
    icon: "circle-dot",
    titleKey: "inference.socialCircles.title",
    titleParams: { count: circles.length },
    descKey: "inference.socialCircles.desc",
    descParams: { circles: circleLabels },
    privacyKey: "inference.socialCircles.privacy",
  };
}
