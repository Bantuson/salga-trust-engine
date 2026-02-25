import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

import { S01_Title } from "./scenes/S01_Title";
import { S02_Problem } from "./scenes/S02_Problem";
import { S03_Gap } from "./scenes/S03_Gap";
import { S04_Solution } from "./scenes/S04_Solution";
import { S05_HowItWorks } from "./scenes/S05_HowItWorks";
import { S06_MeetGugu } from "./scenes/S06_MeetGugu";
import { S07_Dashboard } from "./scenes/S07_Dashboard";
import { S08_Transparency } from "./scenes/S08_Transparency";
import { S09_GBVSafety } from "./scenes/S09_GBVSafety";
import { S10_NorthernCape } from "./scenes/S10_NorthernCape";
import { S11_WhyPilot } from "./scenes/S11_WhyPilot";
import { S12_CallToAction } from "./scenes/S12_CallToAction";

const TRANSITION_FRAMES = 15;
const transition = (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
  />
);

const scenes: { component: React.FC; duration: number }[] = [
  { component: S01_Title, duration: 240 },
  { component: S02_Problem, duration: 330 },
  { component: S03_Gap, duration: 270 },
  { component: S04_Solution, duration: 270 },
  { component: S05_HowItWorks, duration: 330 },
  { component: S06_MeetGugu, duration: 390 },
  { component: S07_Dashboard, duration: 270 },
  { component: S08_Transparency, duration: 270 },
  { component: S09_GBVSafety, duration: 210 },
  { component: S10_NorthernCape, duration: 270 },
  { component: S11_WhyPilot, duration: 210 },
  { component: S12_CallToAction, duration: 240 },
];

export const PitchDeck: React.FC = () => {
  return (
    <TransitionSeries>
      {scenes.map((scene, i) => {
        const Scene = scene.component;
        return (
          <TransitionSeries.Sequence key={i} durationInFrames={scene.duration}>
            <Scene />
          </TransitionSeries.Sequence>
        );
      }).reduce<React.ReactNode[]>((acc, seq, i) => {
        if (i === 0) return [seq];
        return [...acc, <TransitionSeries.Transition key={`t-${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />, seq];
      }, [])}
    </TransitionSeries>
  );
};
