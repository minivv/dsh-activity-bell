/**
 * DOM anchors for the sidebar browsing region.
 *
 * The shell's `sidebar.workspaces` slot is a single occupant owned by
 * ui-workspace, and the section header (label + search + view actions + add)
 * lives inside that occupant — the sidebar declares no hole beside the search
 * control. The bell therefore rides a DOM portal, and this module owns the one
 * fragile part of that choice: locating the header and the list seat, and
 * keeping the injected containers attached while React re-renders the region.
 *
 * Selectors match the CSS-module *local* names (`[class*="sectionHeader"]`
 * matches the emitted `hash_sectionHeader`). Local names are source-stable in
 * a way build hashes are not, and the header candidate is additionally
 * validated by the search control it must contain, so an unrelated section
 * header elsewhere in the shell can never be mistaken for this one.
 *
 * @module dsh-activity-bell/client/anchors
 */

/** Resolved sidebar-region anchors for one rendered shell. */
export interface SidebarAnchors {
  /** The browsing region's section header row. */
  readonly header: HTMLElement
  /** The trailing action cluster; the bell is inserted directly before it. */
  readonly actions: HTMLElement | null
  /** The list seat below the header; the activity panel covers it while active. */
  readonly listArea: HTMLElement | null
}

/** Inline-end inset the shipped rows keep from the list seat's trailing edge. */
export interface RowInset {
  /** Inset in CSS pixels. */
  readonly inlineEnd: number
}

/**
 * Measure how far the shipped rows stop from the list seat's trailing edge.
 *
 * The activity list hugs the leading edge on purpose (the operator asked for
 * the rows to start as far left as the dot column allows), but the trailing
 * edge still has to agree with the shipped rows: a theme or a release may
 * change the sidebar's inline padding, and matching the measured value keeps
 * the two lists ending on the same line in any of them.
 *
 * @param listArea - the browsing region's list seat.
 * @returns the measured inset, or undefined when the list has no rows yet.
 */
export function measureRowInset(listArea: HTMLElement | null): RowInset | undefined {
  if (listArea === null || !listArea.isConnected) return undefined
  const row = listArea.querySelector<HTMLElement>('[data-row-key^="session:"]')
    ?? listArea.querySelector<HTMLElement>('[data-row-key^="workspace:"]')
  if (row === null) return undefined
  const rowBox = row.getBoundingClientRect()
  if (rowBox.width <= 0) return undefined
  const seatBox = listArea.getBoundingClientRect()
  return { inlineEnd: Math.round(seatBox.right - rowBox.right) }
}

/**
 * Publish the measured trailing inset as the custom property the panel uses.
 * @param host - the panel's portal container.
 * @param inset - measured inset, or undefined to fall back to the stylesheet default.
 */
export function applyRowInset(host: HTMLElement, inset: RowInset | undefined): void {
  if (inset === undefined) {
    host.style.removeProperty('--ab-panel-pad-right')
    return
  }
  host.style.setProperty('--ab-panel-pad-right', `${inset.inlineEnd}px`)
}

const HEADER_SELECTOR = '[class*="sectionHeader"]'
const SEARCH_SLOT_SELECTOR = '[class*="searchSlot"]'
const ACTIONS_SELECTOR = '[class*="headerActions"]'
const LIST_AREA_SELECTOR = '[class*="listArea"]'
const SEARCH_CONTROL_SELECTOR = 'button[aria-expanded]'

/**
 * Find the workspace browser's section header.
 *
 * @param doc - document to search.
 * @returns the header element, or undefined while the region is unmounted.
 */
export function findSidebarHeader(doc: Document): HTMLElement | undefined {
  for (const candidate of doc.querySelectorAll<HTMLElement>(HEADER_SELECTOR)) {
    if (candidate.querySelector(SEARCH_SLOT_SELECTOR) === null) continue
    if (candidate.querySelector(SEARCH_CONTROL_SELECTOR) === null) continue
    return candidate
  }
  return undefined
}

/**
 * Resolve every anchor the bell needs.
 *
 * @param doc - document to search.
 * @returns the anchors, or undefined while the region is unmounted.
 */
export function resolveSidebarAnchors(doc: Document): SidebarAnchors | undefined {
  const header = findSidebarHeader(doc)
  if (header === undefined) return undefined
  const root = header.parentElement
  return {
    header,
    actions: header.querySelector<HTMLElement>(ACTIONS_SELECTOR),
    listArea: root?.querySelector<HTMLElement>(LIST_AREA_SELECTOR) ?? null,
  }
}

/**
 * Re-read the mutable anchors of an already-resolved header without walking the
 * document again; the caller keeps the previous value when nothing moved.
 *
 * @param previous - anchors resolved by an earlier pass.
 * @returns anchors whose header is the same element, or undefined once it left the document.
 */
export function refreshSidebarAnchors(previous: SidebarAnchors): SidebarAnchors | undefined {
  if (!previous.header.isConnected) return undefined
  return {
    header: previous.header,
    actions: previous.header.querySelector<HTMLElement>(ACTIONS_SELECTOR),
    listArea: previous.header.parentElement?.querySelector<HTMLElement>(LIST_AREA_SELECTOR) ?? null,
  }
}

/**
 * Compare two resolutions by element identity.
 *
 * @param left - first resolution.
 * @param right - second resolution.
 * @returns true when both address the same elements.
 */
export function sameSidebarAnchors(
  left: SidebarAnchors | undefined,
  right: SidebarAnchors | undefined,
): boolean {
  if (left === right) return true
  if (left === undefined || right === undefined) return false
  return left.header === right.header
    && left.actions === right.actions
    && left.listArea === right.listArea
}

/**
 * Create and attach one injected container.
 *
 * Inserting (never moving or removing shell nodes) is what keeps this safe
 * across React re-renders: the shell owns its children, the plugin owns this
 * extra node, and React's reconciliation leaves it alone.
 *
 * @param parent - element to attach to.
 * @param before - sibling to insert before, or null to append.
 * @param className - class carrying the container's own layout.
 * @returns the attached container.
 */
export function mountContainer(
  parent: HTMLElement,
  before: Element | null,
  className: string,
): HTMLElement {
  const container = parent.ownerDocument.createElement('div')
  container.className = className
  container.dataset.activityBellHost = className
  parent.insertBefore(container, before)
  return container
}

/**
 * Make an element a positioning context for the absolute panel.
 *
 * @param element - element the panel is portalled into.
 * @returns a disposer restoring the element's previous inline position.
 */
export function ensurePositioned(element: HTMLElement): () => void {
  const inline = element.style.position
  const computed = element.ownerDocument.defaultView?.getComputedStyle(element).position
  if (computed !== undefined && computed !== '' && computed !== 'static') return () => {}
  element.style.position = 'relative'
  return () => {
    element.style.position = inline
  }
}
