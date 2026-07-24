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
		client: {start:"_app/immutable/entry/start.jy2FyPW0.js",app:"_app/immutable/entry/app.DNd2Gxg-.js",imports:["_app/immutable/entry/start.jy2FyPW0.js","_app/immutable/chunks/BVQvSoG6.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/entry/app.DNd2Gxg-.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js'))
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
				id: "/api/export/cases",
				pattern: /^\/api\/export\/cases\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/export/cases/_server.ts.js'))
			},
			{
				id: "/api/export/failures",
				pattern: /^\/api\/export\/failures\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/export/failures/_server.ts.js'))
			},
			{
				id: "/api/import/cases",
				pattern: /^\/api\/import\/cases\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/import/cases/_server.ts.js'))
			},
			{
				id: "/cases",
				pattern: /^\/cases\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/runners",
				pattern: /^\/runners\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/runs",
				pattern: /^\/runs\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/runs/launch",
				pattern: /^\/runs\/launch\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/runs/launch/_server.ts.js'))
			},
			{
				id: "/runs/[runId]",
				pattern: /^\/runs\/([^/]+?)\/?$/,
				params: [{"name":"runId","optional":false,"rest":false,"chained":false}],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/search",
				pattern: /^\/search\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/suites",
				pattern: /^\/suites\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
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
