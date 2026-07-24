import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Application, User } from '$lib/types';
import { configDir } from '../fs/paths';
import { writeJsonAtomic } from '../fs/write';

/**
 * Checkpoint's reference data: the testers on this box and the applications
 * under test. Duplicated in shape from IssueDesk on purpose — the two apps
 * share no code, and matching app ids/codes is what lets a bug filed from a
 * failure land in the right IssueDesk project over HTTP.
 *
 * Edit `config/applications.json` / `config/users.json` in this Checkpoint's
 * DATA_DIR to fit the environment it runs in; the seed only writes them when
 * they are absent.
 */

export const SEED_USERS: User[] = [
	{ id: 'kiran', name: 'Kiran Kharade', role: 'Architect', avatarColor: '#5B4BFF', assignable: true },
	{ id: 'anant', name: 'Anant Kharade', role: 'QA', avatarColor: '#2FA36B', assignable: false },
	{ id: 'aadinath', name: 'Aadinath Kharade', role: 'Tester', avatarColor: '#F5A623', assignable: false },
	{ id: 'tushar', name: 'Tushar Kulange', role: 'Developer', avatarColor: '#0891B2', assignable: true }
];

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
	{ id: 'charcoal', code: 'CHR', name: 'Charcoal', color: '#5B4BFF', modules: modules(CHARCOAL_MODULES) },
	{ id: 'chattr', code: 'CHT', name: 'Chattr', color: '#DB2777', modules: modules([['general', 'GEN', 'General']]) },
	{ id: 'coffee-ops', code: 'COF', name: 'Coffee-ops', color: '#D97706', modules: modules([['general', 'GEN', 'General']]) },
	{ id: 'relay', code: 'RLY', name: 'Relay', color: '#EA580C', modules: modules([['consent', 'CNS', 'Consent']]) },
	{ id: 'drishti', code: 'DRS', name: 'Drishti', color: '#0891B2', modules: modules(DRISHTI_MODULES) }
];

async function fileExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

/** Write reference data only if it is missing — never clobber a curated config. */
export async function seedConfigIfEmpty(): Promise<void> {
	await mkdir(configDir(), { recursive: true });
	const usersFile = path.join(configDir(), 'users.json');
	const appsFile = path.join(configDir(), 'applications.json');
	if (!(await fileExists(usersFile))) await writeJsonAtomic(usersFile, SEED_USERS);
	if (!(await fileExists(appsFile))) await writeJsonAtomic(appsFile, SEED_APPS);
}

/** Unconditionally (re)seed reference data — used by tests. */
export async function seedDataDir(): Promise<void> {
	await mkdir(configDir(), { recursive: true });
	await writeJsonAtomic(path.join(configDir(), 'users.json'), SEED_USERS);
	await writeJsonAtomic(path.join(configDir(), 'applications.json'), SEED_APPS);
}
