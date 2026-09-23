/**
 * `activity-bell` dictionaries. Simplified Chinese is the source of truth for
 * the key set; English mirrors it one-to-one.
 *
 * @module dsh-activity-bell/client/locales
 */
/** Simplified Chinese dictionary. */
export declare const zh: {
    'bell.show': string;
    'bell.hide': string;
    'bell.showUnread': string;
    'panel.aria': string;
    'panel.empty': string;
    'row.untitled': string;
    'row.unread': string;
    'row.running': string;
    'row.attention': string;
    'row.pinned': string;
    'action.pin': string;
    'action.unpin': string;
    'action.archive': string;
    'action.archiveFailed': string;
    'day.today': string;
    'day.yesterday': string;
    'day.sun': string;
    'day.mon': string;
    'day.tue': string;
    'day.wed': string;
    'day.thu': string;
    'day.fri': string;
    'day.sat': string;
    'day.date': string;
    'day.dateYear': string;
};
/** Every key this namespace owns. */
export type ActivityBellKey = keyof typeof zh;
/** English dictionary; the key set is fixed by the Chinese source of truth. */
export declare const en: Record<ActivityBellKey, string>;
