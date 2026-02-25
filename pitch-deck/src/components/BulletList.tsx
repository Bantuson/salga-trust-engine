import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface BulletItem {
  text: string;
}

interface BulletListProps {
  items: BulletItem[];
  delayStart?: number;
  stagger?: number;
  checkColor?: string;
  fontSize?: number;
}

export const BulletList: React.FC<BulletListProps> = ({
  items,
  delayStart = 10,
  stagger = 15,
  checkColor = colors.teal,
  fontSize = 24,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
      }}
    >
      {items.map((item, i) => {
        const entrance = spring({
          frame,
          fps,
          delay: delayStart + i * stagger,
          config: { damping: 200 },
        });

        const x = interpolate(entrance, [0, 1], [-30, 0]);
        const checkScale = spring({
          frame,
          fps,
          delay: delayStart + i * stagger + 5,
          config: { damping: 12, stiffness: 200 },
        });

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              opacity: entrance,
              transform: `translateX(${x}px)`,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${checkColor}22`,
                border: `2px solid ${checkColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transform: `scale(${checkScale})`,
              }}
            >
              <svg width={20} height={20} viewBox="0 0 20 20">
                <path
                  d="M5 10l3 3 7-7"
                  fill="none"
                  stroke={checkColor}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontFamily: fontFamily.body,
                fontSize,
                color: colors.text.primary,
                lineHeight: 1.4,
                paddingTop: 4,
              }}
            >
              {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
