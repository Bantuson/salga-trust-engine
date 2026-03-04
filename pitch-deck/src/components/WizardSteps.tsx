import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface WizardStepsProps {
  steps: string[];
  activeColor?: string;
  delay?: number;
  stagger?: number;
}

export const WizardSteps: React.FC<WizardStepsProps> = ({
  steps,
  activeColor = colors.teal,
  delay = 0,
  stagger = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, width: "100%" }}>
      {steps.map((step, i) => {
        const stepEntrance = spring({ frame, fps, delay: delay + i * stagger, config: { damping: 200 } });
        const fillProgress = interpolate(stepEntrance, [0, 1], [0, 1]);
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={i}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                opacity: stepEntrance,
                flexShrink: 0,
              }}
            >
              {/* Circle */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: interpolate(fillProgress, [0, 1], [0, 1]) > 0.5
                    ? `linear-gradient(135deg, ${activeColor}, ${activeColor}cc)`
                    : "rgba(255,255,255,0.1)",
                  border: `2px solid ${activeColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: fontFamily.display,
                  fontSize: 18,
                  fontWeight: 700,
                  color: fillProgress > 0.5 ? "#fff" : activeColor,
                  transform: `scale(${interpolate(stepEntrance, [0, 1], [0.6, 1])})`,
                }}
              >
                {i + 1}
              </div>
              {/* Label */}
              <span
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 13,
                  color: colors.text.secondary,
                  textAlign: "center",
                  maxWidth: 80,
                  lineHeight: 1.2,
                }}
              >
                {step}
              </span>
            </div>
            {/* Connector line */}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 21,
                  background: `${activeColor}33`,
                  position: "relative",
                  minWidth: 20,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${interpolate(
                      spring({ frame, fps, delay: delay + (i + 1) * stagger - 4, config: { damping: 200 } }),
                      [0, 1], [0, 100]
                    )}%`,
                    background: activeColor,
                    borderRadius: 1,
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
