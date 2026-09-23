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
import { type RefObject } from 'react';
/**
 * Place a clipping title at a scroll offset and publish the fade-mask state.
 *
 * @param title - the clipping title element.
 * @param left - scroll offset to apply.
 * @param range - full travel (`scrollWidth - clientWidth`).
 */
export declare function placeTitle(title: HTMLElement, left: number, range: number): void;
/**
 * Return a clipping title to rest: offset zero and both fades off.
 * @param title - the clipping title element.
 */
export declare function restTitle(title: HTMLElement): void;
/** Rows re-enter the marquee from the start; callers use it above the rest state. */
export interface TitleMarquee {
    readonly enter: () => void;
    readonly leave: () => void;
}
/**
 * Build the pointer-enter/leave pair for one row's clipping title.
 *
 * @param title - ref to the row's clipping title element.
 * @returns stable handlers for the row.
 */
export declare function useTitleMarquee(title: RefObject<HTMLElement | null>): TitleMarquee;
