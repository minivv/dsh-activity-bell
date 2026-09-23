import assert from 'node:assert/strict'
import test from 'node:test'
import { placeTitle, restTitle } from '../.test-build/client/marquee.js'

/** Minimal element double: the helpers only touch these four members. */
function fakeTitle({ scrollWidth = 200, clientWidth = 100, scrollTo = false } = {}) {
  const calls = []
  const element = {
    scrollWidth,
    clientWidth,
    scrollLeft: 0,
    dataset: {},
    calls,
  }
  if (scrollTo) {
    element.scrollTo = (options) => { calls.push(options) }
  }
  return element
}

test('placeTitle publishes the fade-mask state while the title travels', () => {
  const title = fakeTitle()
  placeTitle(title, 0, 100)
  assert.equal(title.scrollLeft, 0)
  assert.equal('scrolled' in title.dataset, false)
  assert.equal(title.dataset.clipped, '', 'text still remains beyond the cell')

  placeTitle(title, 40, 100)
  assert.equal(title.scrollLeft, 40)
  assert.equal(title.dataset.scrolled, '')
  assert.equal(title.dataset.clipped, '')

  placeTitle(title, 100, 100)
  assert.equal(title.scrollLeft, 100)
  assert.equal(title.dataset.scrolled, '', 'the far edge keeps the leading fade')
  assert.equal('clipped' in title.dataset, false, 'nothing is left to clip')
})

test('placeTitle prefers scrollTo when the environment has it', () => {
  const title = fakeTitle({ scrollTo: true })
  placeTitle(title, 12, 100)
  assert.deepEqual(title.calls, [{ left: 12, behavior: 'instant' }])
  assert.equal(title.scrollLeft, 0, 'the offset is left to the element itself')
})

test('restTitle returns the title and clears both masks', () => {
  const title = fakeTitle()
  placeTitle(title, 40, 100)
  restTitle(title)
  assert.equal(title.scrollLeft, 0)
  assert.equal('scrolled' in title.dataset, false)
  assert.equal('clipped' in title.dataset, false)
})
