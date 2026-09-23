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
    readonly header: HTMLElement;
    /** The trailing action cluster; the bell is inserted directly before it. */
    readonly actions: HTMLElement | null;
    /** The list seat below the header; the activity panel covers it while active. */
    readonly listArea: HTMLElement | null;
}
/** Inline-end inset the shipped rows keep from the list seat's trailing edge. */
export interface RowInset {
    /** Inset in CSS pixels. */
    readonly inlineEnd: number;
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
export declare function measureRowInset(listArea: HTMLElement | null): RowInset | undefined;
/**
 * Publish the measured trailing inset as the custom property the panel uses.
 * @param host - the panel's portal container.
 * @param inset - measured inset, or undefined to fall back to the stylesheet default.
 */
export declare function applyRowInset(host: HTMLElement, inset: RowInset | undefined): void;
/**
 * Find the workspace browser's section header.
 *
 * @param doc - document to search.
 * @returns the header element, or undefined while the region is unmounted.
 */
export declare function findSidebarHeader(doc: Document): HTMLElement | undefined;
/**
 * Resolve every anchor the bell needs.
 *
 * @param doc - document to search.
 * @returns the anchors, or undefined while the region is unmounted.
 */
export declare function resolveSidebarAnchors(doc: Document): SidebarAnchors | undefined;
/**
 * Re-read the mutable anchors of an already-resolved header without walking the
 * document again; the caller keeps the previous value when nothing moved.
 *
 * @param previous - anchors resolved by an earlier pass.
 * @returns anchors whose header is the same element, or undefined once it left the document.
 */
export declare function refreshSidebarAnchors(previous: SidebarAnchors): SidebarAnchors | undefined;
/**
 * Compare two resolutions by element identity.
 *
 * @param left - first resolution.
 * @param right - second resolution.
 * @returns true when both address the same elements.
 */
export declare function sameSidebarAnchors(left: SidebarAnchors | undefined, right: SidebarAnchors | undefined): boolean;
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
export declare function mountContainer(parent: HTMLElement, before: Element | null, className: string): HTMLElement;
/**
 * Make an element a positioning context for the absolute panel.
 *
 * @param element - element the panel is portalled into.
 * @returns a disposer restoring the element's previous inline position.
 */
export declare function ensurePositioned(element: HTMLElement): () => void;
