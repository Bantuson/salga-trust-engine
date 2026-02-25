import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface StatCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  color?: string;
  delay?: number;
  fontSize?: number;
  decimals?: number;
}

export const StatCounter: React.FC<StatCounterProps> = ({
  value,
  prefix = "",
  suffix = "",
  label,
  color = colors.gold,
  delay = 0,
  fontSize = 72,
  decimals = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
    durationInFrames: 45,
  });

  const currentValue = interpolate(progress, [0, 1], [0, value]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  const displayValue = decimals > 0
    ? currentValue.toFixed(decimals)
    : Math.round(currentValue).toString();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.display,
          fontSize,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {prefix}
        {displayValue}
        {suffix}
      </span>
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: 20,
          color: colors.text.secondary,
          marginTop: 8,
          textAlign: "center",
        }}
      >
        {label}
      </span>
    </div>
  );
};
