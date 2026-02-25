import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface FirewallLayer {
  label: string;
  color: string;
}

interface FirewallDiagramProps {
  layers: FirewallLayer[];
  delay?: number;
  stagger?: number;
}

export const FirewallDiagram: React.FC<FirewallDiagramProps> = ({
  layers,
  delay = 0,
  stagger = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const centerX = 270;
  const centerY = 270;
  const maxRadius = 240;
  const minRadius = 60;

  return (
    <svg viewBox="0 0 540 540" width="100%">
      {/* Concentric rings, outermost first */}
      {[...layers].reverse().map((layer, reverseIdx) => {
        const i = layers.length - 1 - reverseIdx;
        const ringDelay = delay + i * stagger;
        const entrance = spring({
          frame,
          fps,
          delay: ringDelay,
          config: { damping: 200 },
        });

        const radius =
          minRadius + ((maxRadius - minRadius) / (layers.length - 1)) * (layers.length - 1 - i);
        const scale = interpolate(entrance, [0, 1], [0, 1]);

        return (
          <g key={i}>
            {/* Ring */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke={layer.color}
              strokeWidth={2}
              opacity={interpolate(entrance, [0, 1], [0, 0.6])}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: `${centerX}px ${centerY}px`,
              }}
            />
            {/* Fill */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill={`${layer.color}11`}
              opacity={entrance}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: `${centerX}px ${centerY}px`,
              }}
            />
            {/* Label */}
            <text
              x={centerX}
              y={centerY - radius + 20}
              textAnchor="middle"
              fill={layer.color}
              fontSize={12}
              fontFamily={fontFamily.body}
              fontWeight={600}
              opacity={interpolate(entrance, [0.5, 1], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}
            >
              {layer.label}
            </text>
          </g>
        );
      })}

      {/* Center shield icon */}
      {(() => {
        const centerEntrance = spring({
          frame,
          fps,
          delay: delay + layers.length * stagger,
          config: { damping: 12, stiffness: 200 },
        });
        return (
          <g
            style={{
              transform: `scale(${centerEntrance})`,
              transformOrigin: `${centerX}px ${centerY}px`,
            }}
          >
            <circle cx={centerX} cy={centerY} r={45} fill={`${colors.rose.deep}66`} />
            <text
              x={centerX}
              y={centerY + 12}
              textAnchor="middle"
              fontSize={36}
              opacity={centerEntrance}
            >
              🛡️
            </text>
          </g>
        );
      })()}
    </svg>
  );
};
