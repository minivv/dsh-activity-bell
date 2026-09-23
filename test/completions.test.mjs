import assert from 'node:assert/strict'
import test from 'node:test'
import { nextPending, sessionFacts } from '../.test-build/client/completions.js'

const ID = 'session-1'

/** One observation pass over a list holding a single Session. */
function pass({ running, mainView = false }) {
  return sessionFacts(
    { ids: [ID], byId: { [ID]: { id: ID, retainedBy: { mainView: mainView ? 1 : 0 }, running } } },
    new Map([[ID, { running, completionUnread: false }]]),
  )
}

test('a running to stopped transition is recorded as a completion', () => {
  const first = pass({ running: true })
  const pending = nextPending(new Set(), undefined, first)
  assert.deepEqual([...pending], [], 'the first pass only establishes the baseline')
  const stopped = pass({ running: false })
  assert.deepEqual([...nextPending(pending, first, stopped)], [ID])
})

test('re-entering the Session after it stopped acknowledges the completion', () => {
  const running = pass({ running: true })
  const stopped = pass({ running: false })
  const pending = nextPending(nextPending(new Set(), undefined, running), running, stopped)
  assert.deepEqual([...pending], [ID])
  const reopened = pass({ running: false, mainView: true })
  assert.deepEqual([...nextPending(pending, stopped, reopened)], [])
})

test('a Session that runs again clears its own completion, and absent Sessions are dropped', () => {
  const running = pass({ running: true })
  const stopped = pass({ running: false })
  const pending = nextPending(nextPending(new Set(), undefined, running), running, stopped)
  assert.deepEqual([...nextPending(pending, stopped, running)], [], 'a new turn replaces the reminder')
  const empty = sessionFacts({ ids: [], byId: {} }, new Map())
  assert.deepEqual([...nextPending(pending, stopped, empty)], [])
})

test('an unchanged pass keeps the pending set identity', () => {
  const running = pass({ running: true })
  const pending = nextPending(new Set(), undefined, running)
  assert.equal(nextPending(pending, running, pass({ running: true })), pending)
})
