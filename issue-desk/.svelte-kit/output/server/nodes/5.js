import * as server from '../entries/pages/issues/_id_/_page.server.ts.js';

export const index = 5;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/issues/_id_/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/issues/[id]/+page.server.ts";
export const imports = ["_app/immutable/nodes/5.BQ18Hq5I.js","_app/immutable/chunks/D9VBEBf0.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/DMFFKMry.js"];
export const stylesheets = [];
export const fonts = [];
