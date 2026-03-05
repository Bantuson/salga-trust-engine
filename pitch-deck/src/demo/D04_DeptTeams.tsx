import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { GlassCard } from "../components/GlassCard";
import { TrafficLightBar } from "../components/TrafficLightBar";
import { BulletList } from "../components/BulletList";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const departments = [
  { name: "Infrastructure & Engineering", status: "green" },
  { name: "Community & Social Services", status: "green" },
  { name: "Financial Services", status: "amber" },
  { name: "Corporate Services", status: "green" },
  { name: "Planning & Development", status: "red" },
  { name: "Public Safety", status: "green" },
];

const statusColors: Record<string, string> = { green: "#22c55e", amber: "#f59e0b", red: "#ef4444" };

export const D04_DeptTeams: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <DemoBackground />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 80px",
          gap: 28,
        }}
      >
        <SectionTitle number="04" title="Departments & Teams" color={colors.coral} delay={0} />

        <AnimatedText
          text="Department Activation & Team Structure"
          fontSize={38}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "flex", gap: 28 }}>
          {/* Left: Department list */}
          <GlassCard delay={15} style={{ flex: 1, padding: 24 }}>
            <div style={{ fontFamily: fontFamily.display, fontSize: 18, fontWeight: 600, color: colors.text.primary, marginBottom: 16 }}>
              Active Departments
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {departments.map((dept, i) => {
                const entrance = spring({ frame, fps, delay: 20 + i * 6, config: { damping: 200 } });
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      opacity: entrance,
                      padding: "10px 16px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: statusColors[dept.status] }} />
                    <span style={{ fontFamily: fontFamily.body, fontSize: 16, color: colors.text.primary, flex: 1 }}>
                      {dept.name}
                    </span>
                    <span style={{ fontFamily: fontFamily.body, fontSize: 14, color: statusColors[dept.status], textTransform: "capitalize" }}>
                      {dept.status === "green" ? "Active" : dept.status === "amber" ? "Partial" : "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20 }}>
              <TrafficLightBar green={4} amber={1} red={1} delay={55} />
            </div>
          </GlassCard>

          {/* Right: Team features */}
          <GlassCard delay={20} style={{ flex: 1, padding: 24 }}>
            <div style={{ fontFamily: fontFamily.display, fontSize: 18, fontWeight: 600, color: colors.text.primary, marginBottom: 16 }}>
              Team Management
            </div>
            <BulletList
              items={[
                { text: "Create teams within departments" },
                { text: "Assign team leaders & members" },
                { text: "Visual organogram tree view" },
                { text: "Drag-and-drop restructuring" },
                { text: "Role-based access per team" },
              ]}
              delayStart={30}
              stagger={10}
              fontSize={16}
              checkColor={colors.coral}
            />
          </GlassCard>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
