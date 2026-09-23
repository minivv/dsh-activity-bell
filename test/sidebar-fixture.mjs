/**
 * Fake sidebar shell for the client tests. It mirrors the real nesting the
 * anchors and the outside-press rule rely on: a sidebar column holding the
 * region, and inside the region a neighbouring plugin's tab strip next to the
 * browser root (section header: label, search slot with its control, action
 * cluster; list seat). Class names use the emitted `hash_localName` shape.
 */

const HASH = 'bhn1Oq'
const SHELL_HASH = 'hHd-Xa'

/**
 * Build the browsing region inside a caller-supplied document.
 * @param document - jsdom document to populate.
 * @returns the shell elements the tests assert against.
 */
export function buildSidebar(document) {
  const column = document.createElement('div')
  column.className = `${SHELL_HASH}_root`
  const region = document.createElement('div')
  region.className = `${SHELL_HASH}_regionArea`
  // Another plugin's region tabs, the way dsh-automation mounts its own strip.
  const tabs = document.createElement('div')
  tabs.className = 'dsh-st-shell-tabs'
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.textContent = '任务'
  tabs.appendChild(tab)
  const root = document.createElement('div')
  root.className = `${HASH}_root`
  const header = document.createElement('div')
  header.className = `${HASH}_sectionHeader`
  const label = document.createElement('span')
  label.className = `${HASH}_sectionLabel`
  label.textContent = '工作区'
  const searchSlot = document.createElement('div')
  searchSlot.className = `${HASH}_searchSlot`
  const searchButton = document.createElement('button')
  searchButton.type = 'button'
  searchButton.setAttribute('aria-expanded', 'false')
  searchSlot.appendChild(searchButton)
  const actions = document.createElement('div')
  actions.className = `${HASH}_headerActions`
  header.append(label, searchSlot, actions)
  const listArea = document.createElement('div')
  listArea.className = `${HASH}_listArea`
  const list = document.createElement('div')
  list.className = `${HASH}_treeBody`
  listArea.appendChild(list)
  root.append(header, listArea)
  region.append(tabs, root)
  column.appendChild(region)
  document.body.appendChild(column)
  return { column, region, tabs, tab, root, header, searchSlot, actions, listArea, list }
}
