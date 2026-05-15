// Centralised localStorage / dataset keys.
//
// Anything referenced from BOTH the inline no-flash script
// (`components/no-flash-script.tsx`) AND a runtime React component must live
// here, so a rename can't silently drift the two sides apart and reintroduce
// a first-paint flash.

/** localStorage key: '1' when the user collapsed the usage page's overview block. */
export const USAGE_OVERVIEW_HIDDEN_KEY = 'ccgauge.usage.overview.hidden';

/** `<html data-usage-overview="...">` attribute name and its "hidden" value. */
export const USAGE_OVERVIEW_DATA_ATTR = 'data-usage-overview';
export const USAGE_OVERVIEW_HIDDEN_VALUE = 'hidden';
