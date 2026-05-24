// Utilities to safely handle dates across timezones.
// Assume backend stores either "YYYY-MM-DD" or full ISO timestamps.
// We always display in America/Sao_Paulo and avoid UTC midnight shifts.

const BR_TZ = "America/Sao_Paulo";

/**
 * Parse a date string to a Date anchored at noon LOCAL time of the intended day.
 * Handles "YYYY-MM-DD", "DD/MM/YYYY" and full ISO timestamps.
 */
export function parseLocalDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let year = parseInt(y);
    if (year < 100) year += 2000;
    const day = parseInt(d);
    const month = parseInt(m);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (dt.getDate() !== day || dt.getMonth() !== month - 1) return null;
    return dt;
  }

  // YYYY-MM-DD (bare) — build at local noon to avoid UTC shift
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const dt = new Date(+iso[1], +iso[2] - 1, +iso[3], 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Full ISO timestamp — trust Date parsing
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Format date in pt-BR (DD/MM/YYYY) in BR timezone. */
export function formatBR(input: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseLocalDate(input);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: BR_TZ, ...opts });
}

/** Add N months clamping day to last day of resulting month (avoids 31/01 → 03/03). */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const y = d.getFullYear() + Math.floor(targetMonth / 12);
  const m = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  return new Date(y, m, day, 12, 0, 0, 0);
}

/** Convert "YYYY-MM-DD" to a Date at local noon for storage via .toISOString(). */
export function localNoonISO(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return (d ?? new Date()).toISOString();
}
