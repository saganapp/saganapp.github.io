/**
 * Format an array of day-of-week indices (0=Sun … 6=Sat) into a compact
 * human-readable string, collapsing consecutive runs into ranges.
 *
 * Examples:
 *   [1,2,3,4,5] → "Mon–Fri"
 *   [1,3,5]     → "Mon, Wed, Fri"
 *   [0,1,2,5,6] → "Sun–Tue, Fri, Sat"
 */
export function formatDays(
  daysOfWeek: number[],
  dayLabel: (i: number) => string,
): string {
  if (daysOfWeek.length === 0) return "";

  const sorted = [...daysOfWeek].sort((a, b) => a - b);

  // Build runs of consecutive days
  const runs: number[][] = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === current[current.length - 1] + 1) {
      current.push(sorted[i]);
    } else {
      runs.push(current);
      current = [sorted[i]];
    }
  }
  runs.push(current);

  return runs
    .map((run) => {
      if (run.length >= 3) {
        return `${dayLabel(run[0])}\u2013${dayLabel(run[run.length - 1])}`;
      }
      return run.map((d) => dayLabel(d)).join(", ");
    })
    .join(", ");
}
