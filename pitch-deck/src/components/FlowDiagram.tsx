import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface FlowStep {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
}

interface FlowDiagramProps {
  steps: FlowStep[];
  delayStart?: number;
  stagger?: number;
}

export const FlowDiagram: React.FC<FlowDiagramProps> = ({
  steps,
  delayStart = 10,
  stagger = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0,
        width: "100%",
      }}
    >
      {steps.map((step, i) => {
        const stepDelay = delayStart + i * stagger;
        const entrance = spring({
          frame,
          fps,
          delay: stepDelay,
          config: { damping: 200 },
        });

        const y = interpolate(entrance, [0, 1], [30, 0]);
        const isLast = i === steps.length - 1;

        // Arrow between steps
        const arrowEntrance = !isLast
          ? spring({
              frame,
              fps,
              delay: stepDelay + 10,
              config: { damping: 200 },
            })
          : 0;
        const arrowHeight = interpolate(
          typeof arrowEntrance === "number" ? arrowEntrance : 0,
          [0, 1],
          [0, 40]
        );

        return (
          <React.Fragment key={i}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                width: "100%",
                opacity: entrance,
                transform: `translateY(${y}px)`,
                background: glass.bg,
                backdropFilter: `blur(${glass.blur}px)`,
                border: `1px solid ${glass.border}`,
                borderRadius: 16,
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${step.color}, ${step.color}88)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: fontFamily.display,
                    fontSize: 22,
                    fontWeight: 600,
                    color: step.color,
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{
                    fontFamily: fontFamily.body,
                    fontSize: 16,
                    color: colors.text.secondary,
                    marginTop: 2,
                  }}
                >
                  {step.subtitle}
                </div>
              </div>
              <div
                style={{
                  fontFamily: fontFamily.display,
                  fontSize: 28,
                  fontWeight: 700,
                  color: `${step.color}44`,
                  flexShrink: 0,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
            </div>

            {/* Arrow connector */}
            {!isLast && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: 48,
                  justifyContent: "center",
                }}
              >
                <svg width={24} height={48} viewBox="0 0 24 48">
                  <line
                    x1={12}
                    y1={0}
                    x2={12}
                    y2={arrowHeight}
                    stroke={colors.text.secondary}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                  <polygon
                    points="12,48 6,36 18,36"
                    fill={colors.text.secondary}
                    opacity={typeof arrowEntrance === "number" ? arrowEntrance * 0.5 : 0}
                  />
                </svg>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
