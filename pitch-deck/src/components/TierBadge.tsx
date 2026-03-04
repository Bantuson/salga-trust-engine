import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { fontFamily } from "../design/fonts";

interface TierBadgeProps {
  tier: number;
  label: string;
  color: string;
  delay?: number;
  size?: "small" | "medium";
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  label,
  color,
  delay = 0,
  size = "medium",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, delay, config: { damping: 200 } });
  const scale = interpolate(entrance, [0, 1], [0.7, 1]);

  const isSmall = size === "small";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 6 : 8,
        background: `${color}18`,
        border: `1px solid ${color}44`,
        borderRadius: isSmall ? 10 : 14,
        padding: isSmall ? "3px 10px" : "5px 16px",
        opacity: entrance,
        transform: `scale(${scale})`,
      }}
    >
      <span
        style={{
          fontFamily: fontFamily.display,
          fontSize: isSmall ? 11 : 14,
          fontWeight: 700,
          color,
        }}
      >
        Tier {tier}
      </span>
      <span
        style={{
          fontFamily: fontFamily.body,
          fontSize: isSmall ? 10 : 12,
          color: `${color}cc`,
        }}
      >
        — {label}
      </span>
    </div>
  );
};
