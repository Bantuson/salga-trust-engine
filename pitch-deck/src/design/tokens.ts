// Design tokens matching the SALGA Trust Engine dashboard design system

export const colors = {
  rose: {
    primary: "#cd5e81",
    light: "#e68ba5",
    deep: "#a34866",
  },
  gold: "#ffd54f",
  teal: "#00bfa5",
  coral: "#FF6B4A",
  text: {
    primary: "#f9f7f8",
    secondary: "#e0d4d8",
  },
  dark: "#1a0a10",
} as const;

export const glass = {
  bg: "rgba(255,255,255,0.12)",
  bgStrong: "rgba(255,255,255,0.18)",
  blur: 16,
  blurStrong: 28,
  border: "rgba(255,255,255,0.2)",
  borderLight: "rgba(255,255,255,0.12)",
  radius: 24,
} as const;

export const glow = {
  gold: "0 0 40px rgba(255,213,79,0.3), 0 0 80px rgba(255,213,79,0.1)",
  teal: "0 0 40px rgba(0,191,165,0.3), 0 0 80px rgba(0,191,165,0.1)",
  rose: "0 0 40px rgba(205,94,129,0.3), 0 0 80px rgba(205,94,129,0.1)",
} as const;

export const gradients = {
  roseToDeep: `linear-gradient(135deg, ${colors.rose.primary}, ${colors.rose.deep})`,
  goldToTeal: `linear-gradient(135deg, ${colors.gold}, ${colors.teal})`,
  darkOverlay: "linear-gradient(180deg, rgba(26,10,16,0.55) 0%, rgba(26,10,16,0.35) 50%, rgba(26,10,16,0.55) 100%)",
  roseVignette: "radial-gradient(ellipse at center, transparent 30%, rgba(163,72,102,0.08) 70%, rgba(26,10,16,0.25) 100%)",
} as const;
