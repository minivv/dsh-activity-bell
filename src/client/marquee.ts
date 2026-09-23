/**
 * Hover reveal for titles wider than their cell.
 *
 * The shipped Session rows crawl an over-long title to its far edge while the
 * pointer rests on the row, hold it there, and snap back on leave, so the
 * activity list keeps that behavior instead of clipping titles the operator
 * cannot read. The clipped element scrolls itself (a real scroll offset, so
 * the ellipsis and the fade masks line up exactly as they do in the shipped
 * rows).
 *
 * @module dsh-activity-bell/client/marquee
 */
import { useEffect, useMemo, useRef, type RefObject } from 'react'

/** Titles clipped by at most this many pixels stay put: the crawl would read as jitter. */
const MIN_TITLE_REVEAL_PX = 8

/** Crawl speed of the reveal, in pixels per millisecond (a slow, readable crawl). */
const TITLE_MARQUEE_PX_PER_MS = 0.028

/**
 * Place a clipping title at a scroll offset and publish the fade-mask state.
 *
 * @param title - the clipping title element.
 * @param left - scroll offset to apply.
 * @param range - full travel (`scrollWidth - clientWidth`).
 */
export function placeTitle(title: HTMLElement, left: number, range: number): void {
  // `instant` keeps a themed `scroll-behavior` from turning the scripted crawl
  // into a second animation; environments without `scrollTo` (jsdom) take the
  // plain assignment, which is instant there anyway.
  if (typeof title.scrollTo === 'function') title.scrollTo({ left, behavior: 'instant' })
  else title.scrollLeft = left
  if (left > 0) title.dataset.scrolled = ''
  else delete title.dataset.scrolled
  if (left < range) title.dataset.clipped = ''
  else delete title.dataset.clipped
}

/**
 * Return a clipping title to rest: offset zero and both fades off.
 * @param title - the clipping title element.
 */
export function restTitle(title: HTMLElement): void {
  if (typeof title.scrollTo === 'function') title.scrollTo({ left: 0, behavior: 'instant' })
  else title.scrollLeft = 0
  delete title.dataset.scrolled
  delete title.dataset.clipped
}

/** Rows re-enter the marquee from the start; callers use it above the rest state. */
export interface TitleMarquee {
  readonly enter: () => void
  readonly leave: () => void
}

/**
 * Build the pointer-enter/leave pair for one row's clipping title.
 *
 * @param title - ref to the row's clipping title element.
 * @returns stable handlers for the row.
 */
export function useTitleMarquee(title: RefObject<HTMLElement | null>): TitleMarquee {
  const frame = useRef(0)
  useEffect(() => () => { cancelAnimationFrame(frame.current) }, [])
  return useMemo(() => ({
    enter: (): void => {
      const element = title.current
      if (element === null) return
      const range = element.scrollWidth - element.clientWidth
      if (range <= MIN_TITLE_REVEAL_PX) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        placeTitle(element, range, range)
        return
      }
      cancelAnimationFrame(frame.current)
      let previous: number | undefined
      let position = 0
      const step = (now: DOMHighResTimeStamp): void => {
        position += previous === undefined ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS
        previous = now
        placeTitle(element, Math.min(position, range), range)
        if (position < range) frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    },
    leave: (): void => {
      cancelAnimationFrame(frame.current)
      const element = title.current
      if (element === null) return
      restTitle(element)
    },
  }), [title])
}
