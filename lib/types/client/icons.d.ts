/**
 * Bell glyph. The product icon set ships no bell (its 274 icons cover the
 * shell surfaces), so this module draws one at the same weight: a 16px
 * current-color outline with a 1px stroke.
 *
 * @module dsh-activity-bell/client/icons
 */
/**
 * Render the bell outline.
 * @param props.size - requested square edge in pixels.
 * @returns the icon element (decorative; the surrounding button owns the label).
 */
export declare function BellIcon({ size }: {
    size?: number;
}): import("react").JSX.Element;
