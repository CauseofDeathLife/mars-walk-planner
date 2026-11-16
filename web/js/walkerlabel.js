'use strict';
// Floating label over the walker: distance walked and left, and height relative to the start. Follows the
// figure on screen during the walk-through and while hovering the profile.
(() => {
  const { view } = MW, v = new THREE.Vector3();
  let box = null, at = null;
  const signed = x => { const r = Math.round(x); return r > 0 ? `+${MW.fmt(r)}` : r < 0 ? `−${MW.fmt(-r)}` : '0'; };

  // Height on the current route at ground distance s (metres)
  function heightAt(route, s) {
    let lo = 0, hi = route.d.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (route.d[mid] <= s) lo = mid; else hi = mid; }
    const f = route.d[hi] > route.d[lo] ? (s - route.d[lo]) / (route.d[hi] - route.d[lo]) : 0;
    return route.z[lo] + f * (route.z[hi] - route.z[lo]);
  }
  function fill() {
    const route = MW.routes.current();
    if (at === null || !route) { box.hidden = true; return; }
    const total = route.d[route.d.length - 1], s = Math.min(Math.max(at, 0), total), z = heightAt(route, s), up = z - route.z[0];
    box.innerHTML = `<strong>${MW.t('wl.dist', MW.fmt(s), MW.fmt(total - s))}</strong>` +
      `<span>${MW.t('wl.height', signed(up), up < -0.5, MW.fmt(z, 1))}</span>`;
    box.hidden = false;
  }
  function place() {
    if (box.hidden) return;
    if (!MW.walker.visible()) { box.hidden = true; return; }
    v.copy(MW.walker.top()).project(view.camera);
    const off = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
    box.style.display = off ? 'none' : '';
    box.style.left = `${(v.x + 1) / 2 * innerWidth}px`;
    box.style.top = `${(1 - v.y) / 2 * innerHeight}px`;
  }

  MW.walkerLabel = {
    init() {
      box = document.createElement('div');
      box.id = 'walkerLabel'; box.hidden = true;
      document.getElementById('labels').appendChild(box);
      MW.on('walkerAt', s => { at = s; fill(); });
      MW.on('selection', () => { at = null; fill(); });
      MW.on('language', fill);
      MW.on('rendered', place);
    },
  };
})();
