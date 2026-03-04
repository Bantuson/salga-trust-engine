import "./index.css";
import { Composition, Still } from "remotion";
import { PitchDeck } from "./PitchDeck";
import { PlatformDemo, DEMO_TOTAL_FRAMES } from "./PlatformDemo";
import { OrgChart, getOrgChartDimensions } from "./scenes/OrgChart";

// 12 scenes + 11 transitions (15 frames each)
const TOTAL_FRAMES = 3135;

const orgDims = getOrgChartDimensions();

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="PitchDeck"
        component={PitchDeck}
        durationInFrames={TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PlatformDemo"
        component={PlatformDemo}
        durationInFrames={DEMO_TOTAL_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Still
        id="OrgChart"
        component={OrgChart}
        width={orgDims.width}
        height={orgDims.height}
      />
    </>
  );
};
