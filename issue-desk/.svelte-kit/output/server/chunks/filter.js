import { n as PRIORITIES, r as STATUSES, t as ISSUE_TYPES } from "./types.js";
//#region src/lib/filter.ts
/**
* Filters live in the URL query string (§11) so any view is shareable and the
* Export button can mirror the same params to /api/export.
*/
function parseFilter(params) {
	const filter = {};
	const q = params.get("q")?.trim();
	if (q) filter.q = q;
	for (const key of [
		"appId",
		"moduleId",
		"reporterId",
		"assigneeId",
		"tag"
	]) {
		const v = params.get(key);
		if (v) filter[key] = v;
	}
	const type = params.get("type");
	if (type && ISSUE_TYPES.includes(type)) filter.type = type;
	const status = params.getAll("status").filter((s) => STATUSES.includes(s));
	if (status.length) filter.status = status;
	const priority = params.getAll("priority").filter((p) => PRIORITIES.includes(p));
	if (priority.length) filter.priority = priority;
	const updatedFrom = params.get("updatedFrom");
	if (updatedFrom) filter.updatedFrom = updatedFrom;
	const updatedTo = params.get("updatedTo");
	if (updatedTo) filter.updatedTo = updatedTo;
	const sort = params.get("sort");
	if (sort && [
		"id",
		"title",
		"priority",
		"status",
		"updated",
		"created"
	].includes(sort)) filter.sort = sort;
	const dir = params.get("dir");
	if (dir === "asc" || dir === "desc") filter.dir = dir;
	const page = Number(params.get("page"));
	if (Number.isInteger(page) && page > 0) filter.page = page;
	const pageSize = Number(params.get("pageSize"));
	if (Number.isInteger(pageSize) && pageSize > 0) filter.pageSize = pageSize;
	return filter;
}
function filterToParams(filter) {
	const params = new URLSearchParams();
	if (filter.q) params.set("q", filter.q);
	for (const key of [
		"appId",
		"moduleId",
		"reporterId",
		"assigneeId",
		"tag"
	]) {
		const v = filter[key];
		if (v) params.set(key, v);
	}
	if (filter.type) params.set("type", filter.type);
	for (const s of filter.status ?? []) params.append("status", s);
	for (const p of filter.priority ?? []) params.append("priority", p);
	if (filter.updatedFrom) params.set("updatedFrom", filter.updatedFrom);
	if (filter.updatedTo) params.set("updatedTo", filter.updatedTo);
	if (filter.sort) params.set("sort", filter.sort);
	if (filter.dir) params.set("dir", filter.dir);
	if (filter.page) params.set("page", String(filter.page));
	if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
	return params;
}
//#endregion
export { parseFilter as n, filterToParams as t };
