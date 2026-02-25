import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { GlassCard } from "../components/GlassCard";
import { AnimatedText } from "../components/AnimatedText";
import { StatCounter } from "../components/StatCounter";
import { BarChart } from "../components/BarChart";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const dashStats = [
  { value: 47, label: "Open", color: colors.coral, suffix: "" },
  { value: 182, label: "Resolved", color: colors.teal, suffix: "" },
  { value: 87, label: "SLA Met", color: colors.gold, suffix: "%" },
  { value: 4.2, label: "Avg Hours", color: colors.rose.light, suffix: "h", decimals: 1 },
];

const categoryData = [
  { label: "Water", value: 62, color: colors.teal },
  { label: "Power", value: 45, color: colors.gold },
  { label: "Roads", value: 38, color: colors.coral },
  { label: "Waste", value: 29, color: colors.rose.primary },
  { label: "Other", value: 18, color: colors.rose.light },
];

export const S07_Dashboard: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "48px 36px",
          gap: 28,
        }}
      >
        <AnimatedText
          text="Municipal Dashboard"
          fontSize={44}
          fontFamily={fontFamily.display}
          color={colors.rose.light}
          delay={0}
        />

        {/* Stats grid - 2x2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            width: "100%",
          }}
        >
          {dashStats.map((stat, i) => (
            <GlassCard
              key={i}
              delay={10 + i * 8}
              style={{ padding: 20, display: "flex", justifyContent: "center" }}
            >
              <StatCounter
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                color={stat.color}
                delay={15 + i * 8}
                fontSize={48}
                decimals={stat.decimals ?? 0}
              />
            </GlassCard>
          ))}
        </div>

        {/* Bar chart */}
        <GlassCard
          delay={45}
          style={{
            width: "100%",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: fontFamily.display,
              fontSize: 20,
              fontWeight: 600,
              color: colors.text.secondary,
            }}
          >
            Tickets by Category
          </span>
          <BarChart data={categoryData} delay={55} stagger={6} height={280} />
        </GlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
