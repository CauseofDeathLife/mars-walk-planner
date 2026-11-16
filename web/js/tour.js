'use strict';
// Tutorial shown on every page load: bubbles that walk through everything the page offers. It never blocks the map
// (the highlight ignores the pointer), can go back, be skipped, or be replayed with the "?" button. Steps whose
// element is missing or hidden in this build are skipped. If no destination is chosen, it picks a sample route so
// the result card, the profile, the science goals and the photos can be shown.
(() => {
  const STEPS = [
    { key: 'welcome' },
    { key: 'points', spot: () => [MW.markers.scenePosition('H')] },
    { sel: '.tab[data-tab="route"] .pair', tab: 'route', key: 'pick' },
    { sel: '#result > table', tab: 'route', key: 'result', sample: true },
    { sel: '#segLoad', tab: 'route', key: 'pace' },
    { sel: '#assumptions .pair2', tab: 'route', key: 'eva' },
    { sel: '#result .verdict', tab: 'route', key: 'margin', sample: true },
    { sel: '#walkActions', tab: 'route', key: 'walk', sample: true },
    { sel: '#profile', key: 'profile', sample: true },
    { sel: '#result .science', tab: 'route', key: 'science', sample: true },
    { sel: '#result .photos', tab: 'route', key: 'photos', sample: true },
    { sel: '#result .photos.color', tab: 'route', key: 'color', sample: true },
    { key: 'rovers', spot: () => MW.track.positions(), avoidRoute: true, size: 46, track: true },
    { key: 'roverPhoto', spot: () => MW.track.positions(), avoidRoute: true, size: 40 },
    { sel: '#readout', key: 'readout' },
    { sel: '#navMode', key: 'nav' },
    { sel: '#compass', key: 'compass' },
    { sel: '#badge', key: 'badge' },
    { sel: '#segMode', tab: 'map', key: 'layers' },
    { sel: '#selExag', tab: 'map', key: 'exag' },
    { sel: '#selWalker', tab: 'map', key: 'walker' },
    { sel: '#conventions', tab: 'map', key: 'conventions' },
    { sel: '#weather', tab: 'today', key: 'weather' },
    { sel: '#spaceWeather', tab: 'today', key: 'space' },
    { sel: '#dataUsed', tab: 'data', key: 'data' },
    { sel: '#validation', tab: 'data', key: 'validation' },
    { sel: '#langSwitch', tab: 'route', key: 'lang' },
    { sel: '#btnTheme', key: 'theme' },
    { sel: '#team', key: 'team' },
    { sel: '#btnHelp', key: 'help' },
  ];
  const PAD = 6, GAP = 14, SPOT = 34, SAMPLE_SOL = 4071, AVOID_PX = 90, t = MW.t, v = new THREE.Vector3();
  // True when a hill stands between the camera and the scene point p (terrain heights sampled along the sight line)
  function hidden(p) {
    const cam = MW.view.camera.position;
    for (let i = 1; i < 60; i++) {
      const f = i / 60, x = cam.x + (p.x - cam.x) * f, z = cam.z + (p.z - cam.z) * f, y = cam.y + (p.y - cam.y) * f;
      const g = MW.groundY(x, z);
      if (g !== null && g > y + 3) return true;
    }
    return false;
  }
  let ring = null, bubble = null, index = -1, steps = STEPS;

  // A destination north of the origin (the walk goes south to north) with a safe route, science goals and photos
  // (sol 4071 if possible)
  function chooseSample() {
    if (MW.state.to) return;
    const from = MW.point(MW.state.from), ok = MW.data.points.filter(p => p.kind === 'target' && p.id !== from.id && MW.routes.find(from.id, p.id));
    const north = ok.filter(p => p.northing > from.northing);
    const pick = north.find(p => p.sol === SAMPLE_SOL) || north[0] || ok[0];
    if (pick) MW.ui.select(from.id, pick.id);
  }
  // A point of the 3D scene for steps about the map: the candidate on screen closest to the middle of the map
  function spotRect(step) {
    const panelRight = document.getElementById('panel').getBoundingClientRect().right;
    const cx = (panelRight + innerWidth) / 2, cy = innerHeight * 0.45, R = step.size || SPOT;
    const screen = p => { v.copy(p).project(MW.view.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, behind: v.z > 1 }; };
    // points to keep away from (the chosen route and the habitat), so the circle shows only the track and a rover
    const avoid = step.avoidRoute ? MW.routes.scenePoints().concat([MW.markers.scenePosition('H')]).map(screen) : [];
    const pickFrom = strict => {
      let best = null;
      step.spot().forEach(p => {
        const { x, y, behind } = screen(p);
        if (behind || x < panelRight + 50 || x > innerWidth - 50 || y < 60 || y > innerHeight - 220) return;
        if (strict && avoid.some(a => Math.hypot(a.x - x, a.y - y) < AVOID_PX)) return;
        const d = Math.hypot(x - cx, y - cy);
        if ((!best || d < best.d) && !hidden(p)) best = { x, y, d };
      });
      return best;
    };
    const best = pickFrom(true) || pickFrom(false);
    return best && { left: best.x - R, top: best.y - R, right: best.x + R, bottom: best.y + R, width: 2 * R, height: 2 * R };
  }
  function target(step) {
    if (!step.sel) return null;
    const el = document.querySelector(step.sel);
    return el && !el.hidden && el.getClientRects().length ? el : null;
  }
  function place() {
    const step = steps[index], el = target(step), w = bubble.offsetWidth, h = bubble.offsetHeight;
    const spot = !el && step.spot ? spotRect(step) : null;
    ring.classList.toggle('spot', !!spot);
    if (!el && !spot) {   // nothing to point at: bubble in the middle of the map, no highlight
      const panelRight = document.getElementById('panel').getBoundingClientRect().right;
      ring.hidden = true;
      bubble.style.left = `${Math.max(panelRight + (innerWidth - panelRight - w) / 2, 12)}px`;
      bubble.style.top = `${Math.max((innerHeight - h) * 0.35, 12)}px`;
      return;
    }
    const r = el ? el.getBoundingClientRect() : spot;
    ring.hidden = false;
    Object.assign(ring.style, { left: `${r.left - PAD}px`, top: `${r.top - PAD}px`, width: `${r.width + 2 * PAD}px`, height: `${r.height + 2 * PAD}px` });
    const left = r.right + GAP + w < innerWidth ? r.right + GAP : Math.max(r.left - GAP - w, 12);
    bubble.style.left = `${left}px`;
    // elements low on the screen (the profile) get the bubble above them
    const top = r.top > innerHeight * 0.6 && left < r.right && left + w > r.left ? r.top - GAP - h : r.top;
    bubble.style.top = `${Math.min(Math.max(top, 12), innerHeight - h - 12)}px`;
  }
  function end() {
    MW.markers.highlightStops(false);
    ring.hidden = bubble.hidden = true;
    index = -1;
    MW.tabs.show('route');
  }
  function show(i, dir = 1) {
    while (i >= 0 && i < steps.length) {
      const step = steps[i];
      if (step.sample) chooseSample();
      if (step.tab) MW.tabs.show(step.tab);
      if (!step.sel || target(step)) break;
      i += dir;   // element not in this build or hidden: skip it
    }
    if (i < 0) i = 0;
    if (i >= steps.length) { end(); return; }
    index = i;
    MW.markers.highlightStops(!!steps[i].track);
    const el = target(steps[i]);
    if (el) el.scrollIntoView({ block: 'nearest' });
    const lastStep = i === steps.length - 1;
    bubble.hidden = false;
    bubble.innerHTML = `<p>${t(`tour.${steps[i].key}`)}</p><div class="row"><span class="muted">${t('tour.step', i + 1, steps.length)}</span>` +
      `<span><button data-act="skip">${t('tour.skip')}</button> ${i > 0 ? `<button data-act="back">${t('tour.back')}</button> ` : ''}` +
      `<button data-act="next" class="primary">${t(lastStep ? 'tour.done' : 'tour.next')}</button></span></div>`;
    place();
  }

  MW.tour = {
    start() { show(0); },
    init() {
      ring = document.createElement('div'); ring.id = 'tourRing'; ring.hidden = true;
      bubble = document.createElement('div'); bubble.id = 'tourBubble'; bubble.className = 'panel'; bubble.hidden = true;
      document.body.append(ring, bubble);
      bubble.addEventListener('click', ev => {
        const act = ev.target.dataset.act;
        if (act === 'next') show(index + 1); else if (act === 'back') show(index - 1, -1); else if (act === 'skip') end();
      });
      document.getElementById('btnHelp').addEventListener('click', () => show(0));
      MW.on('language', () => { if (index >= 0) show(index); });
      const replace = () => { if (index >= 0) place(); };
      addEventListener('resize', replace);
      document.getElementById('panel').addEventListener('scroll', replace, true);
      MW.on('selection', () => requestAnimationFrame(replace));
      MW.on('rendered', () => { if (index >= 0 && steps[index].spot) place(); });   // map steps follow the camera
      MW.on('introDone', () => { if (!MW.quick) show(0); });   // every page load; "Skip" closes it for this visit
    },
  };
})();
