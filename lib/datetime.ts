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

// YYYY/MM/DD HH:MM ~ HH:MM
export function formatEventSchedule(
  startRaw: string,
  endRaw?: string,
  opts: { yearHint?: "current" | "future" | "past" } = {}
): string {
  const start = parseSheetDate(startRaw, { yearHint: opts.yearHint ?? "future" });
  if (!start) return startRaw || "";
  const fp = (d: Date, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...o }).formatToParts(d);
  const g = (p: Intl.DateTimeFormatPart[], t: string) => p.find((x) => x.type === t)?.value ?? "";

  const dp = fp(start, { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const datePart = `${g(dp, "year")}/${g(dp, "month")}/${g(dp, "day")} (${g(dp, "weekday")})`;
  if (!/\d{1,2}:\d{2}/.test(String(startRaw))) return datePart; // no time -> display only date

  const tp = fp(start, { hour: "2-digit", minute: "2-digit", hour12: false });
  let out = `${datePart} ${g(tp, "hour")}:${g(tp, "minute")}`;

  // create end time from "Start date JST"
  const mkSameDay = (hh: number, mm: number) =>
    jstInstant(+g(dp, "year"), +g(dp, "month"), +g(dp, "day"), hh, mm);

  let end: Date | null = null;
  const hm = String(endRaw ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (hm) end = mkSameDay(+hm[1], +hm[2]);
  else if (endRaw) end = parseSheetDate(endRaw);
  else {
    const emb = String(startRaw).match(/\d{1,2}:\d{2}\s*[〜~～]\s*(\d{1,2}):(\d{2})/);
    if (emb) end = mkSameDay(+emb[1], +emb[2]);
  }

  if (end && !isNaN(end.getTime())) {
    const key = (d: Date) => fp(d, { year: "numeric", month: "2-digit", day: "2-digit" }).map((p) => p.value).join("");
    const ep = fp(end, { hour: "2-digit", minute: "2-digit", hour12: false });
    if (key(start) === key(end)) out += `〜${g(ep, "hour")}:${g(ep, "minute")}`;
    else {
      const edp = fp(end, { month: "2-digit", day: "2-digit" });
      out += `〜${g(edp, "month")}/${g(edp, "day")} ${g(ep, "hour")}:${g(ep, "minute")}`; // if next day
    }
  } else {
    out += "〜"; // if start time only
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
 * 管理者イベント一覧用の日時表示。
 *
 * 同日：
 * 2026年8月15日(土) 16:00〜21:00
 *
 * 日またぎ：
 * 2026年8月15日(土) 22:00〜8月16日(日) 02:00
 */
export function formatEventPeriod(
  startRaw: string,
  endRaw: string,
): string {
  if (!startRaw) {
    return "";
  }

  const startDate =
    parseSheetDate(startRaw);

  if (!startDate) {
    return endRaw
      ? `${startRaw}〜${endRaw}`
      : startRaw;
  }

  const fullDateTimeFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

  if (!endRaw) {
    return fullDateTimeFormatter.format(
      startDate,
    );
  }

  const endDate =
    parseSheetDate(endRaw);

  if (!endDate) {
    return `${startRaw}〜${endRaw}`;
  }

  const fullDateFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      },
    );

  const shortDateFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        month: "long",
        day: "numeric",
        weekday: "short",
      },
    );

  const timeFormatter =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

  const dateKeyFormatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    );

  const startDateText =
    fullDateFormatter.format(
      startDate,
    );

  const startTimeText =
    timeFormatter.format(
      startDate,
    );

  const endTimeText =
    timeFormatter.format(
      endDate,
    );

  const isSameDay =
    dateKeyFormatter.format(
      startDate,
    ) ===
    dateKeyFormatter.format(
      endDate,
    );

  if (isSameDay) {
    return `${startDateText} ${startTimeText}〜${endTimeText}`;
  }

  const endDateText =
    shortDateFormatter.format(
      endDate,
    );

  return `${startDateText} ${startTimeText}〜${endDateText} ${endTimeText}`;
}

export function formatDateJP(iso: string | null | undefined): string {
    if(!iso) return "ー";
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return iso;

    return d.toLocaleDateString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}