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
    readonly id: Id;
    /** Human-facing label: durable title, project basename, then Session id. */
    readonly displayTitle: string;
    /** Provisional New Session placeholder; it has no finished work to report. */
    readonly blank: boolean;
    /** Coarse durable origin; subagent rows stay hidden from every browser surface. */
    readonly origin?: 'subagent' | undefined;
    readonly cwd?: string | undefined;
    /** Latest durable update instant (epoch ms). */
    readonly updatedAt: number;
    readonly running: boolean;
    /** Local ownership counts; a positive `mainView` marks the open Session. */
    readonly retainedBy?: {
        readonly mainView?: number;
    } | undefined;
}
/** Session UI status facts the projection reads. */
export interface ActivityStatus {
    readonly running: boolean | undefined;
    /** Finished while not selected and not yet opened. */
    readonly completionUnread: boolean;
    readonly pendingInteraction?: {
        readonly kind: string;
    } | undefined;
}
/** Workspace facts the projection reads (a structural subset of the Workspace view). */
export interface ActivityWorkspace<Id extends string = string> {
    readonly workspaceId: string;
    readonly title: string;
    readonly path: string;
    readonly sessionIds: readonly Id[];
}
/** Everything the projection needs for one render. */
export interface ActivityInputs<Id extends string = string> {
    readonly sessions: {
        readonly ids: readonly Id[];
        readonly byId: Readonly<Record<string, ActivitySession<Id> | undefined>>;
    };
    readonly statuses: ReadonlyMap<Id, ActivityStatus>;
    readonly workspaces: {
        readonly items: readonly ActivityWorkspace<Id>[];
        /** Registry-global archive set; archived rows are hidden by default. */
        readonly archivedSessionIds: readonly Id[];
        /** Registry-global pin set; it drives each row's pin affordance. */
        readonly pinnedSessionIds?: readonly Id[];
    };
    /**
     * Completions the surface itself observed (a turn that went from running to
     * stopped) and has not been acknowledged yet. The framework's own
     * `completionUnread` only covers Sessions that stopped while the operator was
     * somewhere else, so this carries the completions watched live as well.
     */
    readonly completedSince?: ReadonlySet<Id>;
}
/** Pending-interaction kinds that carry a dedicated row marker. */
export type ActivityAttention = 'approval' | 'plan-review' | 'question';
/** The calendar bucket a row belongs to, resolved against a caller-supplied "now". */
export type ActivityDayBucket = {
    readonly key: 'today';
    readonly kind: 'today';
} | {
    readonly key: 'yesterday';
    readonly kind: 'yesterday';
} | {
    readonly key: `weekday:${number}`;
    readonly kind: 'weekday';
    readonly weekday: number;
} | {
    readonly key: `date:${string}`;
    readonly kind: 'date';
    readonly year: number;
    readonly month: number;
    readonly day: number;
};
/** One rendered activity row. */
export interface ActivityRow<Id extends string = string> {
    readonly id: Id;
    readonly title: string;
    /** Owning Workspace title, or the working-directory basename; empty when neither is known. */
    readonly folder: string;
    readonly updatedAt: number;
    /** Finished and not yet opened: the green "done" dot. */
    readonly unread: boolean;
    readonly running: boolean;
    readonly pending: ActivityAttention | undefined;
    /** In the registry-global pin set. */
    readonly pinned: boolean;
    /** The Session the conversation column currently shows. */
    readonly current: boolean;
    readonly bucket: ActivityDayBucket;
}
/** One day section, newest day first. */
export interface ActivityGroup<Id extends string = string> {
    readonly key: string;
    readonly bucket: ActivityDayBucket;
    readonly rows: readonly ActivityRow<Id>[];
}
/** Default cap on rendered rows; the badge still counts every unread Session. */
export declare const ACTIVITY_ROW_LIMIT = 200;
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
export declare function dayBucket(now: number, at: number): ActivityDayBucket;
/** Last path segment of a host directory path, or undefined when there is none. */
export declare function pathBasename(path: string | undefined): string | undefined;
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
export declare function buildActivityGroups<Id extends string = string>(inputs: ActivityInputs<Id>, now: number, limit?: number): ActivityGroup<Id>[];
/**
 * Count the Sessions that finished while unopened, restricted to the rows the
 * activity list would show so the badge and the list can never disagree.
 *
 * @param inputs - Session, status, and Workspace snapshots.
 * @returns the unread completion count.
 */
export declare function countUnread<Id extends string = string>(inputs: ActivityInputs<Id>): number;
