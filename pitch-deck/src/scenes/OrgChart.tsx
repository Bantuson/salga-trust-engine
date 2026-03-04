import { AbsoluteFill } from "remotion";
import { colors, glass } from "../design/tokens";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

interface OrgNode {
  id: string;
  role: string;
  title: string;
  tier: 1 | 2 | 3 | 4;
  department?: string;
  children?: OrgNode[];
  platformRole?: string;
}

const TIER_COLORS: Record<number, string> = {
  1: colors.gold,
  2: colors.coral,
  3: colors.teal,
  4: colors.rose.light,
};

const TIER_LABELS: Record<number, string> = {
  1: "TIER 1 \u2014 EXECUTIVE",
  2: "TIER 2 \u2014 DIRECTORS",
  3: "TIER 3 \u2014 OPERATIONAL",
  4: "TIER 4 \u2014 FRONTLINE",
};

const TIER_GLOWS: Record<number, string> = {
  1: "0 0 24px rgba(255,213,79,0.3)",
  2: "0 0 24px rgba(255,107,74,0.3)",
  3: "0 0 24px rgba(0,191,165,0.3)",
  4: "0 0 24px rgba(230,139,165,0.3)",
};

/* Platform pages each role can access — from useRoleBasedNav.ts */
const ROLE_PAGES: Record<string, string> = {
  salga_admin:
    "Dashboard \u00b7 Municipalities \u00b7 Access Requests \u00b7 Role Approvals \u00b7 System",
  executive_mayor:
    "Dashboard \u00b7 Tickets \u00b7 Departments \u00b7 Organogram \u00b7 Analytics \u00b7 Performance \u00b7 Settings",
  municipal_manager:
    "Dashboard \u00b7 Tickets \u00b7 Departments \u00b7 Organogram \u00b7 Analytics \u00b7 Performance \u00b7 Settings",
  cfo: "Dashboard \u00b7 Tickets \u00b7 Departments \u00b7 Organogram \u00b7 Analytics \u00b7 Performance",
  speaker: "Dashboard \u00b7 Reports",
  admin: "Dashboard \u00b7 Tickets \u00b7 Teams \u00b7 Organogram \u00b7 Analytics \u00b7 Performance \u00b7 Settings",
  manager:
    "Dashboard \u00b7 Tickets \u00b7 Teams \u00b7 Organogram \u00b7 Analytics \u00b7 Performance \u00b7 Settings",
  section56_director:
    "Dashboard \u00b7 My Department \u00b7 Organogram \u00b7 Tickets \u00b7 Performance",
  department_manager:
    "Dashboard \u00b7 My Department \u00b7 Organogram \u00b7 Tickets \u00b7 Performance",
  ward_councillor:
    "Dashboard \u00b7 Ward Tickets \u00b7 Performance \u00b7 Statutory Reports",
  chief_whip:
    "Dashboard \u00b7 Ward Tickets \u00b7 Performance \u00b7 Statutory Reports",
  pms_officer:
    "Dashboard \u00b7 Departments \u00b7 Organogram \u00b7 Performance \u00b7 Analytics",
  audit_committee_member:
    "Dashboard \u00b7 Performance \u00b7 Statutory Reports",
  internal_auditor: "Dashboard \u00b7 Performance \u00b7 Statutory Reports",
  mpac_member: "Dashboard \u00b7 Performance \u00b7 Statutory Reports",
  saps_liaison: "GBV Cases \u00b7 Reports",
  field_worker: "My Tickets \u00b7 Team \u00b7 Completed",
  citizen: "Dashboard",
};

const orgTree: OrgNode = {
  id: "council",
  role: "Municipal Council",
  title: "Elected Body \u2014 Governs Municipality",
  tier: 1,
  children: [
    {
      id: "salga",
      role: "SALGA Admin",
      title: "Cross-Municipality Oversight & Benchmarking",
      tier: 1,
      platformRole: "salga_admin",
    },
    {
      id: "mayor",
      role: "Executive Mayor",
      title: "Political Head of Municipality",
      tier: 1,
      platformRole: "executive_mayor",
      children: [
        {
          id: "speaker",
          role: "Speaker",
          title: "Council Presiding Officer",
          tier: 1,
          platformRole: "speaker",
        },
        {
          id: "chief_whip",
          role: "Chief Whip",
          title: "Party Discipline & Council Coordination",
          tier: 2,
          platformRole: "chief_whip",
        },
        {
          id: "ward_councillors",
          role: "Ward Councillors",
          title: "Ward Representatives \u2014 Community Liaison",
          tier: 2,
          platformRole: "ward_councillor",
        },
      ],
    },
    {
      id: "mm",
      role: "Municipal Manager",
      title: "Administrative Head (Section 54A)",
      tier: 1,
      platformRole: "municipal_manager",
      children: [
        {
          id: "cfo",
          role: "Chief Financial Officer",
          title: "Financial Management (Section 80)",
          tier: 1,
          platformRole: "cfo",
          department: "Finance",
          children: [
            {
              id: "fin_dept_mgr",
              role: "Department Manager",
              title: "Finance Operations Lead",
              tier: 3,
              platformRole: "department_manager",
              department: "Finance",
              children: [
                {
                  id: "fin_field",
                  role: "Field Workers",
                  title: "Revenue Collection & Billing",
                  tier: 4,
                  platformRole: "field_worker",
                },
              ],
            },
          ],
        },
        {
          id: "dir_infra",
          role: "Director: Infrastructure",
          title: "Section 56 Manager \u2014 Engineering & Utilities",
          tier: 2,
          platformRole: "section56_director",
          department: "Infrastructure & Engineering",
          children: [
            {
              id: "infra_dept_mgr",
              role: "Department Manager",
              title: "Roads & Stormwater Operations",
              tier: 3,
              platformRole: "department_manager",
              department: "Roads & Stormwater",
              children: [
                {
                  id: "infra_field",
                  role: "Field Workers",
                  title: "Maintenance Crews \u2014 Roads & Drainage",
                  tier: 4,
                  platformRole: "field_worker",
                },
              ],
            },
          ],
        },
        {
          id: "dir_community",
          role: "Director: Community Services",
          title: "Section 56 Manager \u2014 Public Amenities",
          tier: 2,
          platformRole: "section56_director",
          department: "Community Services",
          children: [
            {
              id: "comm_dept_mgr",
              role: "Department Manager",
              title: "Parks & Recreation Operations",
              tier: 3,
              platformRole: "department_manager",
              department: "Parks & Recreation",
              children: [
                {
                  id: "comm_field",
                  role: "Field Workers",
                  title: "Parks Maintenance & Groundskeeping",
                  tier: 4,
                  platformRole: "field_worker",
                },
              ],
            },
            {
              id: "saps_liaison",
              role: "SAPS Liaison",
              title: "GBV Case Officer \u2014 Police Station Link",
              tier: 3,
              platformRole: "saps_liaison",
            },
          ],
        },
        {
          id: "dir_corporate",
          role: "Director: Corporate Services",
          title: "Section 56 Manager \u2014 HR, IT, Legal",
          tier: 2,
          platformRole: "section56_director",
          department: "Corporate Services",
          children: [
            {
              id: "admin",
              role: "Admin",
              title: "System Administrator \u2014 Full Platform Access",
              tier: 1,
              platformRole: "admin",
            },
            {
              id: "pms_officer",
              role: "PMS Officer",
              title: "Performance Management System Coordinator",
              tier: 3,
              platformRole: "pms_officer",
            },
            {
              id: "manager",
              role: "Manager",
              title: "General Operational Manager",
              tier: 3,
              platformRole: "manager",
            },
          ],
        },
        {
          id: "audit_group",
          role: "Oversight & Audit",
          title: "Independent Oversight Functions",
          tier: 3,
          children: [
            {
              id: "audit_comm",
              role: "Audit Committee Member",
              title: "Financial Oversight & External Audit Liaison",
              tier: 3,
              platformRole: "audit_committee_member",
            },
            {
              id: "int_auditor",
              role: "Internal Auditor",
              title: "Compliance, Risk & Internal Controls",
              tier: 3,
              platformRole: "internal_auditor",
            },
            {
              id: "mpac",
              role: "MPAC Member",
              title: "Municipal Public Accounts Committee",
              tier: 3,
              platformRole: "mpac_member",
            },
          ],
        },
      ],
    },
    {
      id: "citizen",
      role: "Citizens",
      title: "Service Recipients \u2014 Report via WhatsApp / Portal",
      tier: 4,
      platformRole: "citizen",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  LAYOUT — row-wrapping, max 2 children per row                     */
/* ------------------------------------------------------------------ */

interface LayoutNode extends OrgNode {
  x: number;
  y: number;
  depth: number;
  children?: LayoutNode[];
}

const NODE_W = 280;
const NODE_H = 200;
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
/*  CONNECTORS — clean bracket/trunk style                             */
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

  // Vertical trunk: parent bottom → last bus level
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
/*  COMPONENTS                                                         */
/* ------------------------------------------------------------------ */

function Card({ node }: { node: LayoutNode }) {
  const tc = TIER_COLORS[node.tier];
  const pages = node.platformRole
    ? ROLE_PAGES[node.platformRole]
    : undefined;

  return (
    <div
      style={{
        position: "absolute",
        left: node.x - NODE_W / 2,
        top: node.y,
        width: NODE_W,
        minHeight: NODE_H,
        background: glass.bg,
        backdropFilter: `blur(${glass.blur}px)`,
        border: `2px solid ${tc}55`,
        borderRadius: 16,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column" as const,
        boxShadow: TIER_GLOWS[node.tier],
        overflow: "hidden",
      }}
    >
      {/* Tier color top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: tc,
          borderRadius: "16px 16px 0 0",
        }}
      />

      {/* Role name */}
      <div
        style={{
          fontSize: 19,
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
          fontSize: 13,
          color: colors.text.secondary,
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
            fontFamily: "monospace",
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
            color: colors.text.secondary,
            opacity: 0.4,
            marginTop: 2,
          }}
        >
          Dept: {node.department}
        </div>
      )}

      {/* Platform pages this role accesses */}
      {pages && (
        <>
          <div
            style={{
              height: 1,
              background: `${tc}22`,
              margin: "8px 0 6px",
            }}
          />
          <div
            style={{
              fontSize: 10,
              color: colors.text.secondary,
              opacity: 0.5,
              marginBottom: 2,
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              fontWeight: 600,
            }}
          >
            Pages
          </div>
          <div
            style={{
              fontSize: 11,
              color: tc,
              opacity: 0.65,
              lineHeight: 1.45,
            }}
          >
            {pages}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN                                                               */
/* ------------------------------------------------------------------ */

export const OrgChart: React.FC = () => {
  const root = layoutTree(orgTree, 0, 0, 0);
  const nodes = flatten(root);
  const connLines = collectLines(root);

  let minX = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - NODE_W / 2);
    maxX = Math.max(maxX, n.x + NODE_W / 2);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  const treeW = maxX - minX;
  const PADDING = 60;
  const HEADER = 110;
  const FOOTER = 80;

  const shiftX = PADDING - minX;
  const totalW = treeW + PADDING * 2;
  const totalH = HEADER + maxY + FOOTER;

  return (
    <AbsoluteFill
      style={{
        width: totalW,
        height: totalH,
        background: `radial-gradient(ellipse at 50% 8%, #2a1520 0%, ${colors.dark} 70%)`,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(205,94,129,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(205,94,129,0.03) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: HEADER,
          padding: "28px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: colors.text.primary,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Municipal Organizational Structure
          </h1>
          <p
            style={{
              fontSize: 16,
              color: colors.text.secondary,
              margin: "6px 0 0 0",
            }}
          >
            SALGA Trust Engine &mdash; 18-Role 4-Tier Hierarchy with Platform
            Page Access
          </p>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 6 }}>
          {[1, 2, 3, 4].map((t) => (
            <div
              key={t}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: TIER_COLORS[t],
                  boxShadow: TIER_GLOWS[t],
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TIER_COLORS[t],
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                {TIER_LABELS[t]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tree area */}
      <div
        style={{
          position: "absolute",
          top: HEADER,
          left: shiftX,
          width: treeW,
          height: maxY,
        }}
      >
        {/* Connector lines SVG */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: treeW,
            height: maxY + NODE_H,
            pointerEvents: "none",
            overflow: "visible",
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

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: FOOTER,
          padding: "0 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: 0.7,
        }}
      >
        <div style={{ display: "flex", gap: 40 }}>
          {[
            { l: "Total Roles", v: "18" },
            { l: "Tiers", v: "4" },
            { l: "Approval Chain", v: "Tier 1 requires SALGA approval" },
            {
              l: "Inheritance",
              v: "Higher tiers access lower tier endpoints",
            },
          ].map((s) => (
            <div key={s.l}>
              <div
                style={{
                  fontSize: 11,
                  color: colors.text.secondary,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.08em",
                }}
              >
                {s.l}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: colors.text.primary,
                }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: colors.rose.light, opacity: 0.5 }}>
          SALGA Trust Engine v2.0
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Export computed dimensions for Root.tsx
export function getOrgChartDimensions() {
  const root = layoutTree(orgTree, 0, 0, 0);
  const nodes = flatten(root);
  let minX = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - NODE_W / 2);
    maxX = Math.max(maxX, n.x + NODE_W / 2);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  const PADDING = 60;
  return {
    width: Math.ceil(maxX - minX + PADDING * 2),
    height: Math.ceil(110 + maxY + 80),
  };
}
