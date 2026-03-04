import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface FlowNode {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}

interface ArchitectureFlowProps {
  nodes: FlowNode[];
  delay?: number;
  stagger?: number;
}

export const ArchitectureFlow: React.FC<ArchitectureFlowProps> = ({
  nodes,
  delay = 0,
  stagger = 15,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const nodeWidth = 280;
  const gap = 48;
  const totalWidth = nodes.length * nodeWidth + (nodes.length - 1) * gap;

  return (
    <div style={{ position: "relative", width: totalWidth, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap }}>
        {nodes.map((node, i) => {
          const nodeDelay = delay + i * stagger;
          const entrance = spring({ frame, fps, delay: nodeDelay, config: { damping: 200 } });
          const scale = interpolate(entrance, [0, 1], [0.8, 1]);
          const translateY = interpolate(entrance, [0, 1], [30, 0]);

          const arrowEntrance = i < nodes.length - 1
            ? spring({ frame, fps, delay: nodeDelay + 8, config: { damping: 200 } })
            : 0;

          return (
            <React.Fragment key={i}>
              <div
                style={{
                  width: nodeWidth,
                  background: glass.bg,
                  backdropFilter: `blur(${glass.blur}px)`,
                  border: `1px solid ${glass.border}`,
                  borderRadius: 24,
                  padding: "32px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                  opacity: entrance,
                  transform: `translateY(${translateY}px) scale(${scale})`,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${node.color}33, ${node.color}11)`,
                    border: `1px solid ${node.color}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                  }}
                >
                  {node.icon}
                </div>
                <span
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: 20,
                    fontWeight: 700,
                    color: node.color,
                    textAlign: "center",
                  }}
                >
                  {node.title}
                </span>
                <span
                  style={{
                    fontFamily: fontFamily.body,
                    fontSize: 15,
                    color: colors.text.secondary,
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {node.subtitle}
                </span>
              </div>

              {/* Arrow between nodes */}
              {i < nodes.length - 1 && (
                <svg
                  width={gap}
                  height={32}
                  viewBox={`0 0 ${gap} 32`}
                  style={{ flexShrink: 0, overflow: "visible" }}
                >
                  <line
                    x1={0}
                    y1={16}
                    x2={interpolate(typeof arrowEntrance === "number" ? arrowEntrance : 0, [0, 1], [0, gap - 10])}
                    y2={16}
                    stroke={colors.text.secondary}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                  <polygon
                    points={`${gap - 2},16 ${gap - 12},10 ${gap - 12},22`}
                    fill={colors.text.secondary}
                    opacity={typeof arrowEntrance === "number" ? arrowEntrance * 0.6 : 0}
                  />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
