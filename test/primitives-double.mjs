/**
 * Test double for `@deepseek-ai/dsh-client-ui-primitives` on the node lane.
 *
 * The browser gets the real package from the shell's platform module table;
 * here only this plugin's surface is needed, so each primitive keeps its
 * contract (Tooltip renders its anchor, StateDot announces its state) while
 * staying importable without the shell's dependency graph.
 */
import { createElement } from 'react'

/** The real Tooltip clones its anchor; the double renders it unchanged. */
export function Tooltip({ children }) {
  return children
}

/** State dot double: the semantic state stays observable in the DOM. */
export function StateDot({ state, size }) {
  return createElement('span', { 'data-state-dot': state, 'data-size': size })
}

/** Folder glyph double (the real one is a current-color SVG). */
export function IconFolderOpenOutlineRegular() {
  return createElement('svg', { 'data-icon': 'folder-open' })
}

/** Pin glyph doubles: the filled one also marks a pinned row. */
export function IconPinOutlineRegular() {
  return createElement('svg', { 'data-icon': 'pin-outline' })
}

export function IconPinFillRegular() {
  return createElement('svg', { 'data-icon': 'pin-fill' })
}

/** Archive glyph double. */
export function IconArchiveOutlineRegular() {
  return createElement('svg', { 'data-icon': 'archive' })
}
