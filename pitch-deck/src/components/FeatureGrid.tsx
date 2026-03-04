import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  color?: string;
}

interface FeatureGridProps {
  items: FeatureItem[];
  columns?: 2 | 3;
  delay?: number;
  stagger?: number;
}

export const FeatureGrid: React.FC<FeatureGridProps> = ({
  items,
  columns = 3,
  delay = 0,
  stagger = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 20,
        width: "100%",
      }}
    >
      {items.map((item, i) => {
        const entrance = spring({ frame, fps, delay: delay + i * stagger, config: { damping: 200 } });
        const translateY = interpolate(entrance, [0, 1], [20, 0]);

        return (
          <div
            key={i}
            style={{
              background: glass.bg,
              border: `1px solid ${glass.borderLight}`,
              borderRadius: 16,
              padding: "20px 22px",
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              opacity: entrance,
              transform: `translateY(${translateY}px)`,
            }}
          >
            <div
              style={{
                fontSize: 28,
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${item.color || colors.teal}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item.icon}
            </div>
            <div>
              <div
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 18,
                  fontWeight: 600,
                  color: item.color || colors.text.primary,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 14,
                  color: colors.text.secondary,
                  marginTop: 4,
                  lineHeight: 1.3,
                }}
              >
                {item.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
