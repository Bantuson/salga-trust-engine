import { AbsoluteFill } from "remotion";
import { DemoBackground } from "../components/DemoBackground";
import { SectionTitle } from "../components/SectionTitle";
import { AnimatedText } from "../components/AnimatedText";
import { RoleCard } from "../components/RoleCard";
import { GlassCard } from "../components/GlassCard";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

const oversightRoles = [
  {
    role: "Ward Councillor",
    tier: "Tier 2 \u2014 Oversight",
    tierColor: colors.coral,
    features: ["Ward-specific ticket view", "Community performance metrics", "Citizen satisfaction scores", "Ward committee meeting reports", "Infrastructure project monitoring"],
    delay: 20,
  },
  {
    role: "Audit Committee",
    tier: "Tier 2 \u2014 Oversight",
    tierColor: colors.coral,
    features: ["Financial compliance dashboard", "Risk register access", "Audit finding tracking", "Internal control assessment", "Annual financial statement review"],
    delay: 28,
  },
  {
    role: "Internal Auditor",
    tier: "Tier 3 \u2014 Operational",
    tierColor: colors.teal,
    features: ["Audit trail viewer", "Process compliance checks", "Evidence verification", "Fraud risk assessment", "Management response tracking"],
    delay: 36,
  },
  {
    role: "MPAC",
    tier: "Tier 2 \u2014 Oversight",
    tierColor: colors.coral,
    features: ["Annual report review", "Oversight resolution tracking", "Performance assessment", "Quarterly report analysis", "Public participation outcomes"],
    delay: 44,
  },
];

export const D11_OversightDashboards: React.FC = () => {
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
        <SectionTitle number="11" title="Oversight & Governance" color={colors.coral} delay={0} />

        <AnimatedText
          text="Four Oversight Perspectives"
          fontSize={40}
          fontFamily={fontFamily.display}
          delay={8}
          textAlign="center"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, flex: 1 }}>
          {oversightRoles.map((role, i) => (
            <RoleCard
              key={i}
              role={role.role}
              tier={role.tier}
              tierColor={role.tierColor}
              features={role.features}
              delay={role.delay}
            />
          ))}
        </div>

        <GlassCard delay={55} style={{ padding: "16px 24px", textAlign: "center" as const }}>
          <span style={{ fontFamily: fontFamily.body, fontSize: 19, color: colors.text.secondary }}>
            Each role sees only the data relevant to their oversight function — powered by PostgreSQL RLS
          </span>
        </GlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
