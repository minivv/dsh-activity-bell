/**
 * Client half: inject the page styles, register the `activity-bell`
 * dictionaries, and mount the bell through the sidebar foot's action list.
 *
 * The registration is the component's lifecycle and locale carrier (plus the
 * shell's `wide` flag); the visible surfaces are portalled into the browsing
 * region, because the region is a single-occupant slot whose header has no
 * hole beside the search control. See `./ActivityBell` for that rationale.
 *
 * @module dsh-activity-bell/client
 */
import type { Context } from '@deepseek-ai/cordis';
import './types.js';
/** Services required before this plugin mounts. */
export declare const inject: string[];
/**
 * Mount the browser half.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
