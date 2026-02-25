import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { glass } from "../design/tokens";

interface GlassCardProps {
  children: React.ReactNode;
  delay?: number;
  width?: number | string;
  style?: React.CSSProperties;
  elevated?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  delay = 0,
  width,
  style,
  elevated = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.9, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [40, 0]);

  return (
    <div
      style={{
        background: elevated ? glass.bgStrong : glass.bg,
        backdropFilter: `blur(${elevated ? glass.blurStrong : glass.blur}px)`,
        WebkitBackdropFilter: `blur(${elevated ? glass.blurStrong : glass.blur}px)`,
        border: `1px solid ${glass.border}`,
        borderRadius: glass.radius,
        padding: 32,
        width,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
