import { AbsoluteFill } from "remotion";

export const DemoBackground: React.FC = () => {
  return (
    <AbsoluteFill>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "radial-gradient(ellipse at 50% 30%, #2a1520 0%, #1a0a10 60%, #0d0508 100%)",
        }}
      />
      {/* Subtle warm vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(163,72,102,0.06) 70%, rgba(13,5,8,0.3) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
