/**
 * OrganogramTree -- Municipal organizational hierarchy visualization.
 *
 * Ported from the Remotion OrgChart (pitch-deck/src/scenes/OrgChart.tsx)
 * into a regular React component with:
 *  - No Remotion dependencies
 *  - No pages section on cards
 *  - Transparent background (renders on existing page bg)
 *  - Scrollable container with overflow: auto
 *  - CSS variables from @shared/design-tokens.css
 *
 * Layout: row-wrapping bracket tree, max 2 children per row.
 */

import { useMemo, useRef, useState, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

export interface OrgNode {
  id: string;
  role: string;
  title: string;
  tier: 1 | 2 | 3 | 4;
  department?: string;
  children?: OrgNode[];
  platformRole?: string;
}

const TIER_COLORS: Record<number, string> = {
  1: 'var(--color-gold, #FBBF24)',
  2: 'var(--color-coral, #FF6B4A)',
  3: 'var(--color-teal, #00bfa5)',
  4: 'var(--color-rose-light, #e68ba5)',
};

/** Raw hex values for contexts where CSS vars cannot be used (SVG, rgba) */
const TIER_COLORS_RAW: Record<number, string> = {
  1: '#FBBF24',
  2: '#FF6B4A',
  3: '#00bfa5',
  4: '#e68ba5',
};

const TIER_LABELS: Record<number, string> = {
  1: 'TIER 1 \u2014 EXECUTIVE',
  2: 'TIER 2 \u2014 DIRECTORS',
  3: 'TIER 3 \u2014 OPERATIONAL',
  4: 'TIER 4 \u2014 FRONTLINE',
};

const TIER_GLOWS: Record<number, string> = {
  1: '0 0 24px rgba(255,213,79,0.3)',
  2: '0 0 24px rgba(255,107,74,0.3)',
  3: '0 0 24px rgba(0,191,165,0.3)',
  4: '0 0 24px rgba(230,139,165,0.3)',
};

const orgTree: OrgNode = {
  id: 'council',
  role: 'Municipal Council',
  title: 'Elected Body \u2014 Governs Municipality',
  tier: 1,
  children: [
    {
      id: 'salga',
      role: 'SALGA Admin',
      title: 'Cross-Municipality Oversight & Benchmarking',
      tier: 1,
      platformRole: 'salga_admin',
    },
    {
      id: 'mayor',
      role: 'Executive Mayor',
      title: 'Political Head of Municipality',
      tier: 1,
      platformRole: 'executive_mayor',
      children: [
        {
          id: 'speaker',
          role: 'Speaker',
          title: 'Council Presiding Officer',
          tier: 1,
          platformRole: 'speaker',
        },
        {
          id: 'chief_whip',
          role: 'Chief Whip',
          title: 'Party Discipline & Council Coordination',
          tier: 2,
          platformRole: 'chief_whip',
        },
        {
          id: 'ward_councillors',
          role: 'Ward Councillors',
          title: 'Ward Representatives \u2014 Community Liaison',
          tier: 2,
          platformRole: 'ward_councillor',
        },
      ],
    },
    {
      id: 'mm',
      role: 'Municipal Manager',
      title: 'Administrative Head (Section 54A)',
      tier: 1,
      platformRole: 'municipal_manager',
      children: [
        {
          id: 'cfo',
          role: 'Chief Financial Officer',
          title: 'Financial Management (Section 80)',
          tier: 1,
          platformRole: 'cfo',
          department: 'Finance',
          children: [
            {
              id: 'fin_dept_mgr',
              role: 'Department Manager',
              title: 'Finance Operations Lead',
              tier: 3,
              platformRole: 'department_manager',
              department: 'Finance',
              children: [
                {
                  id: 'fin_field',
                  role: 'Field Workers',
                  title: 'Revenue Collection & Billing',
                  tier: 4,
                  platformRole: 'field_worker',
                },
              ],
            },
          ],
        },
        {
          id: 'dir_infra',
          role: 'Director: Infrastructure',
          title: 'Section 56 Manager \u2014 Engineering & Utilities',
          tier: 2,
          platformRole: 'section56_director',
          department: 'Infrastructure & Engineering',
          children: [
            {
              id: 'infra_dept_mgr',
              role: 'Department Manager',
              title: 'Roads & Stormwater Operations',
              tier: 3,
              platformRole: 'department_manager',
              department: 'Roads & Stormwater',
              children: [
                {
                  id: 'infra_field',
                  role: 'Field Workers',
                  title: 'Maintenance Crews \u2014 Roads & Drainage',
                  tier: 4,
                  platformRole: 'field_worker',
                },
              ],
            },
          ],
        },
        {
          id: 'dir_community',
          role: 'Director: Community Services',
          title: 'Section 56 Manager \u2014 Public Amenities',
          tier: 2,
          platformRole: 'section56_director',
          department: 'Community Services',
          children: [
            {
              id: 'comm_dept_mgr',
              role: 'Department Manager',
              title: 'Parks & Recreation Operations',
              tier: 3,
              platformRole: 'department_manager',
              department: 'Parks & Recreation',
              children: [
                {
                  id: 'comm_field',
                  role: 'Field Workers',
                  title: 'Parks Maintenance & Groundskeeping',
                  tier: 4,
                  platformRole: 'field_worker',
                },
              ],
            },
            {
              id: 'saps_liaison',
              role: 'SAPS Liaison',
              title: 'GBV Case Officer \u2014 Police Station Link',
              tier: 3,
              platformRole: 'saps_liaison',
            },
          ],
        },
        {
          id: 'dir_corporate',
          role: 'Director: Corporate Services',
          title: 'Section 56 Manager \u2014 HR, IT, Legal',
          tier: 2,
          platformRole: 'section56_director',
          department: 'Corporate Services',
          children: [
            {
              id: 'admin',
              role: 'Admin',
              title: 'System Administrator \u2014 Full Platform Access',
              tier: 1,
              platformRole: 'admin',
            },
            {
              id: 'pms_officer',
              role: 'PMS Officer',
              title: 'Performance Management System Coordinator',
              tier: 3,
              platformRole: 'pms_officer',
            },
            {
              id: 'manager',
              role: 'Manager',
              title: 'General Operational Manager',
              tier: 3,
              platformRole: 'manager',
            },
          ],
        },
        {
          id: 'audit_group',
          role: 'Oversight & Audit',
          title: 'Independent Oversight Functions',
          tier: 3,
          children: [
            {
              id: 'audit_comm',
              role: 'Audit Committee Member',
              title: 'Financial Oversight & External Audit Liaison',
              tier: 3,
              platformRole: 'audit_committee_member',
            },
            {
              id: 'int_auditor',
              role: 'Internal Auditor',
              title: 'Compliance, Risk & Internal Controls',
              tier: 3,
              platformRole: 'internal_auditor',
            },
            {
              id: 'mpac',
              role: 'MPAC Member',
              title: 'Municipal Public Accounts Committee',
              tier: 3,
              platformRole: 'mpac_member',
            },
          ],
        },
      ],
    },
    {
      id: 'citizen',
      role: 'Citizens',
      title: 'Service Recipients \u2014 Report via WhatsApp / Portal',
      tier: 4,
      platformRole: 'citizen',
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  LAYOUT -- row-wrapping, max 2 children per row                     */
/* ------------------------------------------------------------------ */

interface LayoutNode extends OrgNode {
  x: number;
  y: number;
  depth: number;
  children?: LayoutNode[];
}

const NODE_W = 260;
const NODE_H = 140;
const H_GAP = 30;
const V_GAP = 80;
const ROW_GAP = 50;
const MAX_PER_ROW = 2;

function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    result.push(arr.slice(i, i + n));
  }
  return result;
}

function rowSubtreeWidth(children: OrgNode[]): number {
  if (children.length === 0) return 0;
  return children.reduce((s, c) => s + subtreeWidth(c) + H_GAP, -H_GAP);
}

function subtreeWidth(node: OrgNode): number {
  if (!node.children || node.children.length === 0) return NODE_W;
  const rows = chunk(node.children, MAX_PER_ROW);
  const maxRowW = Math.max(...rows.map((r) => rowSubtreeWidth(r)));
  return Math.max(NODE_W, maxRowW);
}

function subtreeHeight(node: OrgNode): number {
  if (!node.children || node.children.length === 0) return NODE_H;
  const rows = chunk(node.children, MAX_PER_ROW);
  let h = NODE_H + V_GAP;
  for (let ri = 0; ri < rows.length; ri++) {
    h += Math.max(...rows[ri].map((c) => subtreeHeight(c)));
    if (ri < rows.length - 1) h += ROW_GAP;
  }
  return h;
}

function layoutTree(
  node: OrgNode,
  cx: number,
  y: number,
  d: number,
): LayoutNode {
  const kids: LayoutNode[] = [];
  if (node.children && node.children.length > 0) {
    const rows = chunk(node.children, MAX_PER_ROW);
    let rowY = y + NODE_H + V_GAP;
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const rw = rowSubtreeWidth(row);
      let lx = cx - rw / 2;
      for (const c of row) {
        const cw = subtreeWidth(c);
        kids.push(layoutTree(c, lx + cw / 2, rowY, d + 1));
        lx += cw + H_GAP;
      }
      const tallest = Math.max(...row.map((c) => subtreeHeight(c)));
      rowY += tallest + ROW_GAP;
    }
  }
  return {
    ...node,
    x: cx,
    y,
    depth: d,
    children: kids.length ? kids : undefined,
  };
}

function flatten(n: LayoutNode): LayoutNode[] {
  const r: LayoutNode[] = [n];
  if (n.children) for (const c of n.children) r.push(...flatten(c));
  return r;
}

/* ------------------------------------------------------------------ */
/*  CONNECTORS -- clean bracket/trunk style                            */
/* ------------------------------------------------------------------ */

interface ConnLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function collectLines(n: LayoutNode): ConnLine[] {
  const lines: ConnLine[] = [];
  if (!n.children || n.children.length === 0) return lines;

  // Group children by their Y position (same row)
  const rowMap = new Map<number, LayoutNode[]>();
  for (const c of n.children) {
    if (!rowMap.has(c.y)) rowMap.set(c.y, []);
    rowMap.get(c.y)!.push(c);
  }
  const sortedRows = [...rowMap.entries()].sort(([a], [b]) => a - b);

  const BUS_OFFSET = 28;
  const busLevels = sortedRows.map(([y]) => y - BUS_OFFSET);

  // Vertical trunk: parent bottom -> last bus level
  lines.push({
    x1: n.x,
    y1: n.y + NODE_H,
    x2: n.x,
    y2: busLevels[busLevels.length - 1],
  });

  // For each row of children
  sortedRows.forEach(([, children], ri) => {
    const busY = busLevels[ri];
    const allXs = [n.x, ...children.map((c) => c.x)];
    const minX = Math.min(...allXs);
    const maxX = Math.max(...allXs);

    // Horizontal bus spanning trunk to all children
    if (minX !== maxX) {
      lines.push({ x1: minX, y1: busY, x2: maxX, y2: busY });
    }

    // Drop lines from bus to each child top
    for (const c of children) {
      lines.push({ x1: c.x, y1: busY, x2: c.x, y2: c.y });
    }
  });

  // Recurse into children
  for (const c of n.children) {
    lines.push(...collectLines(c));
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/*  CARD COMPONENT                                                     */
/* ------------------------------------------------------------------ */

function Card({ node }: { node: LayoutNode }) {
  const tc = TIER_COLORS[node.tier];
  const tcRaw = TIER_COLORS_RAW[node.tier];

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x - NODE_W / 2,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `2px solid ${tcRaw}55`,
        borderRadius: 16,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column' as const,
        boxShadow: TIER_GLOWS[node.tier],
        overflow: 'hidden',
      }}
    >
      {/* Tier color top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: tc,
          borderRadius: '16px 16px 0 0',
        }}
      />

      {/* Role name */}
      <div
        style={{
          fontSize: 17,
          fontWeight: 700,
          color: tc,
          lineHeight: 1.3,
          marginBottom: 3,
        }}
      >
        {node.role}
      </div>

      {/* Title / description */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary, #e0d4d8)',
          lineHeight: 1.35,
        }}
      >
        {node.title}
      </div>

      {/* Platform role enum */}
      {node.platformRole && (
        <div
          style={{
            fontSize: 12,
            color: tc,
            opacity: 0.55,
            marginTop: 4,
            fontFamily: 'monospace',
          }}
        >
          {node.platformRole}
        </div>
      )}

      {/* Department */}
      {node.department && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary, #e0d4d8)',
            opacity: 0.4,
            marginTop: 2,
          }}
        >
          Dept: {node.department}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TIER LEGEND                                                        */
/* ------------------------------------------------------------------ */

export function TierLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: '2px 0',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
      }}
    >
      {([1, 2, 3, 4] as const).map((t) => (
        <div
          key={t}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: TIER_COLORS[t],
              boxShadow: TIER_GLOWS[t],
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: TIER_COLORS[t],
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            {TIER_LABELS[t]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */

export function OrganogramTree(_props?: { data?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { nodes, connLines, totalW, totalH, shiftX } = useMemo(() => {
    const root = layoutTree(orgTree, 0, 0, 0);
    const allNodes = flatten(root);
    const allLines = collectLines(root);

    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of allNodes) {
      minX = Math.min(minX, n.x - NODE_W / 2);
      maxX = Math.max(maxX, n.x + NODE_W / 2);
      maxY = Math.max(maxY, n.y + NODE_H);
    }

    const treeW = maxX - minX;
    const PADDING = 60;

    return {
      nodes: allNodes,
      connLines: allLines,
      totalW: treeW + PADDING * 2,
      totalH: maxY + PADDING * 2,
      shiftX: PADDING - minX,
    };
  }, []);

  // Track container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scale down to fit, never enlarge
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / totalW) : 1;

  return (
    <div
      ref={containerRef}
      className="organogram-scroll"
      data-lenis-prevent
      style={{
        overflow: 'hidden',
        width: '100%',
        height: totalH * scale + 20,
        background: 'transparent',
        fontFamily:
          'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      }}
    >
      {/* Tree canvas — scaled to fit */}
      <div
        style={{
          position: 'relative',
          width: totalW,
          height: totalH,
          margin: '0 auto',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {/* Tree area shifted so minX aligns to padding */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: shiftX,
          }}
        >
          {/* Connector lines SVG */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: totalW,
              height: totalH,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {connLines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* Node cards */}
          {nodes.map((n) => (
            <Card key={n.id} node={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
