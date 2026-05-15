export const THEME_COOKIE = 'ccgauge_theme';
export type Theme = 'light' | 'dark' | 'system';
// Default for first-time visitors (no cookie, no localStorage). Returning
// users keep whatever they explicitly chose, including 'system'.
export const DEFAULT_THEME: Theme = 'dark';
