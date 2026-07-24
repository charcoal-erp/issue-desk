import * as server from '../entries/pages/_layout.server.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/+layout.server.ts";
export const imports = ["_app/immutable/nodes/0.DLQ14m_C.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/BVQvSoG6.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/DEazVZkO.js","_app/immutable/chunks/D7hvqh-d.js","_app/immutable/chunks/BEQbAcRU.js","_app/immutable/chunks/DxVlLY23.js","_app/immutable/chunks/DfXbrp-g.js","_app/immutable/chunks/C3Pbocki.js","_app/immutable/chunks/BGTTGnUd.js"];
export const stylesheets = ["_app/immutable/assets/SuiteTags.CWzxnazc.css","_app/immutable/assets/0.Cv91Su_k.css"];
export const fonts = [];
