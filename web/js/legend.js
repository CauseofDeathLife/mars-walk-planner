'use strict';
// "Convenciones" table: one row per symbol on the map, drawn with the same colours the scene uses.
(() => {
  const C = MW.colors, LIMIT = MW.data.meta.slope_limit_deg;
  const svg = body => `<svg viewBox="0 0 32 18" aria-hidden="true">${body}</svg>`;
  const pin = color => svg(`<line x1="16" y1="17" x2="16" y2="8" stroke="${color}" stroke-width="1.6"/><circle cx="16" cy="6" r="4.2" fill="${color}"/>`);
  const SWATCH = {
    habitat: svg(`<path d="M8 15 A6 6 0 0 1 20 15 Z" fill="${C.habitat}"/><rect x="20" y="10.5" width="9" height="4.5" rx="2.2" fill="${C.habitat}"/>` +
      `<path d="M2 15 A3.2 3.2 0 0 1 8.4 15 Z" fill="${C.habitat}"/><line x1="16" y1="9" x2="16" y2="3" stroke="${C.habitat}" stroke-width="1"/><circle cx="16" cy="2.6" r="1.2" fill="${C.habitat}"/>`),
    target: pin(C.target), isolated: pin(C.isolated), from: pin(C.from), to: pin(C.to),
    route: svg(`<line x1="3" y1="9" x2="29" y2="9" stroke="${C.route}" stroke-width="6" stroke-linecap="round"/>`),
    blocked: svg(`<line x1="3" y1="9" x2="29" y2="9" stroke="${C.blocked}" stroke-width="4" stroke-dasharray="6 4"/>`),
    stops: svg(`<polyline points="2,14 11,7 21,12 30,5" fill="none" stroke="${C.stops}" stroke-width="1.6"/>`),
    frame: svg(`<rect x="6" y="3" width="20" height="12" fill="none" stroke="${C.frame}" stroke-opacity=".6" stroke-width="1.2"/>`),
    walker: {
      astronaut: svg(`<rect x="12.5" y="6" width="7" height="7" rx="1.5" fill="${C.walker}"/><rect x="10" y="6.5" width="2.5" height="5.5" fill="${C.walkerTrim}"/>` +
        `<rect x="13" y="13" width="2.4" height="4.5" fill="${C.walkerTrim}"/><rect x="16.6" y="13" width="2.4" height="4.5" fill="${C.walkerTrim}"/>` +
        `<circle cx="16" cy="3.6" r="3.2" fill="${C.walker}"/><rect x="16" y="2.4" width="3" height="2.2" rx="1" fill="${C.walkerDark}"/>`),
      rover: svg(`<rect x="7" y="7" width="18" height="4" rx="1" fill="${C.walker}"/><line x1="21" y1="7" x2="21" y2="2.5" stroke="${C.walkerTrim}" stroke-width="1.4"/>` +
        `<rect x="19" y="1" width="5" height="2.6" fill="${C.walker}"/>` +
        [9.5, 16, 22.5].map(x => `<circle cx="${x}" cy="14" r="2.8" fill="${C.walkerDark}" stroke="${C.walkerTrim}" stroke-width=".8"/>`).join('')),
      dot: svg(`<circle cx="16" cy="9" r="5" fill="${C.walker}"/>`),
    },
    square: color => svg(`<rect x="6" y="3" width="20" height="12" rx="2" fill="${color}"/>`),
  };

  function rows() {
    const row = (swatch, text) => `<tr><td>${swatch}</td><td>${text}</td></tr>`;
    return row(SWATCH.habitat, MW.t('legend.habitat')) +
      row(SWATCH.target, MW.t('legend.target')) +
      row(SWATCH.isolated, MW.t('legend.isolated')) +
      row(SWATCH.from, MW.t('legend.from')) +
      row(SWATCH.to, MW.t('legend.to')) +
      row(SWATCH.route, MW.t('legend.route', LIMIT)) +
      row(SWATCH.blocked, MW.t('legend.blocked')) +
      row(SWATCH.stops, MW.t('legend.track')) +
      (MW.track.stops().length ? row(SWATCH.walker.rover, MW.t('legend.rover')) : '') +
      row(SWATCH.frame, MW.t('legend.frame')) +
      row(SWATCH.walker[MW.walker.kind()], MW.t('legend.walker')) +
      row(SWATCH.square(MW.terrain.slopeClasses().pop()[1]), MW.t('legend.obstacle', LIMIT));
  }

  MW.legend = {
    init() {
      const render = () => { document.getElementById('conventionsTable').innerHTML = rows(); };
      render();
      MW.on('walkerKind', render);
      MW.on('language', render);   // the walker row shows the figure picked under Capas
    },
  };
})();
