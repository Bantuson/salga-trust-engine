import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

interface AnimatedTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  delay?: number;
  staggerFrames?: number;
  style?: React.CSSProperties;
  textAlign?: React.CSSProperties["textAlign"];
  lineHeight?: number;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  fontSize = 48,
  color = "#f9f7f8",
  fontFamily,
  fontWeight = 700,
  delay = 0,
  staggerFrames = 4,
  style,
  textAlign = "center",
  lineHeight = 1.2,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start",
        gap: fontSize * 0.25,
        lineHeight,
        ...style,
      }}
    >
      {words.map((word, i) => {
        const wordSpring = spring({
          frame,
          fps,
          delay: delay + i * staggerFrames,
          config: { damping: 200 },
        });

        const translateY = interpolate(wordSpring, [0, 1], [30, 0]);
        const opacity = interpolate(wordSpring, [0, 1], [0, 1]);

        return (
          <span
            key={i}
            style={{
              fontSize,
              color,
              fontFamily,
              fontWeight,
              opacity,
              transform: `translateY(${translateY}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
