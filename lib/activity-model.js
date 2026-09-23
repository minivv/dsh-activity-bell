/**
 * Pure projection behind the activity bell: which Sessions count as recent
 * activity, how they are ordered, and which calendar day each row belongs to.
 *
 * The module is deliberately free of React, DOM, and DSH services. The client
 * half feeds it the three snapshots it already reads (Session list, Session UI
 * status, Workspace registry) and renders the result; the tests feed it plain
 * objects. Filtering mirrors the sidebar browser's own visibility rule so the
 * bell never counts a row the browsing region would hide.
 *
 * @module dsh-activity-bell/activity-model
 */
/** Default cap on rendered rows; the badge still counts every unread Session. */
export const ACTIVITY_ROW_LIMIT = 200;
const MS_PER_DAY = 86_400_000;
function startOfLocalDay(at) {
    const date = new Date(at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}
function pad2(value) {
    return value < 10 ? `0${value}` : String(value);
}
/**
 * Resolve the calendar day a Session belongs to.
 *
 * Days are measured on the local calendar (not on a fixed 24h grid), so a
 * Session logged before a DST shift still lands on the previous day.
 *
 * @param now - render instant (epoch ms).
 * @param at - Session update instant (epoch ms).
 * @returns the bucket and its stable key (newest bucket keys sort first in the
 * insertion order the projection produces).
 */
export function dayBucket(now, at) {
    const elapsedDays = Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / MS_PER_DAY);
    if (elapsedDays <= 0)
        return { key: 'today', kind: 'today' };
    if (elapsedDays === 1)
        return { key: 'yesterday', kind: 'yesterday' };
    const date = new Date(at);
    if (elapsedDays < 7) {
        const weekday = date.getDay();
        return { key: `weekday:${weekday}`, kind: 'weekday', weekday };
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return { key: `date:${year}-${pad2(month)}-${pad2(day)}`, kind: 'date', year, month, day };
}
/** Last path segment of a host directory path, or undefined when there is none. */
export function pathBasename(path) {
    if (path === undefined)
        return undefined;
    const segments = path.split(/[\\/]+/).filter(segment => segment !== '');
    return segments.length === 0 ? undefined : segments[segments.length - 1];
}
function folderIndex(workspaces) {
    const index = new Map();
    for (const workspace of workspaces) {
        for (const sessionId of workspace.sessionIds) {
            if (!index.has(sessionId))
                index.set(sessionId, workspace.title);
        }
    }
    return index;
}
function pendingKind(kind) {
    switch (kind) {
        case 'approval':
        case 'plan-review':
        case 'question':
            return kind;
        default:
            return undefined;
    }
}
/** Whether the browsing region would show this Session row. */
function visible(session, archived) {
    if (session.origin === 'subagent')
        return false;
    if (session.blank)
        return false;
    return !archived.has(session.id);
}
/**
 * Project the three snapshots into day-grouped activity sections.
 *
 * Rows are filtered to the Sessions the sidebar itself would show, ordered by
 * latest update (newest first, id as the deterministic tie-break), capped at
 * `limit`, then folded into day sections whose order follows the newest row in
 * each section.
 *
 * @param inputs - Session, status, and Workspace snapshots.
 * @param now - render instant (epoch ms) used for the day buckets.
 * @param limit - maximum rows to render.
 * @returns day sections, newest first.
 */
export function buildActivityGroups(inputs, now, limit = ACTIVITY_ROW_LIMIT) {
    const archived = new Set(inputs.workspaces.archivedSessionIds);
    const pinned = new Set(inputs.workspaces.pinnedSessionIds ?? []);
    const completedSince = inputs.completedSince;
    const folders = folderIndex(inputs.workspaces.items);
    const candidates = [];
    for (const id of inputs.sessions.ids) {
        const session = inputs.sessions.byId[id];
        if (session === undefined || !visible(session, archived))
            continue;
        const status = inputs.statuses.get(id);
        candidates.push({
            id,
            title: session.displayTitle,
            folder: folders.get(id) ?? pathBasename(session.cwd) ?? '',
            updatedAt: session.updatedAt,
            unread: status?.completionUnread === true || completedSince?.has(id) === true,
            running: status?.running ?? session.running,
            pending: pendingKind(status?.pendingInteraction?.kind),
            pinned: pinned.has(id),
            current: (session.retainedBy?.mainView ?? 0) > 0,
            bucket: dayBucket(now, session.updatedAt),
        });
    }
    candidates.sort((left, right) => (right.updatedAt - left.updatedAt)
        || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    const groups = [];
    const byKey = new Map();
    for (const row of candidates.slice(0, limit)) {
        const existing = byKey.get(row.bucket.key);
        if (existing !== undefined) {
            existing.rows.push(row);
            continue;
        }
        const group = { key: row.bucket.key, bucket: row.bucket, rows: [row] };
        byKey.set(row.bucket.key, group);
        groups.push(group);
    }
    return groups;
}
/**
 * Count the Sessions that finished while unopened, restricted to the rows the
 * activity list would show so the badge and the list can never disagree.
 *
 * @param inputs - Session, status, and Workspace snapshots.
 * @returns the unread completion count.
 */
export function countUnread(inputs) {
    const archived = new Set(inputs.workspaces.archivedSessionIds);
    const completedSince = inputs.completedSince;
    let count = 0;
    for (const id of inputs.sessions.ids) {
        const session = inputs.sessions.byId[id];
        if (session === undefined || !visible(session, archived))
            continue;
        if (inputs.statuses.get(id)?.completionUnread !== true && completedSince?.has(id) !== true)
            continue;
        count += 1;
    }
    return count;
}
//# sourceMappingURL=activity-model.js.map