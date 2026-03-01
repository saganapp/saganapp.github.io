import { motion } from "framer-motion";
import type { DeviceRecord, DeviceTimelineMonth } from "@/analysis";

interface DeviceTimelineProps {
  devices: DeviceRecord[];
  timeline: DeviceTimelineMonth[];
}

// Assign distinct colors to devices
const DEVICE_COLORS = [
  "var(--platform-whatsapp)",
  "var(--platform-instagram)",
  "var(--platform-telegram)",
  "var(--platform-twitter)",
  "var(--platform-tiktok)",
  "var(--platform-google)",
];

export function DeviceTimeline({ devices, timeline }: DeviceTimelineProps) {
  if (devices.length === 0 || timeline.length === 0) {
    return null;
  }

  // Build color map
  const deviceColorMap = new Map<string, string>();
  const uniqueDevices = [...new Set(devices.map((d) => d.device.raw))];
  uniqueDevices.forEach((d, i) => {
    deviceColorMap.set(d, DEVICE_COLORS[i % DEVICE_COLORS.length]);
  });

  // Compute max count for scaling
  const maxCount = Math.max(
    ...timeline.flatMap((m) => m.devices.map((d) => d.count)),
    1,
  );

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {uniqueDevices.map((d) => (
          <div key={d} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: deviceColorMap.get(d) }}
            />
            <span className="text-xs text-muted-foreground">{d}</span>
          </div>
        ))}
      </div>

      {/* Timeline bars */}
      <div className="space-y-1">
        {timeline.map((month, mIdx) => (
          <div key={month.month} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-mono text-muted-foreground">
              {month.month}
            </span>
            <div className="flex h-7 flex-1 gap-0.5">
              {month.devices.map((d) => {
                const width = Math.max((d.count / maxCount) * 100, 2);
                return (
                  <motion.div
                    key={d.device}
                    className="h-full overflow-hidden rounded-sm"
                    style={{
                      backgroundColor:
                        deviceColorMap.get(d.device) ?? "#78909c",
                    }}
                    title={`${d.device}: ${d.count} events`}
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{
                      duration: 0.7,
                      delay: mIdx * 0.03,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <span className="block truncate px-1.5 text-[10px] font-medium leading-7 text-white">
                      {width > 12 ? d.device : ""}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
