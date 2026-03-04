import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface MetricCard {
  label: string;
  value: string;
  color: string;
}

interface DashboardMockupProps {
  title: string;
  metrics: MetricCard[];
  delay?: number;
  accentColor?: string;
}

export const DashboardMockup: React.FC<DashboardMockupProps> = ({
  title,
  metrics,
  delay = 0,
  accentColor = colors.teal,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, delay, config: { damping: 200 } });
  const scale = interpolate(entrance, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        background: glass.bg,
        backdropFilter: `blur(${glass.blurStrong}px)`,
        border: `1px solid ${glass.border}`,
        borderRadius: glass.radius,
        overflow: "hidden",
        opacity: entrance,
        transform: `scale(${scale})`,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: `linear-gradient(90deg, ${accentColor}22, transparent)`,
          borderBottom: `1px solid ${glass.borderLight}`,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: fontFamily.display,
            fontSize: 18,
            fontWeight: 600,
            color: accentColor,
          }}
        >
          {title}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {[accentColor, colors.text.secondary, colors.text.secondary].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: `${c}66` }} />
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ padding: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {metrics.map((m, i) => {
          const metricEntrance = spring({ frame, fps, delay: delay + 10 + i * 6, config: { damping: 200 } });
          return (
            <div
              key={i}
              style={{
                flex: "1 1 calc(50% - 6px)",
                minWidth: 100,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 12,
                padding: "16px 18px",
                opacity: metricEntrance,
                transform: `translateY(${interpolate(metricEntrance, [0, 1], [10, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 28,
                  fontWeight: 700,
                  color: m.color,
                }}
              >
                {m.value}
              </div>
              <div
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 14,
                  color: colors.text.secondary,
                  marginTop: 4,
                }}
              >
                {m.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart placeholder */}
      <div style={{ padding: "0 20px 20px" }}>
        <div
          style={{
            height: 100,
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${glass.borderLight}`,
            display: "flex",
            alignItems: "flex-end",
            padding: "12px 16px",
            gap: 6,
          }}
        >
          {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.3, 0.75, 0.65, 0.85].map((h, i) => {
            const barEntrance = spring({ frame, fps, delay: delay + 25 + i * 3, config: { damping: 200 } });
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h * interpolate(barEntrance, [0, 1], [0, 100])}%`,
                  background: `linear-gradient(180deg, ${accentColor}, ${accentColor}44)`,
                  borderRadius: 3,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
