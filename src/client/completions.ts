/**
 * Local completion tracking for the activity bell.
 *
 * The framework's `completionUnread` marks a Session that stopped while the
 * operator was looking somewhere else; a turn watched to completion in the
 * current Session is deliberately not a reminder there. The bell wants both:
 * "a task just finished" is worth a badge whether or not that Session was on
 * screen. This module turns the Session UI status stream into that set —
 * recording every observed running → stopped transition, and dropping an entry
 * once the operator has acknowledged it (opened the Session) or the Session
 * starts running again.
 *
 * @module dsh-activity-bell/client/completions
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'

/** What one pass over the snapshots tells about a Session. */
export interface SessionFacts {
  readonly running: boolean
  /** The Session is the one the conversation column shows. */
  readonly mainView: boolean
}

/**
 * Read the running / main-view facts the tracker compares across passes.
 *
 * @param list - Session list snapshot.
 * @param statuses - Session UI status snapshot.
 * @returns one entry per Session in the list.
 */
export function sessionFacts(
  list: SessionListState,
  statuses: SessionStatusSnapshot,
): ReadonlyMap<SessionId, SessionFacts> {
  const facts = new Map<SessionId, SessionFacts>()
  for (const id of list.ids) {
    const row = list.byId[id]
    facts.set(id, {
      running: statuses.get(id)?.running ?? row?.running ?? false,
      mainView: (row?.retainedBy?.mainView ?? 0) > 0,
    })
  }
  return facts
}

/**
 * Fold one observation pass into the pending set.
 *
 * @param pending - completions recorded so far.
 * @param previous - facts of the previous pass, absent on the first pass.
 * @param current - facts of this pass.
 * @returns the next pending set (the same reference when nothing changed).
 */
export function nextPending(
  pending: ReadonlySet<SessionId>,
  previous: ReadonlyMap<SessionId, SessionFacts> | undefined,
  current: ReadonlyMap<SessionId, SessionFacts>,
): ReadonlySet<SessionId> {
  let next: Set<SessionId> | undefined
  const edit = (): Set<SessionId> => {
    next ??= new Set(pending)
    return next
  }
  for (const [id, facts] of current) {
    // A turn that just stopped counts as a completion.
    if (facts.running) {
      if (pending.has(id)) edit().delete(id)
      continue
    }
    const before = previous?.get(id)
    if (before?.running === true) edit().add(id)
    // Coming back into the Session after it stopped is the acknowledgement,
    // however the operator got there (this list, the sidebar, a deep link).
    else if (before !== undefined && !before.mainView && facts.mainView) edit().delete(id)
  }
  // Sessions that left the list carry nothing to remind about.
  for (const id of pending) {
    if (!current.has(id)) edit().delete(id)
  }
  if (next === undefined) return pending
  if (next.size === pending.size) {
    let same = true
    for (const id of pending) {
      if (!next.has(id)) { same = false; break }
    }
    if (same) return pending
  }
  return next
}
