import { AbsoluteFill, Img, staticFile } from "remotion";

export const Background: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Skyline photo — no overlay, clear background */}
      <Img
        src={staticFile("mobile-skyline.png")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "left bottom",
        }}
      />
    </AbsoluteFill>
  );
};
