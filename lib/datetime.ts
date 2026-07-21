export function nowJST(date = new Date()) : string {
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