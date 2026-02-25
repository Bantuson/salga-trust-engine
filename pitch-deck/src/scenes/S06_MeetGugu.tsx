import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { Background } from "../components/Background";
import { AnimatedText } from "../components/AnimatedText";
import { WhatsAppChat } from "../components/WhatsAppChat";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const chatMessages = [
  { from: "citizen" as const, text: "Hi, I need to report a water leak", appearAt: 20 },
  {
    from: "gugu" as const,
    text: "Sawubona! 👋 I'm Gugu, your municipal services assistant. I'll help you report that water leak. Where exactly is it?",
    appearAt: 50,
  },
  {
    from: "citizen" as const,
    text: "Main Street, near Shell garage in Sol Plaatje",
    appearAt: 85,
  },
  {
    from: "gugu" as const,
    text: "Got it — Sol Plaatje Municipality, Main Street near Shell garage. How severe is the leak?",
    appearAt: 115,
  },
  { from: "citizen" as const, text: "Big leak, flooding the road", appearAt: 145 },
  {
    from: "gugu" as const,
    text: "✅ Report submitted! Your tracking number is TKT-20260223-W4K8. The water & sanitation team has been notified. You'll receive updates via WhatsApp.",
    appearAt: 175,
  },
];

export const S06_MeetGugu: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = spring({
    frame,
    fps,
    delay: 0,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 36px",
          gap: 24,
        }}
      >
        <div style={{ opacity: headerOpacity }}>
          <AnimatedText
            text="Meet Gugu"
            fontSize={52}
            fontFamily={fontFamily.display}
            color={colors.rose.light}
            delay={0}
          />
          <p
            style={{
              fontFamily: fontFamily.body,
              fontSize: 20,
              color: colors.text.secondary,
              textAlign: "center",
              margin: "8px 0 0",
            }}
          >
            Your AI Municipal Assistant
          </p>
        </div>

        <div
          style={{
            flex: 1,
            width: "100%",
            minHeight: 0,
          }}
        >
          <WhatsAppChat messages={chatMessages} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
