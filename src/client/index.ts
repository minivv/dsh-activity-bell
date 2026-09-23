/**
 * Client half: inject the page styles, register the `activity-bell`
 * dictionaries, and mount the bell through the sidebar foot's action list.
 *
 * The registration is the component's lifecycle and locale carrier (plus the
 * shell's `wide` flag); the visible surfaces are portalled into the browsing
 * region, because the region is a single-occupant slot whose header has no
 * hole beside the search control. See `./ActivityBell` for that rationale.
 *
 * @module dsh-activity-bell/client
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import './types.js'
import { ActivityBell } from './ActivityBell.js'
import { en, zh } from './locales.js'
import { injectStyles, removeStyles } from './styles.js'

/** Dictionary namespace owned by this plugin. */
const NS = 'activity-bell'

/** Services required before this plugin mounts. */
export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace']

/**
 * Mount the browser half.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const style = injectStyles()
    return () => {
      style.remove()
      removeStyles()
    }
  }, 'activity-bell: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'activity-bell: dictionaries')

  // The injected face binds the framework's own sources: the Session list the
  // browsing region reads, the UI status it derives row dots from, and the
  // Workspace registry that supplies folder labels and archive membership.
  // Both services are part of `inject` above, so presence is already
  // guaranteed; `get` only lacks that refinement in its own type.
  const sessions = (ctx.get('sessions') as ISessions).list
  const statuses = ctx.uiSession.sessionStatus
  const workspaces = (ctx.get('workspaces') as IWorkspaces).list
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'activity-bell',
    order: 900,
    locale: NS,
    inject: () => ({
      openSession: (sessionId: SessionId) => { ctx.uiWorkspace.openSession(sessionId) },
      pinSession: (sessionId: SessionId) => ctx.uiWorkspace.pinSession(sessionId),
      unpinSession: (sessionId: SessionId) => ctx.uiWorkspace.unpinSession(sessionId),
      archiveSession: (sessionId: SessionId) => ctx.uiWorkspace.archiveSession(sessionId),
      sessions,
      statuses,
      workspaces,
    }),
  }, ActivityBell))
}
