import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Application, Category, User } from '$lib/types';
import { configDir, issuesDir } from '../fs/paths';
import { writeJsonAtomic } from '../fs/write';

/**
 * First-run bootstrap (§21): seeds ONLY reference data — users, applications
 * and settings. No issues are seeded; use the Python simulators under
 * `simulators/` to populate test issues on demand.
 */

// Reporters can be anyone; only `assignable` users appear in the assignee list.
// The first account is the admin — first boot gives it a password (see
// `bootstrapAdmin`), and everyone else gets one from Config → Accounts.
export const SEED_USERS: User[] = [
	{ id: 'kiran', name: 'Kiran Kharade', role: 'Architect', avatarColor: '#5B4BFF', assignable: true, kind: 'human', admin: true },
	{ id: 'anant', name: 'Anant Kharade', role: 'QA', avatarColor: '#2FA36B', assignable: false, kind: 'human' },
	{ id: 'aadinath', name: 'Aadinath Kharade', role: 'Tester', avatarColor: '#F5A623', assignable: false, kind: 'human' },
	{ id: 'tushar', name: 'Tushar Kulange', role: 'Developer', avatarColor: '#0891B2', assignable: true, kind: 'human' },
	// The account a Claude Code session signs in as. Assignable, so claimed work
	// shows up against it; no password until an admin sets one.
	{ id: 'claude-agent', name: 'Claude Agent', role: 'AI Agent', avatarColor: '#C15F3C', assignable: true, kind: 'agent' }
];

/**
 * Starter category vocabulary — what an issue is *about*, as opposed to the
 * app/module taxonomy that says where it lives. Edit freely under Config;
 * these are only what a fresh data dir starts with.
 */
export const SEED_CATEGORIES: Category[] = [
	{ id: 'functionality', name: 'Functionality', description: 'Feature does not behave as specified', color: '#5B4BFF' },
	{ id: 'ui-ux', name: 'UI / UX', description: 'Layout, styling, copy and interaction problems', color: '#DB2777' },
	{ id: 'data-integrity', name: 'Data integrity', description: 'Wrong, missing or corrupted data', color: '#B91C1C' },
	{ id: 'performance', name: 'Performance', description: 'Slow responses, timeouts, resource use', color: '#D97706' },
	{ id: 'security', name: 'Security', description: 'Access control, validation, exposure of secrets', color: '#7C3AED' },
	{ id: 'integration', name: 'Integration', description: 'Third-party services and cross-app links', color: '#0891B2' },
	{ id: 'reporting', name: 'Reporting', description: 'Dashboards, exports and printed output', color: '#2FA36B' },
	{ id: 'documentation', name: 'Documentation', description: 'Help text, guides and API docs', color: '#64748B' }
];

// pages: [] everywhere — page/form are captured as free text on each issue.
const CHARCOAL_MODULES = [
	['org-hub', 'ORGH', 'Organization Hub'],
	['company-hub', 'COH', 'Company Hub'],
	['my-desk', 'DESK', 'My Desk'],
	['platform-console', 'PLAT', 'Platform Console'],
	['accounting', 'ACCT', 'Accounting'],
	['procurement', 'PROC', 'Procurement'],
	['inventory', 'INV', 'Inventory'],
	['sales', 'SALE', 'Sales'],
	['crm', 'CRM', 'CRM'],
	['marketing', 'MKT', 'Marketing'],
	['assets', 'ASST', 'Assets'],
	['expense', 'EXP', 'Expense'],
	['hr', 'HR', 'HR'],
	['payroll', 'PAY', 'Payroll']
] as const;

const DRISHTI_MODULES = [
	['admin-system', 'ADMS', 'Admin Portal – System Admin login'],
	['admin-ward', 'ADMW', 'Admin Portal – Ward Admin login'],
	['agency-portal', 'AGY', 'Agency Portal'],
	['public-portal', 'PUB', 'Public Portal'],
	['field-officer-web', 'FOW', 'Field Officer Web App'],
	['field-officer-mobile', 'FOM', 'Field Officer Mobile App']
] as const;

function modules(defs: ReadonlyArray<readonly [string, string, string]>) {
	return defs.map(([id, code, name]) => ({ id, code, name, pages: [] }));
}

export const SEED_APPS: Application[] = [
	{
		id: 'charcoal',
		code: 'CHR',
		name: 'Charcoal',
		color: '#5B4BFF',
		modules: modules(CHARCOAL_MODULES)
	},
	{
		id: 'chattr',
		code: 'CHT',
		name: 'Chattr',
		color: '#DB2777',
		modules: modules([['general', 'GEN', 'General']])
	},
	{
		id: 'coffee-ops',
		code: 'COF',
		name: 'Coffee-ops',
		color: '#D97706',
		modules: modules([['general', 'GEN', 'General']])
	},
	{
		id: 'relay',
		code: 'RLY',
		name: 'Relay',
		color: '#EA580C',
		modules: modules([['consent', 'CNS', 'Consent']])
	},
	{
		id: 'drishti',
		code: 'DRS',
		name: 'Drishti',
		color: '#0891B2',
		modules: modules(DRISHTI_MODULES)
	}
];

/** Write reference data + empty per-app sequence counters into DATA_DIR. */
export async function seedDataDir(): Promise<void> {
	await mkdir(configDir(), { recursive: true });
	await writeJsonAtomic(path.join(configDir(), 'users.json'), SEED_USERS);
	await writeJsonAtomic(path.join(configDir(), 'applications.json'), SEED_APPS);
	await writeJsonAtomic(path.join(configDir(), 'categories.json'), SEED_CATEGORIES);
	await writeJsonAtomic(path.join(configDir(), 'settings.json'), {
		productName: 'IssueDesk',
		defaultPageSize: 50
	});

	// Per-app sequence counters start at 1; no issue files are written.
	for (const app of SEED_APPS) {
		await writeJsonAtomic(path.join(issuesDir(app.id), '_sequence.json'), {
			code: app.code,
			next: 1
		});
	}
}
