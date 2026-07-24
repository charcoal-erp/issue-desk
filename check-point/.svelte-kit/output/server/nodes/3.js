import * as server from '../entries/pages/cases/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/cases/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/cases/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.Ss6uNcgX.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/BVQvSoG6.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/DEazVZkO.js","_app/immutable/chunks/D7hvqh-d.js","_app/immutable/chunks/BEQbAcRU.js","_app/immutable/chunks/DxVlLY23.js","_app/immutable/chunks/DfXbrp-g.js","_app/immutable/chunks/DRO7zBjV.js","_app/immutable/chunks/KZ1Y5rIE.js"];
export const stylesheets = [];
export const fonts = [];
