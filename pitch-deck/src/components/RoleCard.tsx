import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface RoleCardProps {
  role: string;
  tier: string;
  tierColor: string;
  features: string[];
  delay?: number;
}

export const RoleCard: React.FC<RoleCardProps> = ({
  role,
  tier,
  tierColor,
  features,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({ frame, fps, delay, config: { damping: 200 } });
  const translateX = interpolate(entrance, [0, 1], [-20, 0]);

  return (
    <div
      style={{
        display: "flex",
        opacity: entrance,
        transform: `translateX(${translateX}px)`,
      }}
    >
      {/* Left color border */}
      <div
        style={{
          width: 5,
          borderRadius: "5px 0 0 5px",
          background: tierColor,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          flex: 1,
          background: glass.bg,
          backdropFilter: `blur(${glass.blur}px)`,
          border: `1px solid ${glass.borderLight}`,
          borderLeft: "none",
          borderRadius: "0 20px 20px 0",
          padding: "22px 26px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span
            style={{
              fontFamily: fontFamily.display,
              fontSize: 20,
              fontWeight: 700,
              color: colors.text.primary,
            }}
          >
            {role}
          </span>
          <div
            style={{
              background: `${tierColor}22`,
              border: `1px solid ${tierColor}44`,
              borderRadius: 8,
              padding: "4px 12px",
              fontFamily: fontFamily.body,
              fontSize: 13,
              fontWeight: 600,
              color: tierColor,
            }}
          >
            {tier}
          </div>
        </div>
        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: fontFamily.body,
                fontSize: 15,
                color: colors.text.secondary,
              }}
            >
              <div style={{ width: 5, height: 5, borderRadius: 3, background: tierColor, flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
