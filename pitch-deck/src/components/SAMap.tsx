import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";

// Simplified SVG paths for SA provinces (approximate shapes)
const provinces: {
  id: string;
  name: string;
  d: string;
  labelX: number;
  labelY: number;
}[] = [
  {
    id: "NC",
    name: "Northern Cape",
    d: "M120,200 L320,140 L420,180 L440,280 L380,360 L280,380 L180,340 L100,280 Z",
    labelX: 270,
    labelY: 260,
  },
  {
    id: "WC",
    name: "Western Cape",
    d: "M100,280 L180,340 L280,380 L260,440 L180,460 L100,420 L80,360 Z",
    labelX: 175,
    labelY: 400,
  },
  {
    id: "EC",
    name: "Eastern Cape",
    d: "M280,380 L380,360 L480,380 L500,440 L440,480 L340,470 L260,440 Z",
    labelX: 385,
    labelY: 420,
  },
  {
    id: "FS",
    name: "Free State",
    d: "M320,140 L440,140 L480,200 L480,280 L440,280 L420,180 Z",
    labelX: 420,
    labelY: 210,
  },
  {
    id: "KZN",
    name: "KwaZulu-Natal",
    d: "M440,140 L540,120 L560,200 L520,280 L480,280 L480,200 Z",
    labelX: 510,
    labelY: 200,
  },
  {
    id: "NW",
    name: "North West",
    d: "M320,80 L420,60 L440,140 L320,140 Z",
    labelX: 375,
    labelY: 105,
  },
  {
    id: "GP",
    name: "Gauteng",
    d: "M420,60 L470,60 L480,100 L440,140 Z",
    labelX: 450,
    labelY: 95,
  },
  {
    id: "MP",
    name: "Mpumalanga",
    d: "M470,60 L560,40 L580,100 L540,120 L440,140 L480,100 Z",
    labelX: 525,
    labelY: 85,
  },
  {
    id: "LP",
    name: "Limpopo",
    d: "M320,80 L420,60 L470,60 L560,40 L540,10 L400,10 L320,40 Z",
    labelX: 440,
    labelY: 35,
  },
];

interface SAMapProps {
  highlightProvince?: string;
  highlightColor?: string;
  markers?: { x: number; y: number; label: string; delay: number }[];
  delay?: number;
}

export const SAMap: React.FC<SAMapProps> = ({
  highlightProvince,
  highlightColor = colors.rose.primary,
  markers = [],
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mapEntrance = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
  });

  const mapScale = interpolate(mapEntrance, [0, 1], [0.85, 1]);

  return (
    <svg
      viewBox="0 0 660 500"
      width="100%"
      style={{
        opacity: mapEntrance,
        transform: `scale(${mapScale})`,
      }}
    >
      {/* Province shapes */}
      {provinces.map((prov) => {
        const isHighlighted = prov.id === highlightProvince;
        const fillColor = isHighlighted
          ? highlightColor
          : "rgba(255,255,255,0.08)";
        const strokeColor = isHighlighted
          ? highlightColor
          : "rgba(255,255,255,0.2)";

        const highlightPulse = isHighlighted
          ? spring({
              frame,
              fps,
              delay: delay + 15,
              config: { damping: 200 },
            })
          : 0;

        return (
          <g key={prov.id}>
            {/* Glow for highlighted province */}
            {isHighlighted && (
              <path
                d={prov.d}
                fill={`${highlightColor}33`}
                stroke="none"
                style={{
                  filter: `blur(12px)`,
                  opacity: highlightPulse,
                }}
              />
            )}
            <path
              d={prov.d}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={isHighlighted ? 2.5 : 1}
              opacity={isHighlighted ? interpolate(highlightPulse, [0, 1], [0.4, 0.9]) : 0.6}
            />
          </g>
        );
      })}

      {/* Markers */}
      {markers.map((marker, i) => {
        const markerEntrance = spring({
          frame,
          fps,
          delay: marker.delay,
          config: { damping: 12, stiffness: 200 },
        });

        const dropY = interpolate(markerEntrance, [0, 1], [-30, 0]);

        return (
          <g
            key={i}
            style={{
              opacity: markerEntrance,
              transform: `translate(${marker.x}px, ${marker.y + dropY}px)`,
            }}
          >
            {/* Pin */}
            <circle cx={0} cy={0} r={8} fill={colors.gold} />
            <circle cx={0} cy={0} r={4} fill={colors.dark} />
            {/* Pulse ring */}
            <circle
              cx={0}
              cy={0}
              r={14}
              fill="none"
              stroke={colors.gold}
              strokeWidth={1.5}
              opacity={0.5}
            />
            {/* Label */}
            <text
              x={0}
              y={-18}
              textAnchor="middle"
              fill={colors.text.primary}
              fontSize={13}
              fontWeight={600}
            >
              {marker.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
