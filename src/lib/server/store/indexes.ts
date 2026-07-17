import type { Issue } from '$lib/types';

/** Secondary indexes for fast filtering: Map<key, Set<issueId>> (§10). */
export class IssueIndexes {
	byApp = new Map<string, Set<string>>();
	byModule = new Map<string, Set<string>>(); // key: `${appId}/${moduleId}`
	byStatus = new Map<string, Set<string>>();
	byPriority = new Map<string, Set<string>>();
	byAssignee = new Map<string, Set<string>>();
	byReporter = new Map<string, Set<string>>();
	byTag = new Map<string, Set<string>>();

	add(issue: Issue): void {
		put(this.byApp, issue.appId, issue.id);
		put(this.byModule, `${issue.appId}/${issue.moduleId}`, issue.id);
		put(this.byStatus, issue.status, issue.id);
		put(this.byPriority, issue.priority, issue.id);
		if (issue.assigneeId) put(this.byAssignee, issue.assigneeId, issue.id);
		put(this.byReporter, issue.reporterId, issue.id);
		for (const tag of issue.tags) put(this.byTag, tag, issue.id);
	}

	remove(issue: Issue): void {
		drop(this.byApp, issue.appId, issue.id);
		drop(this.byModule, `${issue.appId}/${issue.moduleId}`, issue.id);
		drop(this.byStatus, issue.status, issue.id);
		drop(this.byPriority, issue.priority, issue.id);
		if (issue.assigneeId) drop(this.byAssignee, issue.assigneeId, issue.id);
		drop(this.byReporter, issue.reporterId, issue.id);
		for (const tag of issue.tags) drop(this.byTag, tag, issue.id);
	}

	update(before: Issue, after: Issue): void {
		this.remove(before);
		this.add(after);
	}
}

function put(map: Map<string, Set<string>>, key: string, id: string): void {
	let set = map.get(key);
	if (!set) map.set(key, (set = new Set()));
	set.add(id);
}

function drop(map: Map<string, Set<string>>, key: string, id: string): void {
	const set = map.get(key);
	if (!set) return;
	set.delete(id);
	if (set.size === 0) map.delete(key);
}

/** Intersect candidate sets, smallest first; undefined entries are "no constraint". */
export function intersect(sets: Array<Set<string> | undefined>): Set<string> | undefined {
	const active = sets.filter((s): s is Set<string> => s !== undefined);
	if (active.length === 0) return undefined;
	active.sort((a, b) => a.size - b.size);
	let result = new Set(active[0]);
	for (const s of active.slice(1)) {
		result = new Set([...result].filter((id) => s.has(id)));
		if (result.size === 0) break;
	}
	return result;
}

/** Union of several keys' sets within one index (e.g. status multi-select). */
export function unionOf(
	map: Map<string, Set<string>>,
	keys: string[] | undefined
): Set<string> | undefined {
	if (!keys || keys.length === 0) return undefined;
	const out = new Set<string>();
	for (const k of keys) for (const id of map.get(k) ?? []) out.add(id);
	return out;
}
