import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

import { D01_Title } from "./demo/D01_Title";
import { D02_Architecture } from "./demo/D02_Architecture";
import { D03_Onboarding } from "./demo/D03_Onboarding";
import { D04_DeptTeams } from "./demo/D04_DeptTeams";
import { D05_AdminDashboard } from "./demo/D05_AdminDashboard";
import { D06_MayorDashboard } from "./demo/D06_MayorDashboard";
import { D07_CFODashboard } from "./demo/D07_CFODashboard";
import { D08_MMDashboard } from "./demo/D08_MMDashboard";
import { D09_SALGAAdmin } from "./demo/D09_SALGAAdmin";
import { D10_DirectorDashboard } from "./demo/D10_DirectorDashboard";
import { D11_OversightDashboards } from "./demo/D11_OversightDashboards";
import { D12_PMSHub } from "./demo/D12_PMSHub";
import { D13_GoldenThread } from "./demo/D13_GoldenThread";
import { D14_CitizenReporting } from "./demo/D14_CitizenReporting";
import { D15_PublicTransparency } from "./demo/D15_PublicTransparency";
import { D16_GBVSafety } from "./demo/D16_GBVSafety";
import { D17_Analytics } from "./demo/D17_Analytics";
import { D18_CallToAction } from "./demo/D18_CallToAction";

const TRANSITION_FRAMES = 15;

type TransitionType = "fade" | "slide";

const scenes: { component: React.FC; duration: number; transition: TransitionType }[] = [
  { component: D01_Title, duration: 240, transition: "fade" },
  { component: D02_Architecture, duration: 360, transition: "slide" },
  { component: D03_Onboarding, duration: 330, transition: "slide" },
  { component: D04_DeptTeams, duration: 300, transition: "fade" },
  { component: D05_AdminDashboard, duration: 330, transition: "slide" },
  { component: D06_MayorDashboard, duration: 330, transition: "slide" },
  { component: D07_CFODashboard, duration: 330, transition: "fade" },
  { component: D08_MMDashboard, duration: 300, transition: "slide" },
  { component: D09_SALGAAdmin, duration: 330, transition: "slide" },
  { component: D10_DirectorDashboard, duration: 300, transition: "fade" },
  { component: D11_OversightDashboards, duration: 360, transition: "slide" },
  { component: D12_PMSHub, duration: 360, transition: "slide" },
  { component: D13_GoldenThread, duration: 330, transition: "fade" },
  { component: D14_CitizenReporting, duration: 330, transition: "slide" },
  { component: D15_PublicTransparency, duration: 330, transition: "fade" },
  { component: D16_GBVSafety, duration: 300, transition: "slide" },
  { component: D17_Analytics, duration: 300, transition: "fade" },
  { component: D18_CallToAction, duration: 240, transition: "fade" },
];

const getTransition = (type: TransitionType) => {
  if (type === "slide") return slide({ direction: "from-right" });
  return fade();
};

// Total = sum of durations - (17 transitions * 15 frames overlap)
export const DEMO_TOTAL_FRAMES = scenes.reduce((sum, s) => sum + s.duration, 0) - (scenes.length - 1) * TRANSITION_FRAMES;

export const PlatformDemo: React.FC = () => {
  return (
    <TransitionSeries>
      {scenes.reduce<React.ReactNode[]>((acc, scene, i) => {
        const Scene = scene.component;
        const seq = (
          <TransitionSeries.Sequence key={i} durationInFrames={scene.duration}>
            <Scene />
          </TransitionSeries.Sequence>
        );
        if (i === 0) return [seq];
        const trans = (
          <TransitionSeries.Transition
            key={`t-${i}`}
            presentation={getTransition(scene.transition)}
            timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          />
        );
        return [...acc, trans, seq];
      }, [])}
    </TransitionSeries>
  );
};
