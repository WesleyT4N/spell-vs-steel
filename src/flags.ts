// Build flags, set by vite.config.ts. `npm run build` is the dev build (dev tools on);
// `npm run build:prod` turns them off and drops their code from the bundle.
declare const __DEV_TOOLS__: boolean;

/** Title > DEV TOOLS and the #cards / #sandbox / #lab routes. */
export const DEV_TOOLS: boolean = typeof __DEV_TOOLS__ === 'undefined' ? true : __DEV_TOOLS__;
