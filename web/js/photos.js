'use strict';
// Ground-level photos by Curiosity's Navcam: at each target (the very stop of that sol) and at the stops
// with a rover along the track. Thumbnails in the result card, full view in a lightbox.
(() => {
  const P = MW.data.photos, COLOR = MW.data.colorPhotos, stops = MW.data.trackPhotos || [], NEAR_ROUTE_M = 75, MAX_NEAR = 3, t = MW.t;
  let groups = {};   // key -> [{ src, caption }], rebuilt when the language changes
  let box = null, shown = null;
  const dateText = iso => new Date(iso).toLocaleDateString(MW.lang === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  function group(key, sol, photos, whatKey, src = P, instrumentKey = 'ph.instrument') {
    if (!groups[key]) groups[key] = photos.map(ph => ({ src: src.base + ph.path,
      caption: `${t(whatKey)} · ${t(instrumentKey)} · sol ${sol} · ${dateText(ph.date)} · ${src.credit}` }));
    return key;
  }
  const thumbs = (key, sol) => groups[key].map((it, i) => `<img loading="lazy" alt="${t('ph.alt', sol)}" data-key="${key}" data-index="${i}" src="${it.src}">`).join('');

  function show(key, index) {
    const list = groups[key];
    shown = { key, index: (index + list.length) % list.length };
    box.querySelector('img').src = list[shown.index].src;
    box.querySelector('figcaption').textContent = list[shown.index].caption + (list.length > 1 ? t('ph.count', shown.index + 1, list.length) : '');
    box.hidden = false;
  }

  // Track stops with photos that lie close to the selected route, nearest first
  function nearRoute() {
    const route = MW.routes.current();
    if (!route) return [];
    return stops.map(stop => {
      let best = Infinity;
      for (let i = 0; i < route.e.length; i += 3) best = Math.min(best, Math.hypot((route.e[i] - stop.e) * MW.ref.k, route.n[i] - stop.n));
      return { stop, dist: best };
    }).filter(r => r.dist <= NEAR_ROUTE_M).sort((a, b) => a.dist - b.dist).slice(0, MAX_NEAR);
  }

  MW.photos = {
    available() { return !!P; },
    // Blocks for the result card: photos at the destination, then stops of Curiosity near the route
    html(point) {
      if (!P) return '';
      let out = '';
      const own = point && point.kind === 'target' ? P.photos[String(point.sol)] : null;
      if (own && own.length) {
        const key = group(`T${point.sol}`, point.sol, own, 'ph.atStop');
        out += `<div class="photos"><h4>${t('ph.arrive')}</h4><div class="thumbs">${thumbs(key, point.sol)}</div>` +
          `<p class="note">${t('ph.arriveNote', t('ph.instrument'), point.sol, P.credit)}</p></div>`;
      }
      const colour = COLOR && point && point.kind === 'target' ? COLOR.photos[String(point.sol)] : null;
      if (colour && colour.length) {   // Mastcam colour frames exist only for some stops
        const key = group(`C${point.sol}`, point.sol, colour, 'ph.atStopColor', COLOR, 'ph.instrumentColor');
        out += `<div class="photos color"><h4>${t('ph.color')}</h4><div class="thumbs">${thumbs(key, point.sol)}</div>` +
          `<p class="note">${t('ph.colorNote', point.sol, COLOR.credit)}</p></div>`;
      }
      const near = nearRoute();
      if (near.length) {
        out += `<div class="photos"><h4>${t('ph.near')}</h4>` + near.map(r => {
          const key = group(`S${r.stop.sol}`, r.stop.sol, r.stop.photos, 'ph.onTrack');
          return `<p class="note">${t('ph.nearItem', r.stop.sol, MW.fmt(Math.max(Math.round(r.dist / 10) * 10, 10)))}</p>` +
            `<div class="thumbs">${thumbs(key, r.stop.sol)}</div>`;
        }).join('') + `<p class="note">${t('ph.nearNote')}</p></div>`;
      }
      return out;
    },
    // Lightbox for a rover of the track
    openStop(stop) { if (P) show(group(`S${stop.sol}`, stop.sol, stop.photos, 'ph.onTrack'), 0); },
    init() {
      box = document.createElement('div');
      box.id = 'lightbox'; box.hidden = true;
      box.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure>';
      document.body.appendChild(box);
      box.addEventListener('click', ev => {
        if (ev.target.tagName === 'IMG' && shown && groups[shown.key].length > 1) show(shown.key, shown.index + 1);
        else box.hidden = true;
      });
      addEventListener('keydown', ev => { if (ev.key === 'Escape') box.hidden = true; });
      MW.on('language', () => { groups = {}; box.hidden = true; });   // captions are rebuilt in the new language
      const result = document.getElementById('result');
      result.addEventListener('click', ev => {
        const img = ev.target.closest('.thumbs img');
        if (img) show(img.dataset.key, Number(img.dataset.index));
      });
      // A photo that fails to load (no internet) is dropped instead of showing a broken image
      result.addEventListener('error', ev => { if (ev.target.matches && ev.target.matches('.thumbs img')) ev.target.remove(); }, true);
    },
  };
})();
