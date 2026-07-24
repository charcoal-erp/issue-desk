import * as server from '../entries/pages/search/_page.server.ts.js';

export const index = 7;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/search/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/search/+page.server.ts";
export const imports = ["_app/immutable/nodes/7.B0kKF6NT.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/BEQbAcRU.js"];
export const stylesheets = [];
export const fonts = [];
