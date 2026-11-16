'use strict';
// Shared namespace: data, state, a tiny event bus and the coordinate transforms.
// Scene axes: x = east (ground metres, cos-latitude corrected), z = south, y = up.
const MW = (() => {
  const data = DATA, ref = data.ref, listeners = {};
  // Single source for every colour shared by the scene, the page CSS and the conventions table
  const ROUTE = '#3aa0ff', SAFE = '#4ade80', DANGER = '#f87171';
  const colors = {
    habitat: '#f4f1ea', target: '#ffb347', isolated: '#9aa3ad', from: SAFE, to: ROUTE, route: ROUTE, blocked: DANGER,
    stops: '#5eead4', frame: '#ffffff', ok: SAFE, warn: '#fbbf24', bad: DANGER,
    walker: '#ffffff', walkerTrim: '#d5dbe2', walkerDark: '#1b2430', walkerVisor: '#d9a441',   // walk-through figure
  };
  // Visual themes: scene colours here, panel colours and type in style.css under html[data-theme]
  const THEME_COLORS = {
    dark: { route: '#3d86ff', to: '#3d86ff' },   // slate panels
    light: { route: '#1463ff', to: '#1463ff', from: '#0a8a4a', ok: '#157a3a', warn: '#9a5a00', bad: '#c4262e', blocked: '#e0263a' },   // light chart panels
  };
  let theme = 'dark', quick = false;
  try {
    theme = localStorage.getItem('mw.theme') || 'dark';
    quick = sessionStorage.getItem('mw.quick') === '1';   // reload made by the light/dark switch: skip entrance and tutorial
    sessionStorage.removeItem('mw.quick');
  } catch (e) { /* storage unavailable: default theme */ }
  if (!THEME_COLORS[theme]) theme = 'dark';
  Object.assign(colors, THEME_COLORS[theme]);
  document.documentElement.dataset.theme = theme;
  Object.entries(colors).forEach(([k, v]) => document.documentElement.style.setProperty(`--${k}`, v));
  return {
    data, ref, colors, theme, quick, themes: Object.keys(THEME_COLORS),
    state: { exag: 3, mode: data.ortho ? 'tint' : 'elev', from: 'H', to: null, speedKmh: 2.7, load: 'gear', evaHours: 8, stayHours: 1, showStops: true },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, arg) { (listeners[ev] || []).forEach(fn => fn(arg)); },
    toScene(e, n) { return [(e - ref.easting) * ref.k, ref.northing - n]; },
    fromScene(x, z) { return [x / ref.k + ref.easting, ref.northing - z]; },
    toLonLat(e, n) { const d = 180 / Math.PI / data.meta.mars_radius_m; return [e * d, n * d]; },
    point(id) { return data.points.find(p => p.id === id); },
    labelOf(p) {
      if (p.kind === 'target') return MW.t('point.target', p.sol);
      return p.kind === 'isolated' ? MW.t('point.isolated', p.id.slice(1)) : MW.t('point.habitat');
    },
    fmt(v, digits = 0) { return v.toLocaleString(MW.lang === 'en' ? 'en-US' : 'es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }); },
    fmtHours(h) {
      const sign = h < 0 ? '−' : '', m = Math.round(Math.abs(h) * 60);
      return `${sign}${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
    },
  };
})();
