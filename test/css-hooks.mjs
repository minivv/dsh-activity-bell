/**
 * Module hooks for the node test lane.
 *
 * Two adjustments let the tests import the shipped client code:
 *
 * - `.module.css` files are imported by the published packages as real
 *   stylesheets, which node cannot load. Each one resolves to a proxy that
 *   answers any class lookup with the class's own name.
 * - `@deepseek-ai/dsh-client-ui-primitives` is a platform module in the browser
 *   (the shell's module table provides it, so the package declares no
 *   dependencies of its own); its ESM entry pulls heavy syntax highlighting the
 *   tests must not need. The double keeps the same surface for the three
 *   primitives this plugin renders.
 */

const PRIMITIVES = '@deepseek-ai/dsh-client-ui-primitives'

/** Redirect the platform-module import to the local double. */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === PRIMITIVES) {
    return { url: new URL('./primitives-double.mjs', import.meta.url).href, format: 'module', shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

/** Serve every `.css` request as a class-name proxy instead of a stylesheet. */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default new Proxy({}, { get: (_target, key) => (typeof key === "string" ? key : undefined) });',
    }
  }
  return nextLoad(url, context)
}
