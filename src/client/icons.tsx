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
export function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.845 14a1.333 1.333 0 0 0 2.31 0" />
      <path d="M2.175 10.217A.667.667 0 0 0 2.667 11.333h10.666a.667.667 0 0 0 .493-1.115C12.94 9.304 12 8.333 12 5.333A4 4 0 0 0 4 5.333c0 3-.941 3.971-1.825 4.884" />
    </svg>
  )
}
