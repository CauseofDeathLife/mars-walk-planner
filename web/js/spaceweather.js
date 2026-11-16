'use strict';
// Space weather: the latest solar eruption (CME) that NASA's WSA-ENLIL simulations send to Mars, from DONKI.
// The record stored with the page is shown first; the public API is then read live and replaces it.
(() => {
  const API = 'https://api.nasa.gov/DONKI/WSAEnlilSimulations', KEY = 'DEMO_KEY', WINDOW_DAYS = 30, t = MW.t;
  const stored = MW.data.spaceWeather;
  let box = null, shown = stored ? stored.event : null, live = false, windowDays = stored ? stored.window_days : WINDOW_DAYS;
  const credit = stored ? stored.credit : 'DONKI, NASA CCMC';
  const day = d => d.toISOString().slice(0, 10);
  const when = iso => new Date(iso).toLocaleString(MW.lang === 'en' ? 'en-US' : 'es-CO',
    { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
  const row = (label, value) => `<tr><td>${label}</td><td>${value}</td></tr>`;

  // Simulation whose impact on Mars arrives last (future arrivals included)
  function latestMarsImpact(sims) {
    let best = null;
    sims.forEach(s => (s.impactList || []).filter(i => i.location === 'Mars').forEach(i => {
      if (best && i.arrivalTime <= best.arrival) return;
      const cme = (s.cmeInputs || [])[0] || {};
      best = { cmeStart: cme.cmeStartTime, speed: cme.speed, arrival: i.arrivalTime, glancing: !!i.isGlancingBlow, link: s.link };
    }));
    return best;
  }

  function render() {
    box.hidden = false;
    let body;
    if (!shown) body = `<p class="note">${t('sw.none', windowDays)}</p>`;
    else {
      const days = (new Date(shown.arrival).getTime() - Date.now()) / 864e5, n = MW.fmt(Math.abs(Math.round(days)));
      const rel = Math.abs(days) < 1 ? '' : ` (${t(days > 0 ? 'sw.in' : 'sw.ago', n)})`;
      body = `<p class="note">${t(days > 0 ? 'sw.next' : 'sw.last', windowDays)}</p><table>` +
        row(t('sw.arrival'), `${when(shown.arrival)}${rel}`) +
        (shown.cmeStart ? row(t('sw.cme'), when(shown.cmeStart)) : '') +
        (shown.speed ? row(t('sw.speed'), `${MW.fmt(shown.speed)} km/s`) : '') +
        row(t('sw.kind'), t(shown.glancing ? 'sw.glancing' : 'sw.direct')) + '</table>' +
        (shown.link ? `<p class="note"><a href="${shown.link}" target="_blank" rel="noopener">${t('sw.link')}</a></p>` : '');
    }
    box.innerHTML = `<h3>${t('sw.title')}</h3>${body}<p class="note">${t('sw.note')} ${t(live ? 'wx.live' : 'wx.stored')}</p><p class="note">${credit}</p>`;
  }

  MW.spaceweather = {
    available() { return true; },
    init() {
      box = document.getElementById('spaceWeather');
      render();
      MW.on('language', render);
      const end = new Date(), start = new Date(end.getTime() - WINDOW_DAYS * 864e5);
      fetch(`${API}?startDate=${day(start)}&endDate=${day(end)}&api_key=${KEY}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(sims => { shown = latestMarsImpact(sims); live = true; windowDays = WINDOW_DAYS; render(); })
        .catch(() => {});   // offline or over the public key's hourly limit: the stored record stays
    },
  };
})();
