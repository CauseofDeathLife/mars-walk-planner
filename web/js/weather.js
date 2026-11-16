'use strict';
// Latest weather published by REMS (Curiosity, Gale crater): the record stored with the page is shown first,
// then NASA's public feed is read live and replaces it when it brings the same or a newer sol.
(() => {
  const FEED = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json', t = MW.t;
  const missing = v => v === undefined || v === null || v === '' || v === '--' || Number.isNaN(Number(v));
  const num = (v, unit) => missing(v) ? t('wx.noData') : `${MW.fmt(Number(v))} ${unit}`;
  const range = (lo, hi, unit) => missing(lo) || missing(hi) ? t('wx.noData') : t('wx.range', MW.fmt(Number(lo)), MW.fmt(Number(hi)), unit);
  const word = (v, map) => !v || v === '--' ? t('wx.noData') : (map[v] || v);
  const clock = v => !v || v === '--' ? t('wx.noData') : v;
  const row = (label, value) => `<tr><td>${label}</td><td>${value}</td></tr>`;
  let box = null, shown = null, live = false, credit = 'REMS, Centro de Astrobiología (CAB, CSIC-INTA) · NASA/JPL-Caltech';

  function dateInfo(iso) {
    const d = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return { text: iso, age: '' };
    const days = Math.round((Date.now() - d.getTime()) / 864e5);
    return { text: d.toLocaleDateString(MW.lang === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
      age: days > 1 ? t('wx.age', MW.fmt(days)) : '' };
  }
  const newest = soles => soles.filter(r => !missing(r.min_temp) && !missing(r.max_temp)).sort((a, b) => Number(b.sol) - Number(a.sol))[0];

  function render() {
    if (!shown) return;
    const rec = shown, when = dateInfo(rec.terrestrial_date);
    box.hidden = false;
    box.innerHTML = `<h3>${t('wx.title')}</h3><p class="note">${t('wx.latest', rec.sol, when.text, when.age)}</p><table>` +
      row(t('wx.air'), range(rec.min_temp, rec.max_temp, '°C')) +
      row(t('wx.ground'), range(rec.min_gts_temp, rec.max_gts_temp, '°C')) +
      row(t('wx.pressure'), num(rec.pressure, 'Pa')) +
      row(t('wx.uv'), word(rec.local_uv_irradiance_index, t('wx.uvWords'))) +
      row(t('wx.sky'), word(rec.atmo_opacity, t('wx.skyWords'))) +
      row(t('wx.sun'), `${clock(rec.sunrise)} / ${clock(rec.sunset)}`) +
      `</table><p class="note">${t('wx.notToday')} ${t(live ? 'wx.live' : 'wx.stored')}</p><p class="note">${credit}</p>`;
  }

  MW.weather = {
    available() { return !!MW.data.weather; },
    init() {
      const stored = MW.data.weather;
      box = document.getElementById('weather');
      if (stored) { credit = stored.credit; shown = stored.latest; }
      render();
      MW.on('language', render);
      fetch(FEED).then(r => r.json()).then(feed => {
        const rec = newest(feed.soles || []);
        if (rec && (!shown || Number(rec.sol) >= Number(shown.sol))) { shown = rec; live = true; render(); }
      }).catch(() => {});   // offline or blocked: the stored record stays
    },
  };
})();
