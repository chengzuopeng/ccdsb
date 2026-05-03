/**
 * Inline script that runs before React hydration. It reads the theme from
 * localStorage (or cookie as fallback) and applies the matching class on
 * <html> so the page paints with the correct colors immediately and there
 * is no light/dark flash.
 */
export function NoFlashScript() {
  const code = `
(function(){
  try {
    var t = null;
    try { t = localStorage.getItem('ccdsb.theme'); } catch (_) {}
    if (!t) {
      var m = document.cookie.match(/(?:^|; )ccdsb_theme=([^;]+)/);
      if (m) t = decodeURIComponent(m[1]);
    }
    if (t !== 'light' && t !== 'dark' && t !== 'system') t = 'system';
    var resolved = t;
    if (t === 'system') {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    var root = document.documentElement;
    root.classList.remove('theme-light','theme-dark');
    root.classList.add(resolved === 'light' ? 'theme-light' : 'theme-dark');
    root.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
