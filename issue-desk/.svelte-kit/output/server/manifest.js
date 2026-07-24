export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.CYP0hEm4.js",app:"_app/immutable/entry/app.H_ZpJvDl.js",imports:["_app/immutable/entry/start.CYP0hEm4.js","_app/immutable/chunks/_4I19Yk1.js","_app/immutable/chunks/D9VBEBf0.js","_app/immutable/entry/app.H_ZpJvDl.js","_app/immutable/chunks/D9VBEBf0.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/admin",
				pattern: /^\/admin\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/data/export",
				pattern: /^\/api\/data\/export\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/data/export/_server.ts.js'))
			},
			{
				id: "/api/data/import",
				pattern: /^\/api\/data\/import\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/data/import/_server.ts.js'))
			},
			{
				id: "/api/export",
				pattern: /^\/api\/export\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/export/_server.ts.js'))
			},
			{
				id: "/api/files/[...path]",
				pattern: /^\/api\/files(?:\/([^]*))?\/?$/,
				params: [{"name":"path","optional":false,"rest":true,"chained":true}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/files/_...path_/_server.ts.js'))
			},
			{
				id: "/api/issues",
				pattern: /^\/api\/issues\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/issues/_server.ts.js'))
			},
			{
				id: "/api/issues/[id]",
				pattern: /^\/api\/issues\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/issues/_id_/_server.ts.js'))
			},
			{
				id: "/api/uploads",
				pattern: /^\/api\/uploads\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/uploads/_server.ts.js'))
			},
			{
				id: "/board",
				pattern: /^\/board\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/issues/[id]",
				pattern: /^\/issues\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/metrics",
				pattern: /^\/metrics\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
