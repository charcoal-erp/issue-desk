import * as server from '../entries/pages/runners/_page.server.ts.js';

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/runners/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/runners/+page.server.ts";
export const imports = ["_app/immutable/nodes/4.IwSkm5DU.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/BVQvSoG6.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/D7hvqh-d.js","_app/immutable/chunks/BEQbAcRU.js","_app/immutable/chunks/DxVlLY23.js","_app/immutable/chunks/BGTTGnUd.js","_app/immutable/chunks/KZ1Y5rIE.js","_app/immutable/chunks/BmRMn72H.js","_app/immutable/chunks/6xcCrJF1.js"];
export const stylesheets = ["_app/immutable/assets/4.ByWz_dnm.css"];
export const fonts = [];
