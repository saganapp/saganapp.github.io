import { describe, it, expect, beforeEach } from "vitest";
import { resetIdCounter } from "@/parsers/garmin/utils";
import { parseGarminActivities } from "@/parsers/garmin/activities";

describe("parseGarminActivities", () => {
  beforeEach(() => resetIdCounter());

  it("parses activities from summarizedActivitiesExport wrapper", () => {
    const data = [
      {
        summarizedActivitiesExport: [
          {
            activityId: 123,
            name: "Running",
            activityType: "running",
            sportType: "RUNNING",
            beginTimestamp: 1700000000000,
            duration: 1800000,
            distance: 5000000, // mm
            calories: 350,
            avgHr: 145,
            maxHr: 170,
            minHr: 100,
            steps: 4500,
            elevationGain: 5000, // cm
            elevationLoss: 4800, // cm
            startLatitude: 40.42,
            startLongitude: -3.68,
            locationName: "Madrid",
          },
        ],
      },
    ];

    const events = parseGarminActivities(data);

    // Should produce 2 events: wellness_log + location
    expect(events).toHaveLength(2);

    const activity = events[0];
    expect(activity.source).toBe("garmin");
    expect(activity.eventType).toBe("wellness_log");
    expect(activity.metadata.garminEventType).toBe("ACTIVITY");
    expect(activity.metadata.activityType).toBe("running");
    expect(activity.metadata.durationMs).toBe(1800000);
    expect(activity.metadata.distanceMeters).toBe(5000); // converted from mm
    expect(activity.metadata.elevationGainM).toBe(50); // converted from cm
    expect(activity.metadata.avgHr).toBe(145);

    const location = events[1];
    expect(location.eventType).toBe("location");
    expect(location.metadata.latitude).toBe(40.42);
    expect(location.metadata.locationName).toBe("Madrid");
  });

  it("handles activity without GPS (no location event)", () => {
    const data = [
      {
        summarizedActivitiesExport: [
          {
            beginTimestamp: 1700000000000,
            activityType: "strength_training",
            duration: 2400000,
            calories: 200,
          },
        ],
      },
    ];

    const events = parseGarminActivities(data);
    expect(events).toHaveLength(1);
    expect(events[0].metadata.garminEventType).toBe("ACTIVITY");
  });

  it("returns empty for invalid input", () => {
    expect(parseGarminActivities(null)).toEqual([]);
    expect(parseGarminActivities("invalid")).toEqual([]);
    expect(parseGarminActivities([])).toEqual([]);
  });

  it("skips activities without beginTimestamp", () => {
    const data = [
      {
        summarizedActivitiesExport: [
          { activityType: "running", duration: 1800000 },
        ],
      },
    ];
    expect(parseGarminActivities(data)).toHaveLength(0);
  });
});
