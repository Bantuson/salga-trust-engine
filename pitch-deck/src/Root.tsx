import "./index.css";
import { Composition } from "remotion";
import { PitchDeck } from "./PitchDeck";

// 12 scenes + 11 transitions (15 frames each)
// Scene durations: 240+330+270+270+330+390+270+270+210+270+210+240 = 3300
// Transition overlaps: 11 * 15 = 165
// Total: 3300 - 165 = 3135 frames (~104.5s at 30fps)
const TOTAL_FRAMES = 3135;

export const Root: React.FC = () => {
  return (
    <Composition
      id="PitchDeck"
      component={PitchDeck}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
