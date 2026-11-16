'use strict';
// Light / dark switch beside the help button. Scene colours are read when the page starts,
// so switching reloads the page and skips the entrance and the tutorial.
(() => {
  const SUN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  MW.themepick = {
    init() {
      const btn = document.getElementById('btnTheme'), dark = MW.theme === 'dark';
      btn.innerHTML = dark ? SUN : MOON;   // the icon shows the mode you switch to
      btn.dataset.i18nTitle = dark ? 'theme.toLight' : 'theme.toDark';
      btn.title = MW.t(btn.dataset.i18nTitle);
      btn.addEventListener('click', () => {
        try { localStorage.setItem('mw.theme', dark ? 'light' : 'dark'); sessionStorage.setItem('mw.quick', '1'); } catch (e) { return; }
        location.reload();
      });
    },
  };
})();
