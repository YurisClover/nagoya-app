<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

- **IDs**: every entity id is a bare UUID via `crypto.randomUUID()`, except
  `member_id` (8-digit business number members actually use) and
  `answer_id` (composite upsert key `ans_<eventId>_<memberId>`). IDs are
  opaque: never sort, parse, or number-convert them. Creation time lives in
  `created_at` (JST ISO string - sorts correctly as a plain string).
- **Message status** (Messages column J): `open` | `in_progress` | `closed`;
  blank = no status/badge. Legacy sheet values `unsupported`/`pending` are
  mapped on read only - never write them. Member -> admin inquiries are
  auto-tagged `open`; a member reply auto-reopens the thread.
- **Sheets booleans**: RAW writes stringify booleans (shows as 'TRUE text).
  Write real boolean cells with USER_ENTERED + string 'TRUE'/'FALSE',
  per-cell or two-phase (append RAW, then batchUpdate the boolean columns).
  Never put dates in a USER_ENTERED row - they become serial numbers.
- **Dates**: always through lib/datetime (`nowJST`, `parseSheetDate`).
  Never `new Date(sheetString)` - it parses in the server timezone and
  shifts JST values on UTC hosts. Date-based decisions ("finished" etc.)
  are computed server-side only.
- **Auth**: every API route validates via `getApiUser()` / guards in
  lib/guards; cron uses CRON_SECRET with timingSafeEqual. Client-side
  checks are UX only - the server check is the real gate.
- **Sheets access**: googleapis via lib/sheets/googleapis
  (GOOGLE_SERVICE_ACCOUNT_KEY, base64) or google-spreadsheet via lib/sheets.
  Do not invent new env var names; check .env usage first.
- **Language**: new comments, commit messages, and log strings in English;
  existing Japanese may remain. User-facing UI strings are Japanese.
