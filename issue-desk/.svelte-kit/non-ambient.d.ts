
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
		RouteId(): "/" | "/admin" | "/api" | "/api/data" | "/api/data/export" | "/api/data/import" | "/api/export" | "/api/files" | "/api/files/[...path]" | "/api/issues" | "/api/issues/[id]" | "/api/uploads" | "/board" | "/issues" | "/issues/[id]" | "/metrics";
		RouteParams(): {
			"/api/files/[...path]": { path: string };
			"/api/issues/[id]": { id: string };
			"/issues/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { path?: string | undefined; id?: string | undefined };
			"/admin": Record<string, never>;
			"/api": { path?: string | undefined; id?: string | undefined };
			"/api/data": Record<string, never>;
			"/api/data/export": Record<string, never>;
			"/api/data/import": Record<string, never>;
			"/api/export": Record<string, never>;
			"/api/files": { path?: string | undefined };
			"/api/files/[...path]": { path: string };
			"/api/issues": { id?: string | undefined };
			"/api/issues/[id]": { id: string };
			"/api/uploads": Record<string, never>;
			"/board": Record<string, never>;
			"/issues": { id?: string | undefined };
			"/issues/[id]": { id: string };
			"/metrics": Record<string, never>
		};
		Pathname(): "/" | "/admin" | "/api/data/export" | "/api/data/import" | "/api/export" | `/api/files/${string}` & {} | "/api/issues" | `/api/issues/${string}` & {} | "/api/uploads" | "/board" | `/issues/${string}` & {} | "/metrics";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}