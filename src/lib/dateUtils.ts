// Utilities to safely handle dates across timezones.
// Backend stores either "YYYY-MM-DD" (date column) or full ISO timestamps.
// All display happens in America/Sao_Paulo. All construction anchors at LOCAL noon
// so DST and UTC shifts cannot move the day.

export const BR_TZ = "America/Sao_Paulo";

/**
 * Parse a date string to a Date anchored at noon LOCAL time of the intended day.
 * Handles "YYYY-MM-DD", "DD/MM/YYYY" and full ISO timestamps.
 * Returns null for invalid input.
 */
export function parseLocalDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;

  // DD/MM/YYYY ou DD-MM-YYYY
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

  // ISO com hora mas sem timezone → tratar como local (não UTC)
  const isoNoTz = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoNoTz) {
    const dt = new Date(
      +isoNoTz[1], +isoNoTz[2] - 1, +isoNoTz[3],
      +isoNoTz[4], +isoNoTz[5], +(isoNoTz[6] ?? 0), 0
    );
    return isNaN(dt.getTime()) ? null : dt;
  }

  // ISO completo com timezone → confiar no parser nativo
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Format date in pt-BR (DD/MM/YYYY) in BR timezone. */
export function formatBR(input: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseLocalDate(input);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: BR_TZ, ...opts });
}

/** Format date+time in pt-BR (DD/MM/YYYY HH:mm) in BR timezone. */
export function formatBRDateTime(input: string | Date | null | undefined): string {
  const d = parseLocalDate(input);
  if (!d) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: BR_TZ,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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

/** Add N days (calendar). Always returns a new Date at local noon. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

export type BusinessDayMode = "mon-fri" | "mon-sat" | "mon-sun";

/** Add N business days respecting the chosen week mode. */
export function addBusinessDays(date: Date, days: number, mode: BusinessDayMode = "mon-fri"): Date {
  if (mode === "mon-sun") return addDays(date, days);
  const cur = new Date(date);
  let added = 0;
  while (added < days) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (mode === "mon-fri" && (dow === 0 || dow === 6)) continue;
    if (mode === "mon-sat" && dow === 0) continue;
    added++;
  }
  cur.setHours(12, 0, 0, 0);
  return cur;
}

/** Whole days between two dates (b - a), based on local midnight. */
export function daysBetween(a: string | Date, b: string | Date): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  if (!da || !db) return 0;
  const ms = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime()
           - new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
  return Math.round(ms / 86400000);
}

/** True if `due` is strictly before today (BR local). */
export function isOverdue(due: string | Date | null | undefined, reference: Date = new Date()): boolean {
  const d = parseLocalDate(due);
  if (!d) return false;
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dd.getTime() < today.getTime();
}

/** "YYYY-MM-DD" suitable for <input type="date"> bound to LOCAL date. */
export function toDateInputValue(input: string | Date | null | undefined): string {
  const d = parseLocalDate(input);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayLocalISO(): string {
  return toDateInputValue(new Date());
}

/** Convert "YYYY-MM-DD" to a Date at local noon for storage via .toISOString(). */
export function localNoonISO(dateStr: string | Date | null | undefined): string {
  const d = parseLocalDate(dateStr);
  return (d ?? new Date()).toISOString();
}
