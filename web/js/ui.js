'use strict';
// Side panel: origin/destination, result card, walk assumptions, layers, legend and terrain readout.
(() => {
  const { data, view } = MW, $ = id => document.getElementById(id), t = MW.t;
  const selFrom = $('selFrom'), selTo = $('selTo'), result = $('result');
  const LIMIT = data.meta.slope_limit_deg;
  const W = MW.routes.WALK_MS, WALK_S = [W.min / 1000, W.max / 1000];
  const sliderOutputs = [];   // redrawn when the language (number format) changes
  let lastReadout = null;

  function fillSelects() {
    const { from, to } = MW.state, option = (p, sel) => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${MW.labelOf(p)}</option>`;
    selFrom.innerHTML = data.points.map(p => option(p, from)).join('');
    selTo.innerHTML = `<option value="">${t('ui.pickDest')}</option>` + data.points.filter(p => p.id !== from).map(p => option(p, to)).join('');
  }

  function select(from, to, frame = true) {
    MW.state.from = from;
    MW.state.to = to && to !== from ? to : null;
    fillSelects();
    MW.emit('selection');
    renderResult();
    if (frame && MW.state.to) view.frame(MW.routes.scenePoints(), 800);
  }

  function row(label, value, note) {
    return `<tr><td>${label}${note ? `<div class="note">${note}</div>` : ''}</td><td>${value}</td></tr>`;
  }
  function marginBar(est) {
    const pct = v => `${Math.max(v, 0) / Math.max(est.limit, est.total) * 100}%`;
    const rest = est.margin >= 0 ? `<i class="left ${est.verdict}" style="width:${pct(est.margin)}"></i>` : '';
    return `<div class="margin"><div class="bar"><i class="out" style="width:${pct(est.out)}" title="${t('res.out')}"></i>` +
      `<i class="stay" style="width:${pct(est.stay)}" title="${t('res.stay')}"></i><i class="${est.margin < 0 ? 'over' : 'back'}" style="width:${pct(est.back)}" title="${t('res.back')}"></i>${rest}</div></div>`;
  }
  function verdictText(est) {
    return t(`verdict.${est.verdict}`, MW.fmtHours(est.verdict === 'bad' ? -est.margin : est.margin));
  }

  function renderResult() {
    const { from, to } = MW.state;
    result.hidden = !to;
    if (!to) return;
    const a = MW.point(from), b = MW.point(to), route = MW.routes.current(), title = `${MW.labelOf(a)} → ${MW.labelOf(b)}`;
    result.className = route ? 'card' : 'card blocked';
    if (!route) {
      const straight = Math.hypot((a.easting - b.easting) * MW.ref.k, a.northing - b.northing);
      const isolated = [a, b].find(p => p.kind === 'isolated');
      result.innerHTML = `<h3>${t('res.noRoute')}</h3><p>${title}</p>` +
        `<p class="hint">${t('res.noRouteWhy', LIMIT)}${isolated ? t('res.isolatedWhy', MW.labelOf(isolated)) : ''}</p>` +
        `<p class="hint">${t('res.straight', MW.fmt(straight))}</p>`;
      return;
    }
    const est = MW.walk.estimate(route);
    result.innerHTML = `<h3>${title}</h3><table>` +
      row(t('res.distance'), `${MW.fmt(est.length)} m`) +
      row(t('res.climb'), `+${MW.fmt(est.up)} m / −${MW.fmt(est.down)} m`) +
      row(t('res.maxSlope'), t('res.maxSlopeVal', MW.fmt(route.maxSlope, 1), LIMIT), t('res.maxSlopeNote')) +
      row(t('res.out'), MW.fmtHours(est.out)) + row(t('res.back'), MW.fmtHours(est.back)) +
      row(t('res.total'), MW.fmtHours(est.total), t('res.totalNote', MW.fmtHours(est.stay))) +
      `</table>${marginBar(est)}<div class="verdict ${est.verdict}">${verdictText(est)}</div><table>` +
      row(t('res.dose'), `${MW.fmt(est.doseMsv, 2)} mSv`, t('res.doseNote', MW.fmt(MW.walk.GCR_MSV_PER_DAY, 2))) +
      `</table><div class="actions" id="walkActions"></div>` +
      `<p class="walk-note">${t('res.walkNote', WALK_S[0], WALK_S[1])}</p>` +
      MW.science.html(b) + MW.photos.html(b);
    renderActions();
  }

  // Card buttons for the walk-through state: idle (walk, frame), walking (pause, stop), paused (resume, stop)
  const ACTIONS = {
    idle: [['act.walk', () => MW.routes.startWalk()], ['act.frame', () => view.frame(MW.routes.scenePoints(), 700)]],
    walking: [['act.pause', () => MW.routes.pauseWalk()], ['act.stop', () => MW.routes.stopWalk()]],
    paused: [['act.resume', () => MW.routes.resumeWalk()], ['act.stop', () => MW.routes.stopWalk()]],
  };
  function renderActions() {
    const box = $('walkActions');
    if (!box) return;
    box.replaceChildren(...ACTIONS[MW.routes.walkState()].map(([key, act], i) => {
      const b = document.createElement('button');
      b.textContent = t(key); b.onclick = act;
      if (i === 0) b.className = 'primary';
      return b;
    }));
  }

  // NASA data behind the page, by the kind of data the challenge statement lists; only what this build carries
  function renderDataUsed() {
    const items = [
      t('du.topo'),
      MW.terrain.hasPhoto() && t('du.ortho'),
      MW.photos.available() && t('du.photos'),
      MW.weather.available() && t('du.weather'),
      MW.spaceweather.available() && t('du.space'),
      MW.data.globe && t('du.globe'),
      t('du.rad', MW.fmt(MW.walk.GCR_MSV_PER_DAY, 2)),
      t('du.track'),
    ].filter(Boolean);
    $('dataUsedList').innerHTML = items.map(([kind, text]) => `<li><strong>${kind}:</strong> ${text}</li>`).join('');
  }

  function bindSlider(input, output, key, text) {
    const el = $(input), show = () => { $(output).textContent = text(MW.state[key]); };
    el.value = MW.state[key]; show();
    sliderOutputs.push(show);
    el.addEventListener('input', () => { MW.state[key] = parseFloat(el.value); show(); renderResult(); });
  }

  function updateLegend() {
    const mode = MW.state.mode, slope = mode === 'slope', photo = mode === 'photo', tint = mode === 'tint';
    $('legendBar').style.background = tint ? 'linear-gradient(90deg, #170e08, #f2b98a)' : photo ? 'linear-gradient(90deg, #111, #eee)'
      : slope ? MW.terrain.slopeCss() : MW.terrain.elevCss();
    $('legendText').textContent = tint ? t('legendbar.tint') : photo ? t('legendbar.photo') : slope ? t('legendbar.slope', LIMIT)
      : t('legendbar.elev', MW.fmt(data.stats.area_zmin), MW.fmt(data.stats.area_zmax));
    $('exagText').textContent = MW.state.exag === 1 ? t('exag.none') : t('exag.x', MW.state.exag);
  }

  function renderReadout() {
    if (!lastReadout) return;
    const { ll, z, s } = lastReadout;
    $('readout').innerHTML = t('readout.value', MW.fmt(Math.abs(ll[1]), 5), ll[1] < 0 ? 'S' : 'N', MW.fmt(ll[0], 5),
      z === null ? '—' : `${MW.fmt(z, 1)} m`, s === null ? '—' : `${MW.fmt(s, 1)}°`);
  }
  // Astronaut pace presets: flat-ground speeds from Apollo (sources in the panel hint)
  const LOAD_KMH = { light: 3.6, gear: 2.7, tired: 1.7 };
  function renderLoad() {
    document.querySelectorAll('#segLoad button').forEach(b => b.classList.toggle('on', b.dataset.load === MW.state.load));
    $('loadNote').textContent = t(`load.note.${MW.state.load}`);
  }
  function setLoad(kind) {
    MW.state.load = kind;
    MW.state.speedKmh = LOAD_KMH[kind];
    renderLoad();
    renderResult();
  }
  function renderSpeedNote() { $('walkSpeedNote').textContent = t('assume.speedNote', WALK_S[0], WALK_S[1]); }

  // Click: a rover of the track opens its photos, a marker becomes the destination,
  // anywhere else on the terrain shows its coordinates
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let down = null;
  function onClick(ev) {
    const stop = MW.track.pick(ev.clientX, ev.clientY);
    if (stop) { MW.photos.openStop(stop); return; }
    const id = MW.markers.pick(ev.clientX, ev.clientY);
    if (id) { if (id !== MW.state.from) select(MW.state.from, id); return; }
    mouse.set(ev.clientX / innerWidth * 2 - 1, -ev.clientY / innerHeight * 2 + 1);
    ray.setFromCamera(mouse, view.camera);
    const hit = ray.intersectObjects(MW.terrain.meshes(), false)[0];
    if (!hit) return;
    const en = MW.fromScene(hit.point.x, hit.point.z);
    lastReadout = { ll: MW.toLonLat(en[0], en[1]), z: MW.elevationAt(en[0], en[1]), s: MW.slopeAt(en[0], en[1]) };
    renderReadout();
  }

  MW.ui = {
    init() {
      fillSelects();
      selFrom.onchange = () => select(selFrom.value, MW.state.to);
      selTo.onchange = () => select(MW.state.from, selTo.value || null);
      $('btnSwap').onclick = () => { if (MW.state.to) select(MW.state.to, MW.state.from); };
      document.querySelectorAll('#segLoad button').forEach(b => b.addEventListener('click', () => setLoad(b.dataset.load)));
      renderLoad();
      bindSlider('inEva', 'outEva', 'evaHours', v => MW.fmtHours(v));
      bindSlider('inStay', 'outStay', 'stayHours', v => MW.fmtHours(v));
      document.querySelectorAll('#segMode button').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('#segMode button').forEach(b => b.classList.toggle('on', b === btn));
        MW.state.mode = btn.dataset.mode; MW.terrain.setMode(MW.state.mode); updateLegend(); view.requestRender();
      }));
      $('chkStops').onchange = ev => MW.markers.setStopsVisible(ev.target.checked);
      $('selExag').onchange = ev => { view.setExaggeration(parseFloat(ev.target.value)); updateLegend(); };
      MW.on('walk', renderActions);
      $('selWalker').onchange = ev => { MW.walker.setKind(ev.target.value); $('roverNote').hidden = ev.target.value !== 'rover'; };
      document.querySelectorAll('#segMode button').forEach(b => b.classList.toggle('on', b.dataset.mode === MW.state.mode));
      $('btnPhoto').hidden = $('btnTint').hidden = !MW.terrain.hasPhoto();
      if (!MW.terrain.hasPhoto()) $('segMode').classList.add('two');
      renderDataUsed();
      const canvas = view.renderer.domElement;
      canvas.addEventListener('pointerdown', ev => { down = [ev.clientX, ev.clientY]; });
      canvas.addEventListener('pointerup', ev => { if (down && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) <= 4) onClick(ev); });
      renderSpeedNote();
      updateLegend();
      MW.on('language', () => {
        fillSelects(); renderResult(); updateLegend(); renderDataUsed(); renderSpeedNote(); renderReadout(); renderLoad();
        sliderOutputs.forEach(show => show());
      });
    },
    select,
  };
})();
