import type { ReactElement } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Structural view of the observable snapshots this plugin subscribes to. */
export interface SnapshotSource<T> {
    getSnapshot(): T;
    subscribe(listener: () => void): () => void;
}
/** Business face the registration injects (actions + the three data sources). */
export interface ActivityBellInjected {
    /** Open a Session in the conversation column. */
    readonly openSession: (sessionId: SessionId) => void;
    /** Pin/unpin a Session in the registry-global pin set. */
    readonly pinSession: (sessionId: SessionId) => Promise<void>;
    readonly unpinSession: (sessionId: SessionId) => Promise<void>;
    /**
     * Archive a Session. The host refuses while work is still running, and the
     * rejection carries its own message for the inline notice.
     */
    readonly archiveSession: (sessionId: SessionId) => Promise<void>;
    readonly sessions: SnapshotSource<SessionListState>;
    readonly statuses: SnapshotSource<SessionStatusSnapshot>;
    readonly workspaces: SnapshotSource<WorkspaceSnapshot>;
}
/** Composed props: shell share + locale seat + injected business face. */
export type ActivityBellProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'activity-bell'> & ActivityBellInjected;
/**
 * Render the bell into the sidebar header and, while active, the activity list
 * into the list seat it covers.
 * @param props - shell share, locale seat, and injected business face.
 * @returns the two portals, or null before the sidebar region exists.
 */
export declare function ActivityBell({ wide, t, openSession, pinSession, unpinSession, archiveSession, sessions, statuses, workspaces, }: ActivityBellProps): ReactElement | null;
