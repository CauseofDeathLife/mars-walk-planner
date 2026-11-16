'use strict';
// Walk estimates for a route: time out and back, return margin and radiation dose.
// Speed follows Tobler's hiking function scaled to the chosen flat-ground speed. That function was
// measured on hikers on Earth; it is a working assumption here, shown as such in the page.
(() => {
  const TOBLER_K = 3.5, TOBLER_OFFSET = 0.05;
  const GCR_MSV_PER_DAY = 0.67;   // MSL/RAD surface average, Hassler et al. 2013
  const TIGHT_FRACTION = 0.2;     // margin under 20 % of the outing is shown as tight

  function speedKmh(flatKmh, grade) {
    return flatKmh * Math.exp(-TOBLER_K * Math.abs(grade + TOBLER_OFFSET)) / Math.exp(-TOBLER_K * TOBLER_OFFSET);
  }
  // Hours to walk the route in travel order (direction = 1) or back (direction = -1)
  function hours(route, flatKmh, direction) {
    let h = 0;
    for (let i = 1; i < route.d.length; i++) {
      const run = route.d[i] - route.d[i - 1];
      if (run <= 0) continue;
      h += run / 1000 / speedKmh(flatKmh, direction * (route.z[i] - route.z[i - 1]) / run);
    }
    return h;
  }
  function climb(route) {
    let up = 0, down = 0;
    for (let i = 1; i < route.z.length; i++) { const dz = route.z[i] - route.z[i - 1]; if (dz > 0) up += dz; else down -= dz; }
    return { up, down };
  }

  MW.walk = {
    GCR_MSV_PER_DAY,
    estimate(route) {
      const s = MW.state, out = hours(route, s.speedKmh, 1), back = hours(route, s.speedKmh, -1);
      const total = out + s.stayHours + back, margin = s.evaHours - total;
      return { out, back, stay: s.stayHours, total, margin, limit: s.evaHours, ...climb(route),
        length: route.d[route.d.length - 1], doseMsv: GCR_MSV_PER_DAY * total / 24,
        verdict: margin < 0 ? 'bad' : margin < TIGHT_FRACTION * s.evaHours ? 'warn' : 'ok' };
    },
  };
})();
