import * as server from '../entries/pages/admin/_page.server.ts.js';

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/admin/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/admin/+page.server.ts";
export const imports = ["_app/immutable/nodes/3.BlepXOPE.js","_app/immutable/chunks/D9VBEBf0.js","_app/immutable/chunks/_4I19Yk1.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/BFIhEJdR.js","_app/immutable/chunks/BOwZKxov.js","_app/immutable/chunks/BQTPcRDI.js","_app/immutable/chunks/BUvbV8xX.js"];
export const stylesheets = ["_app/immutable/assets/3.B5YfKsus.css"];
export const fonts = [];
