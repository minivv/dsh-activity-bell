import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRowInset } from '../.test-build/client/anchors.js'

/** Element double carrying only the inline style surface the helper writes. */
function fakeHost() {
  const properties = new Map()
  return {
    properties,
    style: {
      setProperty: (name, value) => { properties.set(name, value) },
      removeProperty: (name) => { properties.delete(name) },
    },
  }
}

test('applyRowInset publishes the measured trailing inset', () => {
  const host = fakeHost()
  applyRowInset(host, { inlineEnd: 12 })
  assert.equal(host.properties.get('--ab-panel-pad-right'), '12px')
  assert.equal(
    host.properties.size,
    1,
    'the leading edge stays hard against the list seat',
  )
})

test('applyRowInset falls back to the stylesheet default when nothing is measurable', () => {
  const host = fakeHost()
  applyRowInset(host, { inlineEnd: 6 })
  assert.equal(host.properties.get('--ab-panel-pad-right'), '6px')
  applyRowInset(host, undefined)
  assert.equal(host.properties.size, 0, 'an unmeasurable list drops the inline override')
})
