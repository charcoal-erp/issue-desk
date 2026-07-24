import * as server from '../entries/pages/suites/_page.server.ts.js';

export const index = 8;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/suites/_page.svelte.js')).default;
export { server };
export const server_id = "src/routes/suites/+page.server.ts";
export const imports = ["_app/immutable/nodes/8.BDv6uttc.js","_app/immutable/chunks/CWVI4aQF.js","_app/immutable/chunks/BVQvSoG6.js","_app/immutable/chunks/xihTtKlq.js","_app/immutable/chunks/D7hvqh-d.js","_app/immutable/chunks/BEQbAcRU.js","_app/immutable/chunks/DxVlLY23.js","_app/immutable/chunks/DfXbrp-g.js","_app/immutable/chunks/C3Pbocki.js","_app/immutable/chunks/KZ1Y5rIE.js","_app/immutable/chunks/BmRMn72H.js","_app/immutable/chunks/6xcCrJF1.js"];
export const stylesheets = ["_app/immutable/assets/SuiteTags.CWzxnazc.css","_app/immutable/assets/8.CShUx6fG.css"];
export const fonts = [];
