import { type SidebarAnchors } from './anchors.js';
/**
 * Track the sidebar browsing region's anchors.
 *
 * The observer callback only schedules a frame; the frame work is O(1) once
 * the header is known (one `querySelector` pair inside that header), so a storm
 * of shell mutations cannot turn into a re-render loop.
 *
 * @returns current anchors, or undefined while the region is unmounted.
 */
export declare function useSidebarAnchors(): SidebarAnchors | undefined;
