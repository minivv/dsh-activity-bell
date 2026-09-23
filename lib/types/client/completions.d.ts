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
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
/** What one pass over the snapshots tells about a Session. */
export interface SessionFacts {
    readonly running: boolean;
    /** The Session is the one the conversation column shows. */
    readonly mainView: boolean;
}
/**
 * Read the running / main-view facts the tracker compares across passes.
 *
 * @param list - Session list snapshot.
 * @param statuses - Session UI status snapshot.
 * @returns one entry per Session in the list.
 */
export declare function sessionFacts(list: SessionListState, statuses: SessionStatusSnapshot): ReadonlyMap<SessionId, SessionFacts>;
/**
 * Fold one observation pass into the pending set.
 *
 * @param pending - completions recorded so far.
 * @param previous - facts of the previous pass, absent on the first pass.
 * @param current - facts of this pass.
 * @returns the next pending set (the same reference when nothing changed).
 */
export declare function nextPending(pending: ReadonlySet<SessionId>, previous: ReadonlyMap<SessionId, SessionFacts> | undefined, current: ReadonlyMap<SessionId, SessionFacts>): ReadonlySet<SessionId>;
