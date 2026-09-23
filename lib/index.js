/**
 * dsh-activity-bell — host entry.
 *
 * The plugin is client-only: the bell, the unread badge, and the
 * recent-activity list are all browser concerns, and every fact they read
 * (Session list, Session UI status, Workspace registry) is already shipped by
 * the Web app's host rows. This row therefore exists only so the bundle has a
 * resolvable Node entry and the client roster can discover the browser half
 * through `dsh.client`.
 *
 * @module dsh-activity-bell
 */
/** Stable cordis plugin name (the bundle row's `name` resolves to this package). */
export const name = 'dsh-activity-bell';
/**
 * Mount the host half.
 *
 * Intentionally empty: a host-side behavior here would have to invent a second
 * source of truth for state the Web client already owns.
 */
export function apply() { }
//# sourceMappingURL=index.js.map