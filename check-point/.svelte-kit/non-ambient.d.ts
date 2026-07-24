
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/export" | "/api/export/cases" | "/api/export/failures" | "/api/import" | "/api/import/cases" | "/cases" | "/runners" | "/runs" | "/runs/launch" | "/runs/[runId]" | "/search" | "/suites";
		RouteParams(): {
			"/runs/[runId]": { runId: string }
		};
		LayoutParams(): {
			"/": { runId?: string | undefined };
			"/api": Record<string, never>;
			"/api/export": Record<string, never>;
			"/api/export/cases": Record<string, never>;
			"/api/export/failures": Record<string, never>;
			"/api/import": Record<string, never>;
			"/api/import/cases": Record<string, never>;
			"/cases": Record<string, never>;
			"/runners": Record<string, never>;
			"/runs": { runId?: string | undefined };
			"/runs/launch": Record<string, never>;
			"/runs/[runId]": { runId: string };
			"/search": Record<string, never>;
			"/suites": Record<string, never>
		};
		Pathname(): "/" | "/api/export/cases" | "/api/export/failures" | "/api/import/cases" | "/cases" | "/runners" | "/runs" | "/runs/launch" | `/runs/${string}` & {} | "/search" | "/suites";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}