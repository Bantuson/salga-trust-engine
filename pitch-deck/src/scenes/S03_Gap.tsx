import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

export const S03_Gap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const citizenEntrance = spring({ frame, fps, delay: 10, config: { damping: 200 } });
  const arrowEntrance = spring({ frame, fps, delay: 30, config: { damping: 200 } });
  const xEntrance = spring({ frame, fps, delay: 45, config: { damping: 12, stiffness: 200 } });
  const muniEntrance = spring({ frame, fps, delay: 55, config: { damping: 200 } });
  const bottomText = spring({ frame, fps, delay: 75, config: { damping: 200 } });

  const arrowWidth = interpolate(arrowEntrance, [0, 1], [0, 200]);
  const xScale = interpolate(xEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
          gap: 40,
        }}
      >
        <AnimatedText
          text="The Broken Feedback Loop"
          fontSize={44}
          fontFamily={fontFamily.display}
          color={colors.coral}
          delay={0}
        />

        {/* Citizen side */}
        <GlassCard delay={10} style={{ width: "100%", padding: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: citizenEntrance,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${colors.teal}, rgba(0,191,165,0.5))`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              👤
            </div>
            <div>
              <p
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 22,
                  color: colors.text.primary,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                "I reported this weeks ago..."
              </p>
              <p
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 16,
                  color: colors.text.secondary,
                  margin: "4px 0 0",
                }}
              >
                Citizen
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Broken arrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 60,
            position: "relative",
          }}
        >
          <svg width={240} height={60} viewBox="0 0 240 60">
            {/* Arrow line */}
            <line
              x1={20}
              y1={30}
              x2={20 + arrowWidth}
              y2={30}
              stroke={colors.text.secondary}
              strokeWidth={3}
              strokeDasharray="8 6"
              opacity={arrowEntrance}
            />
            {/* Arrow head */}
            <polygon
              points={`${220},30 ${200},20 ${200},40`}
              fill={colors.text.secondary}
              opacity={arrowEntrance}
            />
          </svg>
          {/* Red X overlay */}
          <div
            style={{
              position: "absolute",
              transform: `scale(${xScale})`,
              fontSize: 48,
              color: colors.coral,
              fontWeight: 900,
              fontFamily: fontFamily.display,
              textShadow: `0 0 20px rgba(255,107,74,0.5)`,
            }}
          >
            ✕
          </div>
        </div>

        {/* Municipality side */}
        <GlassCard delay={55} style={{ width: "100%", padding: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: muniEntrance,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${colors.rose.primary}, ${colors.rose.deep})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              🏛️
            </div>
            <div>
              <p
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 22,
                  color: colors.text.primary,
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                "No record found"
              </p>
              <p
                style={{
                  fontFamily: fontFamily.body,
                  fontSize: 16,
                  color: colors.text.secondary,
                  margin: "4px 0 0",
                }}
              >
                Municipality
              </p>
            </div>
          </div>
        </GlassCard>

        <div style={{ opacity: bottomText }}>
          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 24,
              color: colors.text.secondary,
              textAlign: "center",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            No standardized digital feedback loop
            <br />
            between citizens and their municipalities
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
