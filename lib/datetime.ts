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

/** save date function */
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

// 2026年8月10日 (月) 10:00～20:00 または 2026年8月10日 (月) 10:00～2026年8月11日 (火) 20:00
export function formatEventSchedule(
  startRaw: string,
  endRaw?: string,
  opts: { yearHint?: "current" | "future" | "past" } = {}
): string {
  if (!startRaw) return "";

  let startStr = String(startRaw).trim();
  let endStr = endRaw ? String(endRaw).trim() : "";

  // 1つのセルの中に「~」または「〜」が含まれている場合、前半と後半に分割
  if (!endStr && /[〜~～]/.test(startStr)) {
    const parts = startStr.split(/[〜~～]/);
    startStr = parts[0].trim();
    endStr = parts[1]?.trim() ?? "";
  }

  // 開始日時をパース
  const start = parseSheetDate(startStr, { yearHint: opts.yearHint ?? "future" });
  if (!start) return startRaw;

  const fp = (d: Date, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...o }).formatToParts(d);
  const g = (p: Intl.DateTimeFormatPart[], t: string) => p.find((x) => x.type === t)?.value ?? "";

  // 開始日の日付パーツ取得（例：2026年8月10日 (月)） ※カッコを半角 () に変更
  const dp = fp(start, { year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
  const datePart = `${g(dp, "year")}年${g(dp, "month")}月${g(dp, "day")}日 (${g(dp, "weekday")})`;

  // 時間がない場合は日付のみ返す
  if (!/\d{1,2}:\d{2}/.test(startStr)) return datePart;

  const tp = fp(start, { hour: "2-digit", minute: "2-digit", hour12: false });
  let out = `${datePart} ${g(tp, "hour")}:${g(tp, "minute")}`;

  // 終了日時を判定
  let end: Date | null = null;
  if (endStr) {
    const hm = endStr.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      end = jstInstant(+g(dp, "year"), +g(dp, "month"), +g(dp, "day"), +hm[1], +hm[2]);
    } else {
      end = parseSheetDate(endStr, { yearHint: opts.yearHint ?? "future" });
    }
  }

  if (end && !isNaN(end.getTime())) {
    const key = (d: Date) => fp(d, { year: "numeric", month: "2-digit", day: "2-digit" }).map((p) => p.value).join("");
    const ep = fp(end, { hour: "2-digit", minute: "2-digit", hour12: false });

    // 同一日の場合：2026年8月10日 (月) 15:00～20:00
    if (key(start) === key(end)) {
      out += `～${g(ep, "hour")}:${g(ep, "minute")}`;
    } else {
      // 日をまたぐ場合：2026年8月10日 (月) 9:00～2026年8月11日 (火) 20:00 ※カッコを半角 () に変更
      const edp = fp(end, { year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
      const endDatePart = `${g(edp, "year")}年${g(edp, "month")}月${g(edp, "day")}日 (${g(edp, "weekday")})`;
      out += `～${endDatePart} ${g(ep, "hour")}:${g(ep, "minute")}`;
    }
  } else {
    out += "～"; // 終了時間が取得できなかった場合
  }

  return out;
}

/** "YYYY-MM" */
export function jstYearMonth(date: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}`;
}

/**
 * ISO形式等の日付文字列を「本日 HH:mm」または「M/D HH:mm」にフォーマットします
 */
export function formatRelativeDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = parseSheetDate(dateStr);
  if (!date || isNaN(date.getTime())) return dateStr;

  const today = todayInJST();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);

  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const y = parseInt(g("year"), 10);
  const m = parseInt(g("month"), 10);
  const d = parseInt(g("day"), 10);
  
  let hour = g("hour");
  if (hour === "24") hour = "00";
  const minute = g("minute");

  if (y === today.y && m === today.m && d === today.d) {
    return `本日 ${hour}:${minute}`;
  }

  if (y === today.y) {
    return `${m}/${d} ${hour}:${minute}`;
  } else {
    return `${y}/${m}/${d} ${hour}:${minute}`;
  }
}