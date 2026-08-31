// Thread lifecycle status for the Messages sheet (column J), standard
// ticketing terms: open = 未対応, in_progress = 対応中, closed = 対応完了.
// Blank ('') means "no status / no badge". Renamed 2026-08 from
// unsupported/pending; the sheet may still hold the old strings and every
// read path maps them onto these values. Writes use these values only.
export type MessageStatus = "open" | "in_progress" | "closed";
