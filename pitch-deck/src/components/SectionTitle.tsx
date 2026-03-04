import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface SectionTitleProps {
  number: string;      // e.g. "01"
  title: string;       // e.g. "Platform Architecture"
  color?: string;      // accent color for the number badge
  delay?: number;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  number,
  title,
  color = colors.gold,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, delay, config: { damping: 200 } });
  const lineWidth = interpolate(entrance, [0, 1], [0, 100]);
  const translateY = interpolate(entrance, [0, 1], [20, 0]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        opacity: entrance,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {/* Number badge */}
      <div
        style={{
          background: `${color}22`,
          border: `2px solid ${color}55`,
          borderRadius: 12,
          padding: "8px 16px",
          fontFamily: fontFamily.display,
          fontSize: 24,
          fontWeight: 700,
          color: color,
          letterSpacing: 1,
        }}
      >
        {number}
      </div>
      {/* Title + underline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontFamily: fontFamily.display,
            fontSize: 26,
            fontWeight: 600,
            color: colors.text.secondary,
            letterSpacing: 0.5,
          }}
        >
          {title}
        </span>
        <div
          style={{
            height: 2,
            width: `${lineWidth}%`,
            background: `linear-gradient(90deg, ${color}, transparent)`,
            borderRadius: 1,
          }}
        />
      </div>
    </div>
  );
};
