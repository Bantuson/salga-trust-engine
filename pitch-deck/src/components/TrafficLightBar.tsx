import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface TrafficLightBarProps {
  green: number;
  amber: number;
  red: number;
  labels?: { green: string; amber: string; red: string };
  delay?: number;
  height?: number;
}

export const TrafficLightBar: React.FC<TrafficLightBarProps> = ({
  green,
  amber,
  red,
  labels = { green: "On Track", amber: "At Risk", red: "Behind" },
  delay = 0,
  height = 32,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const total = green + amber + red;
  const greenPct = (green / total) * 100;
  const amberPct = (amber / total) * 100;
  const redPct = (red / total) * 100;

  const barEntrance = spring({ frame, fps, delay, config: { damping: 200 } });
  const labelsEntrance = spring({ frame, fps, delay: delay + 15, config: { damping: 200 } });

  const segments = [
    { pct: greenPct, color: "#22c55e", count: green, label: labels.green },
    { pct: amberPct, color: "#f59e0b", count: amber, label: labels.amber },
    { pct: redPct, color: "#ef4444", count: red, label: labels.red },
  ];

  return (
    <div style={{ width: "100%" }}>
      {/* Bar */}
      <div
        style={{
          display: "flex",
          height,
          borderRadius: height / 2,
          overflow: "hidden",
          opacity: barEntrance,
        }}
      >
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              width: `${seg.pct * interpolate(barEntrance, [0, 1], [0, 1])}%`,
              background: seg.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "width 0.3s",
            }}
          >
            {seg.pct > 10 && (
              <span
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  opacity: barEntrance,
                }}
              >
                {seg.count}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          marginTop: 10,
          opacity: labelsEntrance,
        }}
      >
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: seg.color }} />
            <span
              style={{
                fontFamily: fontFamily.body,
                fontSize: 12,
                color: colors.text.secondary,
              }}
            >
              {seg.label} ({seg.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
