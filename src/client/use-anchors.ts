/**
 * React binding for the sidebar anchors: resolve once, then keep the value
 * fresh through a mutation observer so the bell survives shell remounts and
 * follows late-arriving siblings (the add-workspace button appears only after
 * a directory-flow occupant loads).
 *
 * @module dsh-activity-bell/client/use-anchors
 */
import { useEffect, useState } from 'react'
import {
  refreshSidebarAnchors, resolveSidebarAnchors, sameSidebarAnchors, type SidebarAnchors,
} from './anchors.js'

/**
 * Track the sidebar browsing region's anchors.
 *
 * The observer callback only schedules a frame; the frame work is O(1) once
 * the header is known (one `querySelector` pair inside that header), so a storm
 * of shell mutations cannot turn into a re-render loop.
 *
 * @returns current anchors, or undefined while the region is unmounted.
 */
export function useSidebarAnchors(): SidebarAnchors | undefined {
  const [anchors, setAnchors] = useState<SidebarAnchors | undefined>(
    () => resolveSidebarAnchors(document),
  )
  useEffect(() => {
    let frame = 0
    const sync = (): void => {
      frame = 0
      setAnchors((previous) => {
        if (previous !== undefined) {
          const refreshed = refreshSidebarAnchors(previous)
          if (sameSidebarAnchors(previous, refreshed)) return previous
          return refreshed
        }
        const next = resolveSidebarAnchors(document)
        return sameSidebarAnchors(previous, next) ? previous : next
      })
    }
    const schedule = (): void => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    sync()
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])
  return anchors
}
