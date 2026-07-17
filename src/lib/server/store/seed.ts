import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import type { Application, Attachment, Issue, IssueType, Priority, Status, User } from '$lib/types';
import { configDir, issuesDir, uploadsDir } from '../fs/paths';
import { writeJsonAtomic } from '../fs/write';

/**
 * First-run bootstrap (§21): seeds the demo dataset from the approved mockup
 * so the app is populated and matches the reference screens out of the box.
 */

export const SEED_USERS: User[] = [
	{ id: 'kiran', name: 'Kiran Kharade', role: 'Architect', avatarColor: '#5B4BFF' },
	{ id: 'priya', name: 'Priya Nair', role: 'QA Lead', avatarColor: '#2FA36B' },
	{ id: 'arjun', name: 'Arjun Mehta', role: 'Dev-tester', avatarColor: '#F5A623' },
	{ id: 'sara', name: 'Sara Khan', role: 'Stakeholder', avatarColor: '#E5484D' },
	{ id: 'dev', name: 'Dev Patel', role: 'Developer', avatarColor: '#0891B2' }
];

export const SEED_APPS: Application[] = [
	{
		id: 'charcoal-erp',
		code: 'CHR',
		name: 'Charcoal ERP',
		color: '#5B4BFF',
		modules: [
			{
				id: 'auth',
				code: 'AUTH',
				name: 'Auth',
				pages: [
					{
						id: 'login',
						name: 'Login',
						path: '/login',
						forms: [
							{ id: 'otp', name: 'OTP Verification' },
							{ id: 'pw', name: 'Password Sign-in' }
						]
					},
					{
						id: 'register',
						name: 'Register',
						path: '/register',
						forms: [{ id: 'signup', name: 'Signup Form' }]
					}
				]
			},
			{
				id: 'billing',
				code: 'BILL',
				name: 'Billing',
				pages: [
					{
						id: 'invoice',
						name: 'Invoice',
						path: '/billing/invoice',
						forms: [{ id: 'inv', name: 'Invoice Editor' }]
					},
					{
						id: 'pay',
						name: 'Payments',
						path: '/billing/pay',
						forms: [{ id: 'payf', name: 'Payment Form' }]
					}
				]
			},
			{
				id: 'inventory',
				code: 'INV',
				name: 'Inventory',
				pages: [
					{
						id: 'stock',
						name: 'Stock',
						path: '/inventory',
						forms: [{ id: 'adj', name: 'Stock Adjust' }]
					}
				]
			},
			{
				id: 'reports',
				code: 'RPT',
				name: 'Reports',
				pages: [
					{
						id: 'rpt',
						name: 'Reports',
						path: '/reports',
						forms: [{ id: 'exp', name: 'Export Filters' }]
					}
				]
			}
		]
	},
	{
		id: 'amrutm',
		code: 'AMR',
		name: 'Amrutm',
		color: '#2FA36B',
		modules: [
			{
				id: 'opd',
				code: 'OPD',
				name: 'OPD',
				pages: [
					{
						id: 'reg',
						name: 'Register',
						path: '/opd/register',
						forms: [{ id: 'intake', name: 'Patient Intake' }]
					}
				]
			},
			{
				id: 'pharmacy',
				code: 'PHR',
				name: 'Pharmacy',
				pages: [
					{
						id: 'disp',
						name: 'Dispense',
						path: '/pharmacy/dispense',
						forms: [{ id: 'df', name: 'Dispense Form' }]
					}
				]
			},
			{
				id: 'appt',
				code: 'APT',
				name: 'Appointments',
				pages: [
					{
						id: 'appt',
						name: 'Appointments',
						path: '/appointments',
						forms: [{ id: 'bk', name: 'Booking' }]
					}
				]
			}
		]
	},
	{
		id: 'drishti',
		code: 'DRS',
		name: 'Drishti',
		color: '#0891B2',
		modules: [
			{
				id: 'insp',
				code: 'INSP',
				name: 'Inspections',
				pages: [
					{
						id: 'newi',
						name: 'New Inspection',
						path: '/inspections/new',
						forms: [{ id: 'site', name: 'Site Inspection' }]
					}
				]
			},
			{
				id: 'permits',
				code: 'PRM',
				name: 'Permits',
				pages: [
					{
						id: 'perm',
						name: 'Permits',
						path: '/permits',
						forms: [{ id: 'pa', name: 'Permit Application' }]
					}
				]
			}
		]
	},
	{
		id: 'eventhive',
		code: 'EVT',
		name: 'EventHive',
		color: '#DB2777',
		modules: [
			{
				id: 'ticket',
				code: 'TKT',
				name: 'Ticketing',
				pages: [
					{
						id: 'co',
						name: 'Checkout',
						path: '/tickets/checkout',
						forms: [{ id: 'pay', name: 'Payment' }]
					}
				]
			},
			{
				id: 'attendees',
				code: 'ATT',
				name: 'Attendees',
				pages: [
					{
						id: 'imp',
						name: 'Import',
						path: '/attendees',
						forms: [{ id: 'csv', name: 'Import' }]
					}
				]
			}
		]
	},
	{
		id: 'hubble',
		code: 'HUB',
		name: 'Hubble',
		color: '#7C3AED',
		modules: [
			{
				id: 'msg',
				code: 'MSG',
				name: 'Messages',
				pages: [
					{
						id: 'ch',
						name: 'Channels',
						path: '/channels',
						forms: [{ id: 'comp', name: 'Composer' }]
					}
				]
			}
		]
	},
	{
		id: 'relay',
		code: 'RLY',
		name: 'Relay',
		color: '#EA580C',
		modules: [
			{
				id: 'consent',
				code: 'CNS',
				name: 'Consent',
				pages: [
					{
						id: 'ci',
						name: 'Consent',
						path: '/consent',
						forms: [{ id: 'oi', name: 'Opt-in' }]
					}
				]
			}
		]
	},
	{
		id: 'quick-help',
		code: 'QHP',
		name: 'Quick Help',
		color: '#D97706',
		modules: [
			{
				id: 'book',
				code: 'BK',
				name: 'Bookings',
				pages: [
					{ id: 'bp', name: 'Book', path: '/book', forms: [{ id: 'sp', name: 'Slot Picker' }] }
				]
			}
		]
	},
	{
		id: 'notebox',
		code: 'NBX',
		name: 'NoteBox',
		color: '#475569',
		modules: [
			{
				id: 'sync',
				code: 'SYNC',
				name: 'Sync',
				pages: [
					{ id: 'set', name: 'Settings', path: '/settings', forms: [{ id: 'sy', name: 'Sync' }] }
				]
			}
		]
	}
];

// Tiny valid placeholder files so seeded attachment URLs actually resolve.
const PLACEHOLDER_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPlfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64'
);
const PLACEHOLDER_PDF = Buffer.from(
	`%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]>>endobj
trailer<</Root 1 0 R>>
%%EOF
`,
	'utf8'
);

interface SeedIssueSpec {
	id: string;
	seq: number;
	type: IssueType;
	title: string;
	appId: string;
	moduleId: string;
	pageId: string | null;
	formId: string | null;
	priority: Priority;
	status: Status;
	reporterId: string;
	assigneeId: string | null;
	tags: string[];
	files: Array<{ name: string; kind: 'image' | 'pdf' }>;
	date: string; // YYYY-MM-DD
	description: string;
}

const SEED_ISSUES: SeedIssueSpec[] = [
	{
		id: 'CHR-14', seq: 14, type: 'bug', title: 'Login fails with a valid OTP',
		appId: 'charcoal-erp', moduleId: 'auth', pageId: 'login', formId: 'otp',
		priority: 'critical', status: 'open', reporterId: 'priya', assigneeId: 'kiran',
		tags: ['auth', 'regression'],
		files: [{ name: '01-login-screen.png', kind: 'image' }, { name: '02-network-trace.pdf', kind: 'pdf' }],
		date: '2026-07-16',
		description: 'Entering the correct 6-digit OTP returns "Invalid code". Reproduces on Chrome and Edge. The call to `POST /auth/verify-otp` returns **200** but the client treats it as a failure and clears the field.'
	},
	{
		id: 'CHR-11', seq: 11, type: 'bug', title: 'Invoice total ignores line-item discounts',
		appId: 'charcoal-erp', moduleId: 'billing', pageId: 'invoice', formId: 'inv',
		priority: 'high', status: 'open', reporterId: 'arjun', assigneeId: 'dev',
		tags: ['billing'],
		files: [{ name: '01-invoice.png', kind: 'image' }],
		date: '2026-07-15',
		description: 'When a per-line discount is applied, the grand total still uses the pre-discount subtotal. Tax is then computed on the wrong base.'
	},
	{
		id: 'CHR-09', seq: 9, type: 'feature', title: 'Add CSV export to the sales report',
		appId: 'charcoal-erp', moduleId: 'reports', pageId: 'rpt', formId: 'exp',
		priority: 'medium', status: 'implemented', reporterId: 'sara', assigneeId: 'kiran',
		tags: ['reports', 'export'],
		files: [],
		date: '2026-07-12',
		description: 'Stakeholders want to pull the filtered sales report into a spreadsheet. Add a CSV export next to the existing PDF button.'
	},
	{
		id: 'CHR-05', seq: 5, type: 'bug', title: 'Negative stock allowed on rapid adjust',
		appId: 'charcoal-erp', moduleId: 'inventory', pageId: 'stock', formId: 'adj',
		priority: 'very_high', status: 'complete', reporterId: 'arjun', assigneeId: 'dev',
		tags: ['inventory'],
		files: [{ name: '01-stock.png', kind: 'image' }],
		date: '2026-07-08',
		description: 'Hitting "Adjust" quickly twice lets stock go below zero. Needs a server-side guard, not just client validation.'
	},
	{
		id: 'AMR-07', seq: 7, type: 'bug', title: 'Duplicate patient created on double submit',
		appId: 'amrutm', moduleId: 'opd', pageId: 'reg', formId: 'intake',
		priority: 'critical', status: 'open', reporterId: 'priya', assigneeId: 'dev',
		tags: ['opd', 'data-integrity'],
		files: [{ name: '01-opd-form.png', kind: 'image' }],
		date: '2026-07-16',
		description: 'Submitting the intake form twice (slow network) creates two patient records with the same MRN.'
	},
	{
		id: 'AMR-04', seq: 4, type: 'bug', title: 'Dosage field accepts non-numeric input',
		appId: 'amrutm', moduleId: 'pharmacy', pageId: 'disp', formId: 'df',
		priority: 'high', status: 'implemented', reporterId: 'arjun', assigneeId: 'kiran',
		tags: ['pharmacy'],
		files: [],
		date: '2026-07-14',
		description: 'The dispense dosage field lets you type letters, which then breaks the label print.'
	},
	{
		id: 'AMR-02', seq: 2, type: 'feature', title: 'SMS reminder 24h before appointment',
		appId: 'amrutm', moduleId: 'appt', pageId: 'appt', formId: 'bk',
		priority: 'low', status: 'open', reporterId: 'sara', assigneeId: null,
		tags: ['notify'],
		files: [],
		date: '2026-07-10',
		description: 'Patients miss slots. Send an SMS reminder a day before the appointment.'
	},
	{
		id: 'DRS-06', seq: 6, type: 'bug', title: 'GPS pin drifts on mobile capture',
		appId: 'drishti', moduleId: 'insp', pageId: 'newi', formId: 'site',
		priority: 'high', status: 'open', reporterId: 'priya', assigneeId: 'dev',
		tags: ['gis', 'mobile'],
		files: [{ name: '01-map.png', kind: 'image' }, { name: '02-drift.png', kind: 'image' }],
		date: '2026-07-15',
		description: 'On Android, the captured inspection location drifts ~40m from the actual pin after saving.'
	},
	{
		id: 'DRS-03', seq: 3, type: 'bug', title: 'PDF permit missing QR on reprint',
		appId: 'drishti', moduleId: 'permits', pageId: 'perm', formId: 'pa',
		priority: 'medium', status: 'complete', reporterId: 'arjun', assigneeId: 'kiran',
		tags: ['pdf'],
		files: [{ name: '01-permit.pdf', kind: 'pdf' }],
		date: '2026-07-09',
		description: 'First print of the permit has the QR code; a reprint of the same permit drops it.'
	},
	{
		id: 'EVT-08', seq: 8, type: 'bug', title: 'Double charge on retry after timeout',
		appId: 'eventhive', moduleId: 'ticket', pageId: 'co', formId: 'pay',
		priority: 'very_high', status: 'open', reporterId: 'sara', assigneeId: 'dev',
		tags: ['payments', 'critical-path'],
		files: [{ name: '01-checkout.png', kind: 'image' }],
		date: '2026-07-16',
		description: 'If the gateway times out and the user retries, the card is charged twice. High-severity, revenue path.'
	},
	{
		id: 'EVT-05', seq: 5, type: 'feature', title: 'Bulk attendee import via CSV',
		appId: 'eventhive', moduleId: 'attendees', pageId: 'imp', formId: 'csv',
		priority: 'medium', status: 'implemented', reporterId: 'kiran', assigneeId: 'arjun',
		tags: ['import'],
		files: [],
		date: '2026-07-13',
		description: 'Organisers want to upload a CSV of attendees instead of adding them one by one.'
	},
	{
		id: 'HUB-04', seq: 4, type: 'bug', title: 'Emoji picker closes on first select',
		appId: 'hubble', moduleId: 'msg', pageId: 'ch', formId: 'comp',
		priority: 'high', status: 'open', reporterId: 'priya', assigneeId: 'dev',
		tags: ['ui'],
		files: [{ name: '01-emoji.png', kind: 'image' }],
		date: '2026-07-14',
		description: 'Selecting an emoji closes the picker, so you cannot add several in a row. It should stay open.'
	},
	{
		id: 'RLY-03', seq: 3, type: 'bug', title: 'Consent state not persisted across sessions',
		appId: 'relay', moduleId: 'consent', pageId: 'ci', formId: 'oi',
		priority: 'very_high', status: 'open', reporterId: 'arjun', assigneeId: 'kiran',
		tags: ['consent', 'compliance'],
		files: [{ name: '01-audit.pdf', kind: 'pdf' }],
		date: '2026-07-15',
		description: 'A user who opts out has their choice reset on next login — a compliance risk.'
	},
	{
		id: 'QHP-02', seq: 2, type: 'feature', title: 'Show provider ETA on booking',
		appId: 'quick-help', moduleId: 'book', pageId: 'bp', formId: 'sp',
		priority: 'high', status: 'open', reporterId: 'sara', assigneeId: null,
		tags: ['ux'],
		files: [],
		date: '2026-07-11',
		description: 'Customers want to see how soon a provider can arrive before confirming a booking.'
	},
	{
		id: 'NBX-03', seq: 3, type: 'bug', title: 'Sync spinner stuck after offline edit',
		appId: 'notebox', moduleId: 'sync', pageId: 'set', formId: 'sy',
		priority: 'low', status: 'complete', reporterId: 'dev', assigneeId: 'dev',
		tags: ['sync'],
		files: [],
		date: '2026-07-07',
		description: 'After editing a note offline and reconnecting, the sync spinner never stops even though data synced.'
	}
];

function buildIssue(spec: SeedIssueSpec): Issue {
	const app = SEED_APPS.find((a) => a.id === spec.appId)!;
	const mod = app.modules.find((m) => m.id === spec.moduleId)!;
	const page = spec.pageId ? mod.pages.find((p) => p.id === spec.pageId) : undefined;
	const form = spec.formId && page ? page.forms.find((f) => f.id === spec.formId) : undefined;
	const at = `${spec.date}T10:00:00+05:30`;
	const attachments: Attachment[] = spec.files.map((f) => ({
		id: uuidv7(),
		filename: f.name,
		originalName: f.name,
		mime: f.kind === 'image' ? 'image/png' : 'application/pdf',
		kind: f.kind,
		size: f.kind === 'image' ? PLACEHOLDER_PNG.length : PLACEHOLDER_PDF.length,
		url: `/api/files/${spec.appId}/${spec.id}/${f.name}`,
		uploadedBy: spec.reporterId,
		uploadedAt: at
	}));
	return {
		id: spec.id,
		uuid: uuidv7(),
		seq: spec.seq,
		type: spec.type,
		title: spec.title,
		description: spec.description,
		appId: app.id,
		appCode: app.code,
		appName: app.name,
		moduleId: mod.id,
		moduleCode: mod.code,
		moduleName: mod.name,
		pageId: page?.id,
		pageName: page?.name,
		pagePath: page?.path,
		formId: form?.id,
		formName: form?.name,
		priority: spec.priority,
		status: spec.status,
		reporterId: spec.reporterId,
		assigneeId: spec.assigneeId ?? undefined,
		tags: spec.tags,
		attachments,
		activity: [{ id: uuidv7(), at, by: spec.reporterId, kind: 'created' }],
		createdAt: at,
		updatedAt: at
	};
}

/** Write the full demo dataset into DATA_DIR. */
export async function seedDataDir(): Promise<void> {
	await mkdir(configDir(), { recursive: true });
	await writeJsonAtomic(path.join(configDir(), 'users.json'), SEED_USERS);
	await writeJsonAtomic(path.join(configDir(), 'applications.json'), SEED_APPS);
	await writeJsonAtomic(path.join(configDir(), 'settings.json'), {
		productName: 'IssueDesk',
		defaultPageSize: 50
	});

	const issues = SEED_ISSUES.map(buildIssue);

	// Group by app/module and write module files, sorted by seq (§9).
	const byFile = new Map<string, Issue[]>();
	for (const issue of issues) {
		const key = `${issue.appId}/${issue.moduleId}`;
		(byFile.get(key) ?? byFile.set(key, []).get(key)!).push(issue);
	}
	for (const [key, group] of byFile) {
		const [appId, moduleId] = key.split('/');
		group.sort((a, b) => a.seq - b.seq);
		await writeJsonAtomic(path.join(issuesDir(appId), `${moduleId}.json`), group);
	}

	// Per-app sequence counters.
	for (const app of SEED_APPS) {
		const maxSeq = Math.max(0, ...issues.filter((i) => i.appId === app.id).map((i) => i.seq));
		await writeJsonAtomic(path.join(issuesDir(app.id), '_sequence.json'), {
			code: app.code,
			next: maxSeq + 1
		});
	}

	// Placeholder upload files so seeded attachment URLs resolve.
	for (const issue of issues) {
		for (const att of issue.attachments) {
			const dir = uploadsDir(issue.appId, issue.id);
			await mkdir(dir, { recursive: true });
			await writeFile(
				path.join(dir, att.filename),
				att.kind === 'image' ? PLACEHOLDER_PNG : PLACEHOLDER_PDF
			);
		}
	}
}
