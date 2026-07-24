import * as server from '../entries/pages/board/_page.server.ts.js';

export const index = 4;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/board/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/board/+page.server.ts";
export const imports = ["_app/immutable/nodes/4.o_e5SVaL.js","_app/immutable/chunks/D9VBEBf0.js","_app/immutable/chunks/_4I19Yk1.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/BFIhEJdR.js","_app/immutable/chunks/BOwZKxov.js","_app/immutable/chunks/CYy69s-7.js","_app/immutable/chunks/DMFFKMry.js","_app/immutable/chunks/klkkFsjl.js","_app/immutable/chunks/BQTPcRDI.js","_app/immutable/chunks/BUvbV8xX.js"];
export const stylesheets = ["_app/immutable/assets/PriorityMeter.18d7XFzS.css","_app/immutable/assets/4.CfWl1FL7.css"];
export const fonts = [];
