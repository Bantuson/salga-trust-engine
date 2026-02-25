import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface ChatMessage {
  from: "citizen" | "gugu";
  text: string;
  appearAt: number; // frame offset when this message appears
}

interface WhatsAppChatProps {
  messages: ChatMessage[];
}

const WA_GREEN = "#005c4b";
const WA_DARK = "#0b141a";
const WA_BUBBLE_OUT = "#005c4b";
const WA_BUBBLE_IN = "#202c33";
const WA_HEADER = "#1f2c34";

const TypingIndicator: React.FC<{ opacity: number }> = ({ opacity }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "12px 16px",
      background: WA_BUBBLE_IN,
      borderRadius: "12px 12px 12px 4px",
      opacity,
      alignSelf: "flex-start",
      maxWidth: "60%",
    }}
  >
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.4)",
        }}
      />
    ))}
  </div>
);

const ChatBubble: React.FC<{
  message: ChatMessage;
  frame: number;
  fps: number;
}> = ({ message, frame, fps }) => {
  const isGugu = message.from === "gugu";

  const entrance = spring({
    frame,
    fps,
    delay: message.appearAt,
    config: { damping: 15, stiffness: 200 },
  });

  const scale = interpolate(entrance, [0, 1], [0.8, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [20, 0]);

  // Show typing indicator briefly before gugu messages
  const typingShow = isGugu
    ? interpolate(frame, [message.appearAt - 15, message.appearAt - 12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const typingHide = isGugu
    ? interpolate(frame, [message.appearAt - 2, message.appearAt], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <>
      {isGugu && typingShow > 0 && typingHide > 0 && (
        <TypingIndicator opacity={typingShow * typingHide} />
      )}
      <div
        style={{
          alignSelf: isGugu ? "flex-start" : "flex-end",
          maxWidth: "85%",
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: isGugu ? "bottom left" : "bottom right",
        }}
      >
        {isGugu && (
          <div
            style={{
              fontSize: 13,
              color: colors.teal,
              fontFamily: fontFamily.body,
              fontWeight: 600,
              marginBottom: 4,
              paddingLeft: 4,
            }}
          >
            Gugu - AI Assistant
          </div>
        )}
        <div
          style={{
            background: isGugu ? WA_BUBBLE_IN : WA_BUBBLE_OUT,
            borderRadius: isGugu ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
            padding: "10px 14px",
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.body,
              fontSize: 18,
              color: "#e9edef",
              lineHeight: 1.4,
            }}
          >
            {message.text}
          </span>
        </div>
      </div>
    </>
  );
};

export const WhatsAppChat: React.FC<WhatsAppChatProps> = ({ messages }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerEntrance = spring({
    frame,
    fps,
    delay: 0,
    config: { damping: 200 },
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: WA_DARK,
        borderRadius: glass.radius,
        overflow: "hidden",
        border: `1px solid ${glass.borderLight}`,
      }}
    >
      {/* WhatsApp header */}
      <div
        style={{
          background: WA_HEADER,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: headerEntrance,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${colors.rose.primary}, ${colors.rose.deep})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 20 }}>🤖</span>
        </div>
        <div>
          <div
            style={{
              fontFamily: fontFamily.body,
              fontSize: 17,
              fontWeight: 600,
              color: "#e9edef",
            }}
          >
            SALGA Municipal Services
          </div>
          <div
            style={{
              fontFamily: fontFamily.body,
              fontSize: 13,
              color: "#8696a0",
            }}
          >
            Gugu - AI Assistant
          </div>
        </div>
      </div>

      {/* Chat messages area */}
      <div
        style={{
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          overflowY: "hidden",
          justifyContent: "flex-end",
        }}
      >
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} frame={frame} fps={fps} />
        ))}
      </div>
    </div>
  );
};
