import * as server from '../entries/pages/_page.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/+page.server.ts";
export const imports = ["_app/immutable/nodes/2.UBZdBQLr.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/BEQbAcRU.js","_app/immutable/chunks/DfXbrp-g.js","_app/immutable/chunks/DRO7zBjV.js"];
export const stylesheets = [];
export const fonts = [];
