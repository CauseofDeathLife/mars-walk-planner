'use strict';
// Precomputed routes: lookup by pair, drawing on the terrain and the walk-through animation
// (states: idle → walking ⇄ paused → idle).
(() => {
  const { view, data, ref } = MW;
  const LIFT = 1.5, WALK_RADIUS = 1.4, BLOCKED_LIFT = 12, MAX_DASHES = 160, RESUME_MS = 600, HEADING_M = 5;
  // Walk-through animation length: proportional to the route, clamped (it does not depend on the walking speed)
  const WALK_MS = { perMetre: 12, min: 9000, max: 32000 };
  const byPair = new Map();

  // Decode once: integers (decimetres east/north, centimetres up, relative to the reference point)
  data.routes.forEach(r => {
    if (r.ok) {
      const n = r.pts.length / 3;
      r.e = new Float64Array(n); r.n = new Float64Array(n); r.z = new Float64Array(n); r.d = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        r.e[i] = ref.easting + r.pts[3 * i] / 10; r.n[i] = ref.northing + r.pts[3 * i + 1] / 10; r.z[i] = ref.elevation + r.pts[3 * i + 2] / 100;
        if (i) r.d[i] = r.d[i - 1] + Math.hypot((r.e[i] - r.e[i - 1]) * ref.k, r.n[i] - r.n[i - 1]);
      }
      delete r.pts;
    }
    byPair.set(`${r.a}|${r.b}`, r);
  });

  // Route as travelled from `from` to `to`: arrays in travel order, or null when no safe route exists
  function find(from, to) {
    const fwd = byPair.get(`${from}|${to}`), rev = byPair.get(`${to}|${from}`), r = fwd || rev;
    if (!r || !r.ok) return null;
    if (fwd) return r;
    if (!r.reversed) {
      const total = r.d[r.d.length - 1];
      r.reversed = { ok: true, a: r.b, b: r.a, len: r.len, maxSlope: r.maxSlope,
        e: Float64Array.from(r.e).reverse(), n: Float64Array.from(r.n).reverse(), z: Float64Array.from(r.z).reverse(),
        d: Float64Array.from(r.d, v => total - v).reverse() };
    }
    return r.reversed;
  }

  let current = null, mesh = null, lastRadius = 0, blockedMid = null;
  const blockedLabel = document.createElement('div');
  blockedLabel.className = 'label blocked'; blockedLabel.textContent = MW.t('route.blockedLabel'); blockedLabel.style.display = 'none';
  document.getElementById('labels').appendChild(blockedLabel);

  function scenePoints(r, stride) {
    const pts = [];
    for (let i = 0; i < r.e.length; i += stride) pts.push(view.surface(r.e[i], r.n[i], LIFT, r.z[i]));
    const last = r.e.length - 1;
    if (last % stride) pts.push(view.surface(r.e[last], r.n[last], LIFT, r.z[last]));
    return pts;
  }
  function tubeRadius() { return Math.min(Math.max(view.camera.position.distanceTo(view.controls.target) * 0.0035, 1.2), 40); }

  function clear() {
    if (mesh) {
      view.overlay.remove(mesh);
      mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      mesh = null;
    }
    blockedMid = null; blockedLabel.style.display = 'none';
  }

  // No safe route: straight line between the two points, lifted over the terrain, drawn as tube dashes
  function blockedDashes(from, to, radius) {
    const a = MW.markers.scenePosition(from), b = MW.markers.scenePosition(to), pts = [], cum = [0];
    const lift = Math.max(BLOCKED_LIFT, radius * 1.5);
    for (let i = 0; i <= 80; i++) {
      const p = a.clone().lerp(b, i / 80), g = MW.groundY(p.x, p.z);
      p.y = Math.max(p.y, g === null ? p.y : g) + lift; pts.push(p);
      if (i) cum.push(cum[i - 1] + p.distanceTo(pts[i - 1]));
    }
    const total = cum[cum.length - 1];
    const at = L => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < L) i++;
      const f = cum[i] > cum[i - 1] ? (L - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
      return pts[i - 1].clone().lerp(pts[i], Math.min(Math.max(f, 0), 1));
    };
    // dash and gap scale with the tube radius so the pattern looks the same at any zoom
    const period = Math.max(radius * 10, total / MAX_DASHES), dash = period * 0.6;
    const group = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: MW.colors.blocked });
    for (let s0 = 0; s0 < total; s0 += period) {
      const s1 = Math.min(s0 + dash, total), seg = [at(s0)];
      cum.forEach((c, i) => { if (c > s0 && c < s1) seg.push(pts[i]); });
      seg.push(at(s1));
      if (s1 - s0 < radius * 0.5) continue;
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seg), seg.length * 2, radius, 6, false), mat));
    }
    blockedMid = at(total / 2);
    return group;
  }
  const lv = new THREE.Vector3();
  function placeBlockedLabel() {
    if (!blockedMid) return;
    lv.copy(blockedMid).project(view.camera);
    const hidden = lv.z > 1 || Math.abs(lv.x) > 1.1 || Math.abs(lv.y) > 1.1;
    blockedLabel.style.display = hidden ? 'none' : '';
    blockedLabel.style.left = `${(lv.x + 1) / 2 * innerWidth}px`;
    blockedLabel.style.top = `${(1 - lv.y) / 2 * innerHeight - 6}px`;
  }
  function draw(radius) {
    clear();
    const { from, to } = MW.state;
    if (!to) { view.requestRender(); return; }
    lastRadius = typeof radius === 'number' ? radius : tubeRadius();
    if (current) {
      const pts = scenePoints(current, 3);
      mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, lastRadius, 6, false),
        new THREE.MeshBasicMaterial({ color: MW.colors.route, depthWrite: false }));
      mesh.renderOrder = 1;   // after the terrain, before the walker: the walker is drawn over the line
    } else mesh = blockedDashes(from, to, lastRadius);
    view.overlay.add(mesh);
    view.requestRender();
  }

  // Position along the current route at ground distance s (metres), as a scene vector
  function positionAt(s, lift = LIFT) {
    const r = current, d = r.d;
    let lo = 0, hi = d.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (d[mid] <= s) lo = mid; else hi = mid; }
    const f = d[hi] > d[lo] ? (s - d[lo]) / (d[hi] - d[lo]) : 0;
    return view.surface(r.e[lo] + f * (r.e[hi] - r.e[lo]), r.n[lo] + f * (r.n[hi] - r.n[lo]), lift, r.z[lo]);
  }
  // Walker standing at distance s, facing the route a few metres ahead
  function showDot(s) {
    if (!current) return;
    const total = current.d[current.d.length - 1], feet = positionAt(s, 0);
    const dir = s + HEADING_M <= total ? positionAt(s + HEADING_M, 0).sub(feet) : feet.clone().sub(positionAt(Math.max(s - HEADING_M, 0), 0));
    MW.walker.place(feet, dir);
  }

  // Walk-through: the camera follows behind and above the walker. Progress is kept as elapsed time so
  // it can be paused and resumed from the same distance.
  let walkState = 'idle', walkElapsed = 0, walkMs = 0, walkS = 0;
  function setWalkState(st) { walkState = st; MW.emit('walk', st); }
  const back = new THREE.Vector3(), camPos = new THREE.Vector3();
  function chase(s, total) {   // camera position behind the walker at distance s; returns the look-at point
    const here = positionAt(s), ahead = positionAt(Math.min(s + 60, total)), behind = positionAt(Math.max(s - 60, 0));
    back.copy(behind).sub(ahead).setY(0);
    if (back.lengthSq() < 1) back.set(0, 0, 1);
    back.normalize();
    camPos.copy(here).addScaledVector(back, 170).setY(here.y + 95);
    return here;
  }
  function stopWalk() {
    if (walkState === 'idle') return;
    view.stopAnimation();
    setWalkState('idle');
  }
  function pauseWalk() {
    if (walkState !== 'walking') return;
    view.stopAnimation();
    setWalkState('paused');
  }
  function run(resuming) {
    const total = current.d[current.d.length - 1], cam = view.camera, target = view.controls.target;
    const p0 = cam.position.clone(), t0 = target.clone(), t = performance.now();
    let last = t;
    setWalkState('walking');
    (function step() {
      if (walkState !== 'walking') return;
      const now = performance.now();
      if (resuming && now - t < RESUME_MS) {   // glide back behind the walker before moving on
        const f = (now - t) / RESUME_MS, k = f * f * (3 - 2 * f), look = chase(walkS, total);
        cam.position.lerpVectors(p0, camPos, k);
        target.lerpVectors(t0, look, k);
      } else {
        const first = !resuming && walkElapsed === 0;
        walkElapsed += now - last;
        const f = Math.min(walkElapsed / walkMs, 1), look = chase(walkS = f * total, total);
        cam.position.lerp(camPos, first ? 1 : 0.08);
        target.lerp(look, first ? 1 : 0.2);
        if (f >= 1) {
          view.clampCamera(); showDot(walkS); MW.emit('walkProgress', walkS);
          view.setAnimation(null); setWalkState('idle'); MW.emit('cameraSettled');
          return;
        }
      }
      last = now;
      view.clampCamera();
      showDot(walkS);
      MW.emit('walkProgress', walkS);
      view.setAnimation(requestAnimationFrame(step));
    })();
  }
  function startWalk() {
    if (!current) return;
    stopWalk();
    const total = current.d[current.d.length - 1];
    walkMs = Math.min(Math.max(total * WALK_MS.perMetre, WALK_MS.min), WALK_MS.max);
    walkElapsed = 0; walkS = 0;
    draw(WALK_RADIUS);
    run(false);
  }
  function resumeWalk() { if (walkState === 'paused' && current) run(true); }

  MW.routes = {
    find, WALK_MS,
    init() {
      MW.on('selection', () => { stopWalk(); MW.walker.hide(); current = MW.state.to ? find(MW.state.from, MW.state.to) : null; draw(); });
      MW.on('walk', st => { if (st === 'idle') draw(); });
      MW.on('exaggeration', () => { draw(walkState === 'walking' ? WALK_RADIUS : undefined); if (walkState === 'paused') showDot(walkS); });
      MW.on('beforeRender', placeBlockedLabel);
      MW.on('language', () => { blockedLabel.textContent = MW.t('route.blockedLabel'); });
      const refit = limit => { if (mesh && walkState !== 'walking' && Math.abs(tubeRadius() / lastRadius - 1) > limit) draw(); };
      MW.on('cameraSettled', () => refit(0.25));
      MW.on('interrupted', pauseWalk);   // a drag or click on the map pauses the walk-through
      // keep the line readable at any zoom: rebuild the tube when its on-screen width drifts
      view.controls.addEventListener('end', () => refit(0.25));
      view.renderer.domElement.addEventListener('wheel', () => refit(0.4), { passive: true });
    },
    current() { return current; },
    showDot, hideDot() { MW.walker.hide(); },
    scenePoints() { return current ? scenePoints(current, 10) : [MW.markers.scenePosition(MW.state.from), MW.markers.scenePosition(MW.state.to)]; },
    startWalk, stopWalk, pauseWalk, resumeWalk,
    walkState() { return walkState; },
    isWalking() { return walkState !== 'idle'; },   // walking or paused: the walk-through owns the walker
  };
})();
