/**
 * OrganogramTree — interactive department hierarchy visualization.
 *
 * Wraps react-d3-tree to render a collapsible/expandable tree of municipality
 * departments with director names shown as node attributes.
 *
 * Data shape matches the organogram endpoint response:
 *   GET /api/v1/departments/organogram
 *
 * Usage:
 *   <OrganogramTree data={rootNode} onNodeClick={(node) => console.log(node)} />
 */

import Tree from 'react-d3-tree';
import { useCallback, useState } from 'react';

/** Matches OrganogramNode schema from the backend. */
export interface OrgNode {
  name: string;
  attributes?: Record<string, string>;
  children?: OrgNode[];
}

interface OrganogramTreeProps {
  /** Root node of the organogram tree (from GET /api/v1/departments/organogram). */
  data: OrgNode;
  /** Optional click handler — receives the clicked node's data. */
  onNodeClick?: (node: OrgNode) => void;
}

/**
 * OrganogramTree renders a vertical, collapsible department tree.
 *
 * - Teal circle nodes with 3-letter abbreviations
 * - Department name below each node
 * - Director name (if present) shown in grey below department name
 * - Tree is centered horizontally in its container
 * - Nodes collapse/expand on click
 */
export function OrganogramTree({ data, onNodeClick }: OrganogramTreeProps) {
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  // Measure container width on mount to center the tree root
  const containerRef = useCallback((containerElem: HTMLDivElement | null) => {
    if (containerElem !== null) {
      const { width } = containerElem.getBoundingClientRect();
      setTranslate({ x: width / 2, y: 60 });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '600px', position: 'relative' }}
      className="bg-gray-50 rounded-xl border border-gray-200"
    >
      <Tree
        data={data}
        translate={translate}
        orientation="vertical"
        pathFunc="step"
        collapsible={true}
        initialDepth={2}
        separation={{ siblings: 1.5, nonSiblings: 2 }}
        nodeSize={{ x: 160, y: 120 }}
        renderCustomNodeElement={({ nodeDatum, toggleNode }) => (
          <g
            onClick={() => {
              toggleNode();
              onNodeClick?.(nodeDatum as unknown as OrgNode);
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* Teal circle */}
            <circle r={24} fill="#0D9488" stroke="#065F46" strokeWidth={2} />

            {/* 3-letter abbreviation (uppercase) */}
            <text
              dy=".35em"
              textAnchor="middle"
              fill="white"
              fontSize={11}
              fontWeight={700}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {(nodeDatum.name as string).slice(0, 3).toUpperCase()}
            </text>

            {/* Department name */}
            <text
              dy="3.2em"
              textAnchor="middle"
              fill="#111827"
              fontSize={12}
              fontWeight={600}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {nodeDatum.name}
            </text>

            {/* Director name (if present in node attributes) */}
            {nodeDatum.attributes?.director && (
              <text
                dy="4.8em"
                textAnchor="middle"
                fill="#6B7280"
                fontSize={10}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {nodeDatum.attributes.director}
              </text>
            )}
          </g>
        )}
      />
    </div>
  );
}
