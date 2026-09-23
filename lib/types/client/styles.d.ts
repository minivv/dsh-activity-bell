/**
 * Injected page styles for the activity bell and its panel. One
 * `<style data-plugin>` element owns every `ab-` class; the client fiber
 * removes it on dispose.
 *
 * Every surface inherits the shell's own tokens so the bell reads as part of
 * the sidebar rather than as an overlay: the control reuses the region's
 * icon-button geometry, the active state reuses the sidebar's nav-item active
 * pair, and the panel paints the sidebar fill so the list underneath cannot
 * show through.
 *
 * @module dsh-activity-bell/client/styles
 */
/**
 * Inject the stylesheet once per document.
 * @returns the attached style element.
 */
export declare function injectStyles(): HTMLStyleElement;
/** Remove the stylesheet (client fiber dispose). */
export declare function removeStyles(): void;
