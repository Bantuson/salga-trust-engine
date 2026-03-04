/**
 * SA Financial Year Utility
 *
 * South Africa's financial year runs April to March (April-March convention).
 * Q1 = April–June, Q2 = July–September, Q3 = October–December, Q4 = January–March
 *
 * Example: March 2026 is Q4 of FY 2025/26 (NOT Q1 of FY 2026/27).
 */

/**
 * Returns the SA financial year string for a given date.
 * Format: "2025/26"
 *
 * April 2025 → "2025/26"
 * March 2026 → "2025/26"
 * April 2026 → "2026/27"
 */
export function getSAFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January, 3 = April

  // If month is April (3) or later, FY starts this year
  // If month is January (0), February (1), or March (2), FY started the previous year
  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  // Format end year as 2-digit (e.g., 2025/26)
  return `${fyStartYear}/${String(fyEndYear).slice(-2)}`;
}

/**
 * Returns the current SA quarter (1–4) for a given date.
 *
 * Q1 = April–June   (months 3–5)
 * Q2 = July–Sept    (months 6–8)
 * Q3 = October–Dec  (months 9–11)
 * Q4 = January–Mar  (months 0–2)
 */
export function getCurrentSAQuarter(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth(); // 0-indexed

  if (month >= 3 && month <= 5) return 1;  // Apr, May, Jun
  if (month >= 6 && month <= 8) return 2;  // Jul, Aug, Sep
  if (month >= 9 && month <= 11) return 3; // Oct, Nov, Dec
  return 4;                                 // Jan, Feb, Mar
}

/**
 * Returns ISO date string bounds for a given financial year and quarter.
 *
 * @param year - Financial year string in "YYYY/YY" format, e.g. "2025/26"
 * @param quarter - Quarter number (1–4)
 * @returns { start: string, end: string } — ISO date strings (YYYY-MM-DD)
 *
 * Examples for FY "2025/26":
 *   Q1 → { start: "2025-04-01", end: "2025-06-30" }
 *   Q2 → { start: "2025-07-01", end: "2025-09-30" }
 *   Q3 → { start: "2025-10-01", end: "2025-12-31" }
 *   Q4 → { start: "2026-01-01", end: "2026-03-31" }
 */
export function getQuarterBounds(
  year: string,
  quarter: 1 | 2 | 3 | 4,
): { start: string; end: string } {
  // Parse the start year from "2025/26"
  const fyStartYear = parseInt(year.split('/')[0], 10);
  const fyEndYear = fyStartYear + 1;

  switch (quarter) {
    case 1:
      return {
        start: `${fyStartYear}-04-01`,
        end: `${fyStartYear}-06-30`,
      };
    case 2:
      return {
        start: `${fyStartYear}-07-01`,
        end: `${fyStartYear}-09-30`,
      };
    case 3:
      return {
        start: `${fyStartYear}-10-01`,
        end: `${fyStartYear}-12-31`,
      };
    case 4:
      return {
        start: `${fyEndYear}-01-01`,
        end: `${fyEndYear}-03-31`,
      };
  }
}
