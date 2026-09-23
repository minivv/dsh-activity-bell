/**
 * The bell control and the activity list it toggles.
 *
 * Placement is a DOM portal: the sidebar's browsing region is one single-occupant
 * slot (`sidebar.workspaces`) whose header has no hole beside the search
 * control, so the bell is portalled into that header and the panel into the
 * list seat below it. The slot registration that carries this component exists
 * for its lifecycle, its locale seat, and the shell's `wide` flag — the entry
 * itself renders nothing into the sidebar foot.
 *
 * Both surfaces read the same two snapshots the browsing region reads:
 * `sessions` (list rows, titles, workspaces) and `uiSession.sessionStatus`
 * (running / pending / finished-unviewed), plus the Workspace registry for
 * folder labels and archive membership. Nothing is cached: the badge, the
 * green dots, and the ordering all recompute from those snapshots, so opening
 * a Session clears its dot exactly the way the shipped rows do.
 *
 * @module dsh-activity-bell/client/ActivityBell
 */
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react'
import type { ReactElement } from 'react'
import { createPortal } from 'react-dom'
import {
  IconArchiveOutlineRegular, IconFolderOpenOutlineRegular, IconPinFillRegular, IconPinOutlineRegular,
  StateDot, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  buildActivityGroups, countUnread, type ActivityDayBucket, type ActivityRow,
} from '../activity-model.js'
import {
  applyRowInset, ensurePositioned, measureRowInset, mountContainer, type SidebarAnchors,
} from './anchors.js'
import { nextPending, sessionFacts, type SessionFacts } from './completions.js'
import { BellIcon } from './icons.js'
import { useTitleMarquee } from './marquee.js'
import { useSidebarAnchors } from './use-anchors.js'

/** Structural view of the observable snapshots this plugin subscribes to. */
export interface SnapshotSource<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/** Business face the registration injects (actions + the three data sources). */
export interface ActivityBellInjected {
  /** Open a Session in the conversation column. */
  readonly openSession: (sessionId: SessionId) => void
  /** Pin/unpin a Session in the registry-global pin set. */
  readonly pinSession: (sessionId: SessionId) => Promise<void>
  readonly unpinSession: (sessionId: SessionId) => Promise<void>
  /**
   * Archive a Session. The host refuses while work is still running, and the
   * rejection carries its own message for the inline notice.
   */
  readonly archiveSession: (sessionId: SessionId) => Promise<void>
  readonly sessions: SnapshotSource<SessionListState>
  readonly statuses: SnapshotSource<SessionStatusSnapshot>
  readonly workspaces: SnapshotSource<WorkspaceSnapshot>
}

/** Composed props: shell share + locale seat + injected business face. */
export type ActivityBellProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'activity-bell'>
  & ActivityBellInjected

type Translate = PropsLocale<'activity-bell'>['t']

/** Calendar bucket → section label. */
function dayLabel(bucket: ActivityDayBucket, t: Translate, now: number): string {
  switch (bucket.kind) {
    case 'today':
      return t('day.today')
    case 'yesterday':
      return t('day.yesterday')
    case 'weekday': {
      const weekdays: readonly Parameters<Translate>[0][] = [
        'day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat',
      ]
      return t(weekdays[bucket.weekday] ?? 'day.sun')
    }
    case 'date': {
      const currentYear = new Date(now).getFullYear()
      return bucket.year === currentYear
        ? t('day.date', { month: bucket.month, day: bucket.day })
        : t('day.dateYear', { year: bucket.year, month: bucket.month, day: bucket.day })
    }
  }
}

/** Row status text for assistive tech (the dots are decorative). */
function statusText(row: ActivityRow<SessionId>, t: Translate): string | undefined {
  if (row.unread) return t('row.unread')
  if (row.pending !== undefined) return t('row.attention')
  if (row.running) return t('row.running')
  return undefined
}

/** Row marker: finished-unviewed reuses the shipped green "done" dot. */
function RowMark({ row }: { readonly row: ActivityRow<SessionId> }): ReactElement | null {
  if (row.unread) return <StateDot state="done" size={8} />
  if (row.pending !== undefined) return <StateDot state="warning" size={8} />
  if (row.running) return <StateDot state="ongoing" size={10} />
  return null
}

/** One activity row: title reveal, status mark, folder, and the row actions. */
function ActivityRowItem({
  row, t, onOpen, onTogglePin, onArchive,
}: {
  readonly row: ActivityRow<SessionId>
  readonly t: Translate
  readonly onOpen: (sessionId: SessionId) => void
  readonly onTogglePin: (row: ActivityRow<SessionId>) => void
  readonly onArchive: (row: ActivityRow<SessionId>) => void
}) {
  const title = useRef<HTMLSpanElement>(null)
  const marquee = useTitleMarquee(title)
  const status = statusText(row, t)
  const label = row.title === '' ? t('row.untitled') : row.title
  // The row itself is the open affordance, so it cannot be a <button>: the
  // pin/archive controls below are buttons, and nesting them would be invalid
  // markup that browsers resolve unpredictably. A focusable role="button" row
  // keeps the whole-row target, the keyboard path, and the inner controls.
  return (
    <div
      className={row.current ? 'ab-row ab-row-current' : 'ab-row'}
      role="button"
      tabIndex={0}
      title={label}
      onPointerEnter={marquee.enter}
      onPointerLeave={marquee.leave}
      onClick={() => { onOpen(row.id) }}
      onKeyDown={(event) => {
        // Keys pressed on an inner control belong to that control.
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen(row.id)
      }}
    >
      <span className="ab-row-mark" aria-hidden="true"><RowMark row={row} /></span>
      <span className="ab-row-body">
        <span className="ab-row-title" ref={title}>{label}</span>
        {row.folder !== '' && (
          <span className="ab-row-folder">
            <IconFolderOpenOutlineRegular size={12} />
            <span className="ab-row-folder-text">{row.folder}</span>
          </span>
        )}
        {status !== undefined && <span className="ab-sr-only">{status}</span>}
      </span>
      <span className="ab-row-tail">
        {row.pinned && (
          <span className="ab-pin-mark" role="img" aria-label={t('row.pinned')} title={t('row.pinned')}>
            <IconPinFillRegular size={12} />
          </span>
        )}
        {/* The row itself is the open action, so the strip keeps its clicks. */}
        <span className="ab-row-actions">
          <Tooltip label={t(row.pinned ? 'action.unpin' : 'action.pin')} side="bottom" align="end" delayMs={500}>
            <button
              type="button"
              className="ab-icon-button"
              aria-label={t(row.pinned ? 'action.unpin' : 'action.pin')}
              onClick={(event) => {
                event.stopPropagation()
                onTogglePin(row)
              }}
            >
              {row.pinned ? <IconPinFillRegular size={14} /> : <IconPinOutlineRegular size={14} />}
            </button>
          </Tooltip>
          <Tooltip label={t('action.archive')} side="bottom" align="end" delayMs={500}>
            <button
              type="button"
              className="ab-icon-button"
              aria-label={t('action.archive')}
              onClick={(event) => {
                event.stopPropagation()
                onArchive(row)
              }}
            >
              <IconArchiveOutlineRegular size={14} />
            </button>
          </Tooltip>
        </span>
      </span>
    </div>
  )
}

/** Subscribe to one observable snapshot. */
function useSnapshot<T>(source: SnapshotSource<T>): T {
  const subscribe = useCallback((listener: () => void) => source.subscribe(listener), [source])
  const read = useCallback(() => source.getSnapshot(), [source])
  return useSyncExternalStore(subscribe, read, read)
}

/** Re-render once a minute so day buckets and the "today" section stay honest. */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()) }, 60_000)
    return () => { window.clearInterval(timer) }
  }, [])
  return now
}

/**
 * Structural node check. Event targets are nodes in every browser, but the
 * page's `Node` constructor is not a global the module can assume (jsdom keeps
 * it on its window), so the test asks the value instead of the environment.
 */
function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null
    && typeof (value as { nodeType?: unknown }).nodeType === 'number'
}

interface Hosts {
  readonly bell: HTMLElement | null
  readonly panel: HTMLElement | null
}

/**
 * Attach the injected containers to the resolved anchors while the sidebar is
 * wide. Containers are created and destroyed with the anchors, so a shell
 * remount never leaves an orphan node behind.
 *
 * The two seats have different lifetimes on purpose. The bell seat lives as
 * long as the header, which keeps the portalled button mounted (and focused)
 * across an open/close toggle. The panel seat exists only while the activity
 * list is open: the list below stays the plain shell DOM, with nothing of ours
 * on top of it, so a closed view can never intercept a click meant for a
 * Workspace row or a group disclosure.
 */
function useHosts(anchors: SidebarAnchors | undefined, wide: boolean, active: boolean): Hosts {
  const [hosts, setHosts] = useState<Hosts>({ bell: null, panel: null })
  useLayoutEffect(() => {
    if (anchors === undefined || !wide) {
      setHosts(current => (current.bell === null ? current : { bell: null, panel: current.panel }))
      return
    }
    const bell = mountContainer(anchors.header, anchors.actions, 'ab-bell-host')
    setHosts(current => ({ bell, panel: current.panel }))
    return () => {
      bell.remove()
    }
  }, [anchors, wide])
  useLayoutEffect(() => {
    if (anchors === undefined || !wide || !active || anchors.listArea === null) {
      setHosts(current => (current.panel === null ? current : { bell: current.bell, panel: null }))
      return
    }
    const listArea = anchors.listArea
    const restorePosition = ensurePositioned(listArea)
    const panel = mountContainer(listArea, null, 'ab-panel-host')
    applyRowInset(panel, measureRowInset(listArea))
    setHosts(current => ({ bell: current.bell, panel }))
    return () => {
      panel.remove()
      restorePosition()
    }
  }, [anchors, wide, active])
  return hosts
}

/**
 * Render the bell into the sidebar header and, while active, the activity list
 * into the list seat it covers.
 * @param props - shell share, locale seat, and injected business face.
 * @returns the two portals, or null before the sidebar region exists.
 */
export function ActivityBell({
  wide, t, openSession, pinSession, unpinSession, archiveSession, sessions, statuses, workspaces,
}: ActivityBellProps): ReactElement | null {
  const anchors = useSidebarAnchors()
  const list = useSnapshot(sessions)
  const statusMap = useSnapshot(statuses)
  const workspaceSnapshot = useSnapshot(workspaces)
  const now = useMinuteTick()
  const [active, setActive] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<SessionId>>(() => new Set())
  const facts = useRef<ReadonlyMap<SessionId, SessionFacts> | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimer = useRef(0)
  const hosts = useHosts(anchors, wide, active)

  // Every observed running → stopped transition is a completion worth a badge;
  // the framework's own reminder only covers the ones watched from elsewhere.
  useEffect(() => {
    const current = sessionFacts(list, statusMap)
    // Both passes are captured by value: a state updater may run later, by which
    // time the ref would already hold the next pass and the transition would be
    // invisible to this comparison.
    const previous = facts.current
    facts.current = current
    setPending(currentPending => nextPending(currentPending, previous, current))
  }, [list, statusMap])

  const acknowledge = useCallback((sessionId: SessionId): void => {
    setPending((current) => {
      if (!current.has(sessionId)) return current
      const next = new Set(current)
      next.delete(sessionId)
      return next
    })
  }, [])

  const view = useMemo(() => {
    const inputs = {
      sessions: list, statuses: statusMap, workspaces: workspaceSnapshot, completedSince: pending,
    }
    return { groups: buildActivityGroups<SessionId>(inputs, now), unread: countUnread<SessionId>(inputs) }
  }, [list, statusMap, workspaceSnapshot, pending, now])
  const { groups, unread } = view

  // Collapsing the sidebar unmounts the region the panel covers: leave the
  // activity view rather than keeping a flag nobody can see or clear.
  useEffect(() => {
    if (!wide) setActive(false)
  }, [wide])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setActive(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [active])

  // The activity list covers the browsing region, so any press on the sidebar's
  // own chrome — this plugin's row actions aside — hands the region back: a
  // neighbouring plugin's region tabs (tasks, schedules, …), the search field,
  // or the view-options menu must never be left sitting under a panel nobody
  // asked to keep. Presses outside the sidebar (the conversation) deliberately
  // keep the list open, so several finished Sessions can be opened in a row.
  useEffect(() => {
    if (!active) return
    const bellHost = hosts.bell
    const panelHost = hosts.panel
    const header = anchors?.header
    if (header === undefined) return
    const sidebar = header.closest('[class*="regionArea"]')?.parentElement ?? header.parentElement
    if (sidebar === null) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!isNode(target)) return
      if (panelHost?.contains(target) === true) return
      if (bellHost?.contains(target) === true) return
      if (!sidebar.contains(target)) return
      setActive(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => { document.removeEventListener('pointerdown', onPointerDown, true) }
  }, [active, anchors, hosts.bell, hosts.panel])

  useEffect(() => () => { window.clearTimeout(noticeTimer.current) }, [])

  const showNotice = useCallback((message: string): void => {
    window.clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = window.setTimeout(() => { setNotice(null) }, 4000)
  }, [])

  const togglePin = useCallback((row: ActivityRow<SessionId>): void => {
    const call = row.pinned ? unpinSession : pinSession
    call(row.id).catch(() => {})
  }, [pinSession, unpinSession])

  const archive = useCallback((row: ActivityRow<SessionId>): void => {
    archiveSession(row.id).catch(() => { showNotice(t('action.archiveFailed')) })
  }, [archiveSession, showNotice, t])

  // While the panel covers the list, take the covered rows out of the tab
  // order and the accessibility tree; the attribute is restored on close.
  const listArea = anchors?.listArea ?? null
  const panelHost = hosts.panel
  useLayoutEffect(() => {
    if (!active || listArea === null || panelHost === null) return
    const covered = [...listArea.children]
      .filter(child => child !== panelHost)
      .map(child => child as HTMLElement)
    for (const element of covered) element.inert = true
    return () => {
      for (const element of covered) element.inert = false
    }
  }, [active, listArea, panelHost])

  if (hosts.bell === null) return null

  const label = unread > 0 && !active ? t('bell.showUnread', { count: unread }) : active ? t('bell.hide') : t('bell.show')
  const bell = (
    <Tooltip label={active ? t('bell.hide') : t('bell.show')} side="bottom" delayMs={400} align="end">
      <button
        type="button"
        className={active ? 'ab-bell ab-bell-active' : 'ab-bell'}
        aria-label={label}
        aria-pressed={active}
        onClick={() => { setActive(value => !value) }}
      >
        <BellIcon size={16} />
        {unread > 0 && (
          <span className="ab-badge" aria-hidden="true">{unread > 99 ? '99+' : String(unread)}</span>
        )}
      </button>
    </Tooltip>
  )

  const panel = (
    <div className="ab-panel" role="region" aria-label={t('panel.aria')}>
      {notice !== null && <div className="ab-panel-notice" role="status">{notice}</div>}
      <div className="ab-panel-scroll">
        {groups.length === 0
          ? <div className="ab-empty">{t('panel.empty')}</div>
          : groups.map(group => (
            <section key={group.key} className="ab-group">
              <div className="ab-group-label">{dayLabel(group.bucket, t, now)}</div>
              {group.rows.map(row => (
                <ActivityRowItem
                  key={row.id}
                  row={row}
                  t={t}
                  onOpen={(sessionId) => { acknowledge(sessionId); openSession(sessionId) }}
                  onTogglePin={togglePin}
                  onArchive={archive}
                />
              ))}
            </section>
          ))}
      </div>
    </div>
  )

  return (
    <>
      {createPortal(bell, hosts.bell)}
      {active && hosts.panel !== null ? createPortal(panel, hosts.panel) : null}
    </>
  )
}
