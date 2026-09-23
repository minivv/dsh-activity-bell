import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import {
  ensurePositioned, findSidebarHeader, mountContainer, refreshSidebarAnchors,
  resolveSidebarAnchors, sameSidebarAnchors,
} from '../.test-build/client/anchors.js'

// Class names mirror the emitted CSS-module shape (`hash_localName`) so the
// substring selectors are exercised against the real attribute values.
const HASH = 'bhn1Oq'

function sidebarDocument({ withSearch = true, withActions = true, withListArea = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>')
  const { document } = dom.window
  const root = document.createElement('div')
  root.className = `${HASH}_root`
  const header = document.createElement('div')
  header.className = `${HASH}_sectionHeader`
  const label = document.createElement('span')
  label.className = `${HASH}_sectionLabel`
  label.textContent = 'Workspaces'
  header.appendChild(label)
  if (withSearch) {
    const searchSlot = document.createElement('div')
    searchSlot.className = `${HASH}_searchSlot`
    const button = document.createElement('button')
    button.setAttribute('aria-expanded', 'false')
    searchSlot.appendChild(button)
    header.appendChild(searchSlot)
  }
  let actions = null
  if (withActions) {
    actions = document.createElement('div')
    actions.className = `${HASH}_headerActions`
    header.appendChild(actions)
  }
  root.appendChild(header)
  let listArea = null
  if (withListArea) {
    listArea = document.createElement('div')
    listArea.className = `${HASH}_listArea`
    const body = document.createElement('div')
    body.className = `${HASH}_treeBody`
    listArea.appendChild(body)
    root.appendChild(listArea)
  }
  document.body.appendChild(root)
  return { dom, document, header, actions, listArea }
}

test('findSidebarHeader requires the search control', () => {
  const { dom, document, header } = sidebarDocument()
  assert.equal(findSidebarHeader(document), header)

  const decoy = document.createElement('div')
  decoy.className = `${HASH}_sectionHeader`
  document.body.appendChild(decoy)
  assert.equal(findSidebarHeader(document), header, 'a section header without a search control is not the browser header')
  dom.window.close()
})

test('findSidebarHeader ignores an unrelated section header', () => {
  const { dom, document } = sidebarDocument({ withSearch: false })
  assert.equal(findSidebarHeader(document), undefined)
  dom.window.close()
})

test('resolveSidebarAnchors collects the header, action cluster, and list seat', () => {
  const { dom, document, header, actions, listArea } = sidebarDocument()
  const anchors = resolveSidebarAnchors(document)
  assert.deepEqual(anchors, { header, actions, listArea })
  dom.window.close()
})

test('mountContainer inserts before the action cluster without touching shell nodes', () => {
  const { dom, document, header, actions } = sidebarDocument()
  const anchors = resolveSidebarAnchors(document)
  const container = mountContainer(anchors.header, anchors.actions, 'ab-bell-host')
  assert.equal(container.className, 'ab-bell-host')
  assert.equal(container.dataset.activityBellHost, 'ab-bell-host')
  assert.equal(container.previousElementSibling.className, `${HASH}_searchSlot`)
  assert.equal(container.nextElementSibling, actions)
  assert.equal(header.children.length, 4)
  container.remove()
  assert.equal(header.children.length, 3)
  assert.equal(header.querySelector('[class*="searchSlot"]') !== null, true)
  dom.window.close()
})

test('mountContainer appends when the region has no action cluster yet', () => {
  const { dom, document, header } = sidebarDocument({ withActions: false })
  const anchors = resolveSidebarAnchors(document)
  assert.equal(anchors.actions, null)
  const container = mountContainer(anchors.header, anchors.actions, 'ab-bell-host')
  assert.equal(container.parentElement, header)
  assert.equal(container.nextElementSibling, null)
  dom.window.close()
})

test('refreshSidebarAnchors follows a late-arriving action cluster and drops detached headers', () => {
  const { dom, document, header, actions } = sidebarDocument({ withActions: false })
  const initial = resolveSidebarAnchors(document)
  assert.equal(initial.actions, null)
  const late = document.createElement('div')
  late.className = `${HASH}_headerActions`
  header.appendChild(late)
  const refreshed = refreshSidebarAnchors(initial)
  assert.equal(refreshed.actions, late)
  assert.equal(sameSidebarAnchors(initial, refreshed), false)

  header.remove()
  assert.equal(refreshSidebarAnchors(refreshed), undefined)
  assert.equal(sameSidebarAnchors(refreshed, undefined), false)
  assert.equal(sameSidebarAnchors(undefined, undefined), true)
  assert.equal(actions === null, true)
  dom.window.close()
})

test('ensurePositioned makes the list seat a positioning context and restores it', () => {
  const { dom, listArea } = sidebarDocument()
  listArea.style.position = ''
  const restore = ensurePositioned(listArea)
  assert.equal(listArea.style.position, 'relative')
  restore()
  assert.equal(listArea.style.position, '')

  listArea.style.position = 'absolute'
  const keep = ensurePositioned(listArea)
  assert.equal(listArea.style.position, 'absolute')
  keep()
  assert.equal(listArea.style.position, 'absolute')
  dom.window.close()
})
