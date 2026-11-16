'use strict';
// Elevation profile of the current route on a 2D canvas, coloured by slope class. Heights are labelled
// relative to the origin (0 m). Hovering shows that position on the 3D route.
(() => {
  const panel = document.getElementById('profile'), canvas = document.getElementById('profileCanvas');
  const info = document.getElementById('profileInfo'), ctx = canvas.getContext('2d');
  const PAD = { l: 60, r: 10, t: 8, b: 18 }, STEP_M = 5;
  const CLASS_COLOR = s => s <= 5 ? '#4d9e5c' : s <= 10 ? '#9eb34d' : '#ebb842';
  let series = null, marker = null;
  const signed = v => { const r = Math.round(v); return r > 0 ? `+${MW.fmt(r)}` : r < 0 ? `−${MW.fmt(-r)}` : '0'; };
  // Round tick step giving about four labels over the span
  function tickStep(span) {
    const raw = span / 4, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }

  function build(route) {
    const total = route.d[route.d.length - 1], n = Math.max(Math.ceil(total / STEP_M), 2), d = [], z = [];
    let j = 0;
    for (let i = 0; i <= n; i++) {
      const s = total * i / n;
      while (j < route.d.length - 2 && route.d[j + 1] < s) j++;
      const f = route.d[j + 1] > route.d[j] ? (s - route.d[j]) / (route.d[j + 1] - route.d[j]) : 0;
      d.push(s); z.push(route.z[j] + f * (route.z[j + 1] - route.z[j]));
    }
    return { d, z, total, zmin: Math.min(...z), zmax: Math.max(...z) };
  }

  function draw() {
    if (!series) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, ratio = Math.min(devicePixelRatio, 2);
    canvas.width = w * ratio; canvas.height = h * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement), INK = css.getPropertyValue('--ink').trim(), MUTED = css.getPropertyValue('--muted').trim();
    const FONT = css.getPropertyValue('--font').trim() || 'sans-serif';
    const { d, z, total } = series, span = Math.max(series.zmax - series.zmin, 10), base = series.zmin - span * 0.08;
    const X = v => PAD.l + v / total * (w - PAD.l - PAD.r), Y = v => h - PAD.b - (v - base) / (span * 1.16) * (h - PAD.t - PAD.b);
    ctx.fillStyle = 'rgba(217,121,59,.16)';
    ctx.beginPath(); ctx.moveTo(X(0), h - PAD.b);
    d.forEach((v, i) => ctx.lineTo(X(v), Y(z[i])));
    ctx.lineTo(X(total), h - PAD.b); ctx.fill();
    ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let i = 1; i < d.length; i++) {
      const slope = Math.atan(Math.abs(z[i] - z[i - 1]) / (d[i] - d[i - 1])) * 180 / Math.PI;
      ctx.strokeStyle = CLASS_COLOR(slope);
      ctx.beginPath(); ctx.moveTo(X(d[i - 1]), Y(z[i - 1])); ctx.lineTo(X(d[i]), Y(z[i])); ctx.stroke();
    }
    // vertical axis relative to the origin, with a faint line at 0 m
    const z0 = z[0], step = tickStep(span);
    ctx.fillStyle = MUTED; ctx.font = `11px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    for (let t = Math.ceil((series.zmin - z0) / step) * step; t <= series.zmax - z0 + 1e-6; t += step) {
      ctx.fillText(`${signed(t)} m`, PAD.l - 5, Y(z0 + t));
    }
    ctx.strokeStyle = MUTED; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD.l, Y(z0)); ctx.lineTo(w - PAD.r, Y(z0)); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.fillStyle = MUTED;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.fillText('0', PAD.l, h - 4);
    ctx.textAlign = 'right'; ctx.fillText(`${MW.fmt(total)} m`, w - PAD.r, h - 4);
    if (marker !== null) {
      const i = Math.min(Math.round(marker / total * (d.length - 1)), d.length - 1);
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(marker), PAD.t); ctx.lineTo(X(marker), h - PAD.b); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(X(marker), Y(z[i]), 3.5, 0, 7); ctx.fill();
      const up = z[i] - z0, left = z[z.length - 1] - z[i];
      info.innerHTML = MW.t('profile.info', MW.fmt(marker), MW.fmt(total - marker), signed(up), up < -0.5, signed(left), MW.fmt(z[i], 1));
    } else info.textContent = MW.t('profile.hover');
  }

  function setMarker(s) { marker = s; draw(); }
  canvas.addEventListener('pointermove', ev => {
    if (!series || MW.routes.isWalking()) return;
    const box = canvas.getBoundingClientRect(), f = (ev.clientX - box.left - PAD.l) / (box.width - PAD.l - PAD.r);
    const s = Math.min(Math.max(f, 0), 1) * series.total;
    setMarker(s); MW.routes.showDot(s);
  });
  canvas.addEventListener('pointerleave', () => { if (!MW.routes.isWalking()) { setMarker(null); MW.routes.hideDot(); } });

  MW.profile = {
    init() {
      MW.on('selection', () => {
        const route = MW.routes.current();
        series = route ? build(route) : null; marker = null;
        panel.hidden = !route;
        draw();
      });
      MW.on('walkProgress', setMarker);
      MW.on('walk', st => { if (st === 'idle') { setMarker(null); MW.routes.hideDot(); } });
      addEventListener('resize', draw);
      MW.on('language', draw);
    },
  };
})();
