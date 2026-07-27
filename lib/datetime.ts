const pad = (n: number) => String(n).padStart(2, "0");

function jstInstant(y: number, month1to12: number, d: number, hh = 0, mm = 0): Date {
  return new Date(`${y}-${pad(month1to12)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00+09:00`);
}

function todayInJST(): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  return { y: g("year"), m: g("month"), d: g("day") };
}

/** save date fucntion */
export function nowJST(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  let hour = g("hour");
  if (hour === "24") hour = "00";
  return `${g("year")}-${g("month")}-${g("day")}T${hour}:${g("minute")}:${g("second")}+09:00`;
}

/**
parse date from sheet
 1) ISO 8601
 2) "YYYY/M/D ..."
 3) "M/D (曜日) HH:mm~"
 */
export function parseSheetDate(
  value: string,
  opts: { yearHint?: "current" | "future" | "past" } = {}
): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  const hint = opts.yearHint ?? "current";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00+09:00`);
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(raw);
    const d = new Date(hasZone ? raw.replace(" ", "T") : `${raw.replace(" ", "T")}+09:00`);
    if (!isNaN(d.getTime())) return d;
  }

  const t = raw.match(/(\d{1,2}):(\d{2})/);
  const hour = t ? parseInt(t[1], 10) : 0;
  const minute = t ? parseInt(t[2], 10) : 0;

  const withYear = raw.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})/);
  if (withYear) return jstInstant(+withYear[1], +withYear[2], +withYear[3], hour, minute);

  const md = raw.match(/(\d{1,2})\/(\d{1,2})/);
  if (!md) return null;
  const month = +md[1], day = +md[2];
  const today = todayInJST();
  const startOfToday = jstInstant(today.y, today.m, today.d, 0, 0);
  let d = jstInstant(today.y, month, day, hour, minute);
  if (hint === "future" && d < startOfToday) d = jstInstant(today.y + 1, month, day, hour, minute);
  if (hint === "past" && d > startOfToday) d = jstInstant(today.y - 1, month, day, hour, minute);
  return d;
}

/** display as "7/22 (金) 16:00〜" */
export function formatEventDateJP(
  value: string,
  opts: { yearHint?: "current" | "future" | "past" } = {}
): string {
  const d = parseSheetDate(value, opts);
  if (!d) return value;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const base = `${g("month")}/${g("day")} (${g("weekday")})`;
  const hh = g("hour"), mm = g("minute");
  return hh === "00" && mm === "00" ? base : `${base} ${hh}:${mm}〜`;
}

/** "YYYY-MM" */
export function jstYearMonth(date: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}`;
}

export function formatJapaneseDate(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.includes("年")) return raw;
  const d = parseSheetDate(raw, { yearHint: "future" });
  if (!d) return raw;
  const p = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}年${g("month")}月${g("day")}日`;
}

function jstDateKey(d: Date): string {
    const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const g = (t: string) => p.find((x) => x.type === t)!.value;
    return `${g("year")}-${g("month")}-${g("day")}`;
}

export function isExpired(value: string, now = new Date()): boolean {
    const raw = String(value ?? "").trim();
    if(!raw) return false;
    const exp = parseSheetDate(raw);
    if(!exp) {
        console.warn(`[isExpired] cannot parse expiration_date: ${raw}`);
        return false;
    }
    return jstDateKey(now) > jstDateKey(exp);
}