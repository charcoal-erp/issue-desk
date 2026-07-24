//#region src/lib/format.ts
/** "16 Jul" — table / drawer date format. */
function fmtDate(iso) {
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short"
	});
}
/**
* Human "when" for table cells and meta rows:
* "just now" · "12m ago" · "5h ago" · "yesterday" · "3d ago" · "16 Jul" · "16 Jul 2025".
* Pair it with {@link fmtDateTime} as a `title` so the exact instant stays available.
*/
function fmtWhen(iso, now = /* @__PURE__ */ new Date()) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	const ms = now.getTime() - d.getTime();
	if (ms < 0) return fmtDate(iso);
	if (ms < 6e4) return "just now";
	const mins = Math.floor(ms / 6e4);
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 864e5);
	if (days === 1) return "yesterday";
	if (days < 7) return `${days}d ago`;
	return d.getFullYear() === now.getFullYear() ? d.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short"
	}) : d.toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric"
	});
}
/** "20 Jul 2026, 17:54" — the exact instant, for tooltips. */
function fmtDateTime(iso) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	});
}
/** "today" / "yesterday" / "3d ago" — activity feed. */
function relDate(iso, now = /* @__PURE__ */ new Date()) {
	const d = new Date(iso);
	const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 864e5);
	if (days <= 0) return "today";
	if (days === 1) return "yesterday";
	return `${days}d ago`;
}
function startOfDay(d) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** "KK" from "Kiran Kharade". */
function initials(name) {
	return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
/** "184 KB" / "1.2 MB" for attachment rows. */
function fmtSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//#endregion
export { initials as a, fmtWhen as i, fmtDateTime as n, relDate as o, fmtSize as r, fmtDate as t };
