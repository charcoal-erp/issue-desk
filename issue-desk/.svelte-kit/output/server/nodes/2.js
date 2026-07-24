import * as server from '../entries/pages/_page.server.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/+page.server.ts";
export const imports = ["_app/immutable/nodes/2.zShps3YV.js","_app/immutable/chunks/D9VBEBf0.js","_app/immutable/chunks/_4I19Yk1.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/IYFsWzVG.js","_app/immutable/chunks/BFIhEJdR.js","_app/immutable/chunks/BOwZKxov.js","_app/immutable/chunks/CYy69s-7.js","_app/immutable/chunks/DMFFKMry.js","_app/immutable/chunks/CulRq-te.js","_app/immutable/chunks/BUvbV8xX.js"];
export const stylesheets = ["_app/immutable/assets/PriorityMeter.18d7XFzS.css","_app/immutable/assets/2.Cq2seGgN.css"];
export const fonts = [];
