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

/** Session facts the projection reads (a structural subset of the client summary). */
export interface ActivitySession<Id extends string = string> {
  readonly id: Id
  /** Human-facing label: durable title, project basename, then Session id. */
  readonly displayTitle: string
  /** Provisional New Session placeholder; it has no finished work to report. */
  readonly blank: boolean
  /** Coarse durable origin; subagent rows stay hidden from every browser surface. */
  readonly origin?: 'subagent' | undefined
  readonly cwd?: string | undefined
  /** Latest durable update instant (epoch ms). */
  readonly updatedAt: number
  readonly running: boolean
  /** Local ownership counts; a positive `mainView` marks the open Session. */
  readonly retainedBy?: { readonly mainView?: number } | undefined
}

/** Session UI status facts the projection reads. */
export interface ActivityStatus {
  readonly running: boolean | undefined
  /** Finished while not selected and not yet opened. */
  readonly completionUnread: boolean
  readonly pendingInteraction?: { readonly kind: string } | undefined
}

/** Workspace facts the projection reads (a structural subset of the Workspace view). */
export interface ActivityWorkspace<Id extends string = string> {
  readonly workspaceId: string
  readonly title: string
  readonly path: string
  readonly sessionIds: readonly Id[]
}

/** Everything the projection needs for one render. */
export interface ActivityInputs<Id extends string = string> {
  readonly sessions: {
    readonly ids: readonly Id[]
    readonly byId: Readonly<Record<string, ActivitySession<Id> | undefined>>
  }
  readonly statuses: ReadonlyMap<Id, ActivityStatus>
  readonly workspaces: {
    readonly items: readonly ActivityWorkspace<Id>[]
    /** Registry-global archive set; archived rows are hidden by default. */
    readonly archivedSessionIds: readonly Id[]
    /** Registry-global pin set; it drives each row's pin affordance. */
    readonly pinnedSessionIds?: readonly Id[]
  }
  /**
   * Completions the surface itself observed (a turn that went from running to
   * stopped) and has not been acknowledged yet. The framework's own
   * `completionUnread` only covers Sessions that stopped while the operator was
   * somewhere else, so this carries the completions watched live as well.
   */
  readonly completedSince?: ReadonlySet<Id>
}

/** Pending-interaction kinds that carry a dedicated row marker. */
export type ActivityAttention = 'approval' | 'plan-review' | 'question'

/** The calendar bucket a row belongs to, resolved against a caller-supplied "now". */
export type ActivityDayBucket =
  | { readonly key: 'today'; readonly kind: 'today' }
  | { readonly key: 'yesterday'; readonly kind: 'yesterday' }
  | { readonly key: `weekday:${number}`; readonly kind: 'weekday'; readonly weekday: number }
  | {
    readonly key: `date:${string}`
    readonly kind: 'date'
    readonly year: number
    readonly month: number
    readonly day: number
  }

/** One rendered activity row. */
export interface ActivityRow<Id extends string = string> {
  readonly id: Id
  readonly title: string
  /** Owning Workspace title, or the working-directory basename; empty when neither is known. */
  readonly folder: string
  readonly updatedAt: number
  /** Finished and not yet opened: the green "done" dot. */
  readonly unread: boolean
  readonly running: boolean
  readonly pending: ActivityAttention | undefined
  /** In the registry-global pin set. */
  readonly pinned: boolean
  /** The Session the conversation column currently shows. */
  readonly current: boolean
  readonly bucket: ActivityDayBucket
}

/** One day section, newest day first. */
export interface ActivityGroup<Id extends string = string> {
  readonly key: string
  readonly bucket: ActivityDayBucket
  readonly rows: readonly ActivityRow<Id>[]
}

/** Default cap on rendered rows; the badge still counts every unread Session. */
export const ACTIVITY_ROW_LIMIT = 200

const MS_PER_DAY = 86_400_000

function startOfLocalDay(at: number): number {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
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
export function dayBucket(now: number, at: number): ActivityDayBucket {
  const elapsedDays = Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / MS_PER_DAY)
  if (elapsedDays <= 0) return { key: 'today', kind: 'today' }
  if (elapsedDays === 1) return { key: 'yesterday', kind: 'yesterday' }
  const date = new Date(at)
  if (elapsedDays < 7) {
    const weekday = date.getDay()
    return { key: `weekday:${weekday}`, kind: 'weekday', weekday }
  }
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return { key: `date:${year}-${pad2(month)}-${pad2(day)}`, kind: 'date', year, month, day }
}

/** Last path segment of a host directory path, or undefined when there is none. */
export function pathBasename(path: string | undefined): string | undefined {
  if (path === undefined) return undefined
  const segments = path.split(/[\\/]+/).filter(segment => segment !== '')
  return segments.length === 0 ? undefined : segments[segments.length - 1]
}

function folderIndex<Id extends string>(
  workspaces: readonly ActivityWorkspace<Id>[],
): ReadonlyMap<Id, string> {
  const index = new Map<Id, string>()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!index.has(sessionId)) index.set(sessionId, workspace.title)
    }
  }
  return index
}

function pendingKind(kind: string | undefined): ActivityAttention | undefined {
  switch (kind) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return kind
    default:
      return undefined
  }
}

/** Whether the browsing region would show this Session row. */
function visible<Id extends string>(
  session: ActivitySession<Id>,
  archived: ReadonlySet<string>,
): boolean {
  if (session.origin === 'subagent') return false
  if (session.blank) return false
  return !archived.has(session.id)
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
export function buildActivityGroups<Id extends string = string>(
  inputs: ActivityInputs<Id>,
  now: number,
  limit: number = ACTIVITY_ROW_LIMIT,
): ActivityGroup<Id>[] {
  const archived = new Set<string>(inputs.workspaces.archivedSessionIds)
  const pinned = new Set<string>(inputs.workspaces.pinnedSessionIds ?? [])
  const completedSince = inputs.completedSince
  const folders = folderIndex(inputs.workspaces.items)
  const candidates: ActivityRow<Id>[] = []
  for (const id of inputs.sessions.ids) {
    const session = inputs.sessions.byId[id]
    if (session === undefined || !visible(session, archived)) continue
    const status = inputs.statuses.get(id)
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
    })
  }
  candidates.sort((left, right) =>
    (right.updatedAt - left.updatedAt)
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))

  const groups: ActivityGroup<Id>[] = []
  const byKey = new Map<string, ActivityGroup<Id> & { rows: ActivityRow<Id>[] }>()
  for (const row of candidates.slice(0, limit)) {
    const existing = byKey.get(row.bucket.key)
    if (existing !== undefined) {
      existing.rows.push(row)
      continue
    }
    const group = { key: row.bucket.key, bucket: row.bucket, rows: [row] }
    byKey.set(row.bucket.key, group)
    groups.push(group)
  }
  return groups
}

/**
 * Count the Sessions that finished while unopened, restricted to the rows the
 * activity list would show so the badge and the list can never disagree.
 *
 * @param inputs - Session, status, and Workspace snapshots.
 * @returns the unread completion count.
 */
export function countUnread<Id extends string = string>(inputs: ActivityInputs<Id>): number {
  const archived = new Set<string>(inputs.workspaces.archivedSessionIds)
  const completedSince = inputs.completedSince
  let count = 0
  for (const id of inputs.sessions.ids) {
    const session = inputs.sessions.byId[id]
    if (session === undefined || !visible(session, archived)) continue
    if (inputs.statuses.get(id)?.completionUnread !== true && completedSince?.has(id) !== true) continue
    count += 1
  }
  return count
}
