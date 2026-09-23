/**
 * Client-lane test: mount the plugin's real client half against minimal fake
 * services (the session list, the Session UI status snapshot, and the
 * Workspace registry are plain objects), with the real sidebar anchor logic
 * and the real activity projection behind it.
 */
import assert from 'node:assert/strict'
import test, { after } from 'node:test'

// The DOM must exist before react-dom and the component are imported.
const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.Node = window.Node
// `navigator` is a getter-only global on modern node; redefine it for React DOM.
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.MutationObserver = window.MutationObserver
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Primitives the shell's own browser tests stub the same way: neither observer
// exists in jsdom and neither is load-bearing for these assertions.
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { apply } = await import('../.test-build/client/index.js')
const { zh } = await import('../.test-build/client/locales.js')
const { buildSidebar } = await import('./sidebar-fixture.mjs')

// jsdom's visual mode owns a requestAnimationFrame loop; closing the window
// after the lane releases the event loop so the runner can exit.
after(() => { dom.window.close() })

/** Local-date instant, so the day buckets are deterministic in any timezone. */
function localAt(daysAgo, hour, minute = 0) {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour, minute).getTime()
}

const SESSIONS = [
  { id: 's1', displayTitle: '生成软著申请资料', blank: false, running: false, updatedAt: localAt(0, 9) },
  { id: 's2', displayTitle: '排查漏损计算时间因子错误', blank: false, running: false, updatedAt: localAt(1, 9) },
  { id: 's3', displayTitle: '对比新旧分区库结构差异', blank: false, running: true, updatedAt: localAt(0, 12) },
  { id: 's4', displayTitle: '', blank: true, running: false, updatedAt: localAt(0, 13) },
  { id: 's5', displayTitle: '子代理会话', blank: false, origin: 'subagent', running: false, updatedAt: localAt(0, 8) },
  { id: 's6', displayTitle: '已完成未查看但已归档', blank: false, running: false, updatedAt: localAt(0, 7), cwd: '/host/projects/zone-meter' },
]

const STATUSES = new Map([
  ['s1', { running: false, completionUnread: true }],
  ['s2', { running: false, completionUnread: true }],
  ['s3', { running: true, completionUnread: false }],
  ['s6', { running: false, completionUnread: true }],
])

const WORKSPACES = {
  items: [
    { workspaceId: 'w1', title: 'game', path: '/host/game', sessionIds: ['s1'] },
    { workspaceId: 'w2', title: 'iot-platform', path: '/host/iot-platform', sessionIds: ['s2'] },
    { workspaceId: 'w3', title: 'test', path: '/host/test', sessionIds: ['s3'] },
    { workspaceId: 'w4', title: 'archived-ws', path: '/host/archived', sessionIds: ['s6'] },
  ],
  archivedSessionIds: ['s6'],
}

/** Observable snapshot double with the DSH shape. */
function source(value) {
  return { getSnapshot: () => value, subscribe: () => () => {} }
}

/** Observable double the test can push updates through. */
function mutableSource(initial) {
  let value = initial
  const listeners = new Set()
  return {
    source: {
      getSnapshot: () => value,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    set(next) {
      value = next
      for (const listener of [...listeners]) listener()
    },
  }
}

/** Minimal client context double that records what `apply` registers. */
function fakeContext(values = {}) {
  const disposers = []
  const opened = []
  let captured
  const sessions = values.sessions ?? source({
    ids: SESSIONS.map(row => row.id),
    byId: Object.fromEntries(SESSIONS.map(row => [row.id, row])),
    phase: 'ready',
  })
  const statuses = values.statuses ?? source(STATUSES)
  const workspaces = values.workspaces ?? source(WORKSPACES)
  const ctx = {
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    locale: { register: () => () => {} },
    slots: {
      inject(_name, factory) { return factory() },
      register(options, component) {
        captured = { options, component }
        return () => { captured = undefined }
      },
    },
    get(name) {
      return name === 'sessions' ? { list: sessions } : { list: workspaces }
    },
    uiSession: { sessionStatus: statuses },
    uiWorkspace: {
      openSession: (sessionId) => { opened.push(['open', sessionId]) },
      pinSession: (sessionId) => { opened.push(['pin', sessionId]); return Promise.resolve() },
      unpinSession: (sessionId) => { opened.push(['unpin', sessionId]); return Promise.resolve() },
      // The host refuses a plain archive while work still runs; the panel shows
      // its notice instead of pretending the row left the list.
      archiveSession: (sessionId) => { opened.push(['archive', sessionId]); return Promise.reject(new Error('busy')) },
    },
  }
  return {
    ctx,
    disposers,
    opened,
    get captured() { return captured },
  }
}

/** Bind the plugin's own Chinese dictionary, so a missing key fails the test. */
function translate(key, params) {
  const template = zh[key]
  assert.ok(template !== undefined, `missing locale key: ${key}`)
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name]))
}

/** Render one tree and return the handle plus a click helper. */
async function mount(element) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await React.act(async () => { root.render(element) })
  return {
    container,
    async render(next) {
      await React.act(async () => { root.render(next) })
    },
    async click(node) {
      await React.act(async () => {
        node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    },
    async press(node) {
      await React.act(async () => {
        node.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      })
    },
    async unmount() {
      await React.act(async () => { root.unmount() })
      container.remove()
    },
  }
}

test('the client half registers one sidebar foot action and injects the framework sources', () => {
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  assert.equal(captured().options.name, 'sidebar.footer.action')
  assert.equal(captured().options.id, 'activity-bell')
  assert.equal(captured().options.locale, 'activity-bell')
  const injected = captured().options.inject()
  assert.deepEqual(Object.keys(injected).sort(), [
    'archiveSession', 'openSession', 'pinSession', 'sessions', 'statuses', 'unpinSession', 'workspaces',
  ])
  assert.equal(document.querySelector('style[data-plugin="dsh-activity-bell"]') !== null, true)
  for (const dispose of [...disposers].reverse()) dispose()
  assert.equal(document.querySelector('style[data-plugin="dsh-activity-bell"]'), null)
})

test('the bell renders beside the search control with the unread badge', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  const bell = document.querySelector('.ab-bell')
  assert.ok(bell, 'the bell mounts into the sidebar header')
  assert.equal(bell.parentElement.parentElement, shell.header)
  assert.equal(bell.parentElement.previousElementSibling, shell.searchSlot, 'the bell sits beside the search control')
  assert.equal(bell.parentElement.nextElementSibling, shell.actions)
  assert.equal(bell.getAttribute('aria-pressed'), 'false')
  assert.equal(bell.getAttribute('aria-label'), '查看活动，2 个会话已完成未查看')
  assert.equal(document.querySelector('.ab-badge').textContent, '2')
  assert.equal(document.querySelector('.ab-panel'), null)

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
  assert.equal(document.querySelector('.ab-bell'), null)
  assert.equal(document.querySelector('.ab-bell-host'), null)
  assert.equal(document.querySelector('style[data-plugin="dsh-activity-bell"]'), null)
  assert.equal(shell.header.children.length, 3, 'the shell keeps only its own children')
})

test('clicking the bell swaps in the day-grouped activity list and back', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, opened, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  await view.click(document.querySelector('.ab-bell'))
  const panel = document.querySelector('.ab-panel')
  assert.ok(panel, 'the panel replaces the workspace list')
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-pressed'), 'true')
  assert.equal(document.querySelector('.ab-bell').className, 'ab-bell ab-bell-active')
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-label'), '返回工作区列表')
  assert.equal(panel.parentElement.parentElement, shell.listArea, 'the panel covers the list seat')
  assert.equal(shell.list.inert, true, 'the covered rows leave the tab order')

  assert.deepEqual(
    [...panel.querySelectorAll('.ab-group-label')].map(node => node.textContent),
    ['今天', '昨天'],
  )
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row')].map(node => node.querySelector('.ab-row-title').textContent),
    ['对比新旧分区库结构差异', '生成软著申请资料', '排查漏损计算时间因子错误'],
  )
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row-folder-text')].map(node => node.textContent),
    ['test', 'game', 'iot-platform'],
  )
  // Rows carry their status for assistive tech: finished-unviewed first.
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row')].map(node => node.querySelector('.ab-sr-only')?.textContent ?? null),
    ['运行中', '已完成未查看', '已完成未查看'],
  )
  // The finished-unviewed rows render the shipped green "done" dot; running
  // rows render the ongoing loader dot.
  assert.deepEqual(
    [...panel.querySelectorAll('.ab-row [data-state-dot]')].map(node => node.getAttribute('data-state-dot')),
    ['ongoing', 'done', 'done'],
  )
  // The panel is the list and nothing else: no added heading, no extra
  // affordance above the day sections.
  assert.equal(panel.querySelector('.ab-panel-head'), null)
  assert.equal(panel.textContent.startsWith('今天'), true, 'the first day section leads the panel')
  assert.equal(panel.textContent.includes('最近活动'), false, 'no added title copy')
  assert.equal(panel.textContent.includes('全部已读'), false)
  assert.doesNotMatch(panel.textContent, /子代理会话/, 'subagent rows stay hidden')
  assert.doesNotMatch(panel.textContent, /已完成未查看但已归档/, 'archived rows stay hidden')

  // Every row keeps the shipped row affordances: pin and archive, revealed on
  // hover/focus, acting without opening the session.
  const firstRow = panel.querySelector('.ab-row')
  assert.deepEqual(
    [...firstRow.querySelectorAll('.ab-icon-button')].map(node => node.getAttribute('aria-label')),
    ['置顶', '归档'],
  )
  await view.click(firstRow.querySelector('.ab-icon-button'))
  assert.deepEqual(opened, [['pin', 's3']], 'the pin affordance does not open the session')
  await view.click(firstRow.querySelectorAll('.ab-icon-button')[1])
  assert.deepEqual(opened, [['pin', 's3'], ['archive', 's3']])
  assert.equal(
    panel.querySelector('.ab-panel-notice').textContent,
    '归档失败：该会话还有运行中的工作',
    'a refused archive says so instead of dropping the row',
  )

  await view.click(panel.querySelector('.ab-row'))
  assert.deepEqual(opened, [['pin', 's3'], ['archive', 's3'], ['open', 's3']], 'a row opens its session')
  assert.equal(document.querySelector('.ab-badge').textContent, '2', 'opening does not touch other rows')

  await view.click(document.querySelector('.ab-bell'))
  assert.equal(document.querySelector('.ab-panel'), null)
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-pressed'), 'false')
  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '查看活动，2 个会话已完成未查看',
    'the closed bell falls back to the unread label',
  )
  assert.equal(shell.list.inert, false, 'the restored rows rejoin the tab order')
  assert.equal(
    document.querySelector('.ab-panel-host'),
    null,
    'a closed activity list leaves no hit target over the workspace list',
  )

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
  assert.equal(document.body.textContent.includes('最近活动'), false)
})

test('Escape closes the activity list', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  await view.click(document.querySelector('.ab-bell'))
  assert.ok(document.querySelector('.ab-panel'))
  await React.act(async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  assert.equal(document.querySelector('.ab-panel'), null)
  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('a press on neighbouring sidebar chrome hands the region back', async () => {
  document.body.innerHTML = ''
  const shell = buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))

  await view.click(document.querySelector('.ab-bell'))
  assert.ok(document.querySelector('.ab-panel'))
  // A neighbouring plugin's tab must not end up under the activity list.
  await view.press(shell.tab)
  assert.equal(document.querySelector('.ab-panel'), null, 'the region goes back to the other surface')
  assert.equal(document.querySelector('.ab-bell').getAttribute('aria-pressed'), 'false')

  // Pressing the activity surface itself keeps it open, and so does a press in
  // the conversation column (outside the sidebar).
  await view.click(document.querySelector('.ab-bell'))
  const row = document.querySelector('.ab-row')
  await view.press(row)
  assert.ok(document.querySelector('.ab-panel'), 'the list survives its own presses')
  await view.press(document.body)
  assert.ok(document.querySelector('.ab-panel'), 'the conversation column does not close the list')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('a turn seen finishing raises the badge until its Session is opened', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const statuses = mutableSource(new Map())
  const one = [{
    id: 's1',
    displayTitle: '跑任务的会话',
    blank: false,
    running: false,
    updatedAt: Date.now(),
    retainedBy: { mainView: 1 },
  }]
  const handle = fakeContext({
    statuses: statuses.source,
    sessions: source({
      ids: one.map(row => row.id),
      byId: Object.fromEntries(one.map(row => [row.id, row])),
      phase: 'ready',
    }),
    workspaces: source({ items: [], archivedSessionIds: [] }),
  })
  const { ctx, disposers, opened } = handle
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  assert.equal(document.querySelector('.ab-badge'), null)

  const running = new Map([['s1', { running: true, completionUnread: false }]])
  await React.act(async () => { statuses.set(running) })
  assert.equal(document.querySelector('.ab-badge'), null, 'a running turn is not a completion')

  const stopped = new Map([['s1', { running: false, completionUnread: false }]])
  await React.act(async () => { statuses.set(stopped) })
  assert.equal(document.querySelector('.ab-badge').textContent, '1')
  assert.equal(
    document.querySelector('.ab-bell').getAttribute('aria-label'),
    '查看活动，1 个会话已完成未查看',
  )

  await view.click(document.querySelector('.ab-bell'))
  const row = document.querySelector('.ab-row')
  assert.equal(
    row.className,
    'ab-row ab-row-current',
    'the open Session carries the shipped selected fill',
  )
  assert.deepEqual(
    [...row.querySelectorAll('[data-state-dot]')].map(node => node.getAttribute('data-state-dot')),
    ['done'],
  )
  await view.click(row)
  assert.deepEqual(opened, [['open', 's1']])
  assert.equal(document.querySelector('.ab-badge'), null, 'opening the Session acknowledges it')

  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})

test('the collapsed sidebar drops the bell and closes the activity list', async () => {
  document.body.innerHTML = ''
  buildSidebar(document)
  const handle = fakeContext()
  const { ctx, disposers } = handle;
  const captured = () => handle.captured
  apply(ctx)
  const injected = captured().options.inject()
  const element = (wide) => React.createElement(captured().component, { wide, t: translate, ...injected })
  const view = await mount(React.createElement(captured().component, {
    wide: true, t: translate, ...injected,
  }))
  await view.click(document.querySelector('.ab-bell'))
  assert.ok(document.querySelector('.ab-panel'))

  await view.render(element(false))
  assert.equal(document.querySelector('.ab-bell'), null)
  assert.equal(document.querySelector('.ab-panel'), null)

  await view.render(element(true))
  assert.ok(document.querySelector('.ab-bell'), 'the bell returns on expand')
  assert.equal(document.querySelector('.ab-panel'), null, 'the activity list does not reopen by itself')
  await view.unmount()
  for (const dispose of [...disposers].reverse()) dispose()
})
