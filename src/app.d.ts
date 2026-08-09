// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionUser } from '$lib/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Set by the auth hook; null only on the public routes. */
			user: SessionUser | null;
			/** True when the request authenticated with ISSUEDESK_INGEST_TOKEN. */
			ingest: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
