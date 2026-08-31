// id from sheet to string (123.0 worked)
export function normalizeId(v: unknown): string {
    let s = String(v ?? "").trim();
    if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, "");
    return s;
}

// compare 2 ids, normalize both (not !== if "")
export function sameId(a: unknown, b: unknown): boolean {
    const na = normalizeId(a);
    return na !== "" && na === normalizeId(b);
}