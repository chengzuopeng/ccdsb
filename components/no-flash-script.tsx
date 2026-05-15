import {
  USAGE_OVERVIEW_HIDDEN_KEY,
  USAGE_OVERVIEW_DATA_ATTR,
  USAGE_OVERVIEW_HIDDEN_VALUE,
} from '@/lib/storage-keys';

/**
 * Inline script that runs before React hydration. It reads the theme from
 * localStorage (or cookie as fallback) and applies the matching class on
 * <html> so the page paints with the correct colors immediately and there
 * is no light/dark flash. Also restores the usage page's "overview hidden"
 * collapse state from localStorage so collapsed users don't see a flash.
 *
 * Any storage key referenced here MUST come from `lib/storage-keys.ts` so
 * the React side can't rename it out from under us.
 */
export function NoFlashScript() {
  const overviewKey = JSON.stringify(USAGE_OVERVIEW_HIDDEN_KEY);
  const overviewAttr = JSON.stringify(USAGE_OVERVIEW_DATA_ATTR);
  const overviewHiddenValue = JSON.stringify(USAGE_OVERVIEW_HIDDEN_VALUE);
  const code = `
(function(){
  try {
    var t = null;
    try { t = localStorage.getItem('ccgauge.theme'); } catch (_) {}
    if (!t) {
      var m = document.cookie.match(/(?:^|; )ccgauge_theme=([^;]+)/);
      if (m) t = decodeURIComponent(m[1]);
    }
    if (t !== 'light' && t !== 'dark' && t !== 'system') t = 'dark';
    var resolved = t;
    if (t === 'system') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    var root = document.documentElement;
    root.classList.remove('theme-light','theme-dark');
    root.classList.add(resolved === 'light' ? 'theme-light' : 'theme-dark');
    root.setAttribute('data-theme', resolved);
  } catch (e) {}
  try {
    var hidden = null;
    try { hidden = localStorage.getItem(${overviewKey}); } catch (_) {}
    if (hidden === '1') document.documentElement.setAttribute(${overviewAttr}, ${overviewHiddenValue});
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
