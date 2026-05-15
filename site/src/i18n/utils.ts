import { ui, type UIKey } from './ui';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../consts';

/**
 * Returns a `t(key, vars?)` function bound to a specific locale. Mirrors
 * the dashboard's `tFn` API so the mental model is portable.
 *
 * - `vars` placeholder syntax is `{name}` — replaced via simple regex.
 * - Falls back to the English string when a Chinese key is missing.
 */
export function useTranslations(locale: Locale) {
  const dict = ui[locale] ?? ui[DEFAULT_LOCALE];
  const fallback = ui[DEFAULT_LOCALE];
  return function t(key: UIKey, vars?: Record<string, string | number>): string {
    const raw = dict[key] ?? fallback[key] ?? key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] === undefined ? `{${k}}` : String(vars[k]),
    );
  };
}

/**
 * Parse the leading locale segment from a pathname. Astro's
 * `Astro.currentLocale` already does this, but pages that need to
 * compute paths without an Astro context (e.g. middleware-style logic)
 * can use this directly.
 */
export function localeFromPath(pathname: string): Locale {
  const seg = pathname.split('/').filter(Boolean)[0];
  return (LOCALES as readonly string[]).includes(seg) ? (seg as Locale) : DEFAULT_LOCALE;
}

/**
 * Swap the locale segment of `pathname` to `target`. Used by `<LangSwitch>`
 * so clicking "中文" on `/en/cli/` lands on `/zh/cli/` instead of dumping
 * the user back at `/zh/`.
 *
 * Examples:
 *   switchLocaleUrl('/en/cli/', 'zh')  → '/zh/cli/'
 *   switchLocaleUrl('/zh/', 'en')      → '/en/'
 *   switchLocaleUrl('/', 'zh')         → '/zh/'
 */
export function switchLocaleUrl(pathname: string, target: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  const [first, ...rest] = parts;
  if ((LOCALES as readonly string[]).includes(first)) {
    return '/' + [target, ...rest].join('/') + '/';
  }
  return '/' + [target, ...parts].join('/') + '/';
}

/** Build an in-locale link, e.g. localePath('en', '/cli/') → '/en/cli/'. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
  return clean ? `/${locale}/${clean}/` : `/${locale}/`;
}
