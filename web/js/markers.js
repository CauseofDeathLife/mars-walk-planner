'use strict';
// Fixed points (habitat, targets, isolated areas) with HTML labels, plus Curiosity's real stops.
// Markers keep a constant size on screen; clicking one makes it the destination.
(() => {
  const { view, data } = MW;
  const C = MW.colors, BASE = { habitat: C.habitat, target: C.target, isolated: C.isolated };
  const ROLE_COLOR = { from: C.from, to: C.to, blocked: C.blocked };
  const labelLayer = document.getElementById('labels');
  const items = [];
  const TRIM = new THREE.MeshLambertMaterial({ color: '#9aa3ad' });   // habitat details

  function makeMarker(p) {
    const group = new THREE.Group();
    const mat = p.kind === 'habitat' ? new THREE.MeshLambertMaterial({ color: BASE[p.kind] }) : new THREE.MeshBasicMaterial({ color: BASE[p.kind] });
    if (p.kind === 'habitat') {
      // small surface base: main dome, a cylindrical module joined by a tunnel, a smaller dome and an antenna
      const add = (geo, x, y, z, m = mat) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); group.add(o); return o; };
      const dome = r => new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      add(dome(1), 0, 0, 0);
      add(new THREE.CylinderGeometry(1.08, 1.08, 0.14, 28), 0, 0.07, 0, TRIM);
      add(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 16), 1.75, 0.42, 0).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10), 1.1, 0.3, 0, TRIM).rotation.z = Math.PI / 2;
      add(dome(0.55), -1.45, 0, 0.35);
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 10), -0.95, 0.22, 0.22, TRIM).rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), 0.35, 1.6, -0.3, TRIM);
      add(new THREE.SphereGeometry(0.13, 10, 8), 0.35, 2.4, -0.3, TRIM);
      add(new THREE.BoxGeometry(0.34, 0.5, 0.08), 0, 0.27, 1.0, TRIM);   // airlock door
    } else {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), mat);
      stem.position.y = 1.1; group.add(stem);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), mat);
      head.position.y = 2.6; group.add(head);
    }
    group.traverse(o => { o.userData.pointId = p.id; });
    const label = document.createElement('div');
    label.className = `label ${p.kind}`; label.textContent = MW.labelOf(p);
    labelLayer.appendChild(label);
    view.overlay.add(group);
    return { p, group, mat, label };
  }

  function place() { items.forEach(it => it.group.position.copy(view.surface(it.p.easting, it.p.northing, 0, it.p.elevation))); }

  const v = new THREE.Vector3();
  function updateScreen() {
    const cam = view.camera;
    items.forEach(it => {
      const s = Math.min(Math.max(cam.position.distanceTo(it.group.position) * 0.016, 2), 500);
      it.group.scale.setScalar(s);
      v.copy(it.group.position); v.y += s * (it.p.kind === 'habitat' ? 2.9 : 3.4);
      v.project(cam);
      const hidden = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1;
      it.label.style.display = hidden ? 'none' : '';
      it.label.style.left = `${(v.x + 1) / 2 * innerWidth}px`;
      it.label.style.top = `${(1 - v.y) / 2 * innerHeight}px`;
    });
  }

  function refreshSelection() {
    const { from, to } = MW.state, blocked = to && !MW.routes.find(from, to);
    items.forEach(it => {
      const role = it.p.id === from ? 'from' : it.p.id === to ? (blocked ? 'blocked' : 'to') : '';
      it.mat.color.set(ROLE_COLOR[role] || BASE[it.p.kind]);
      it.label.className = `label ${it.p.kind} ${role}`;
    });
  }

  // Curiosity's real track: a thin line through the aligned stops in sol order (the rovers with photos are in track.js)
  const STOP_LINE_LIFT = 4, STOP_LINE_STEP_M = 20, STOP_LINE_MAX_GAP_M = 1500;   // longer gaps: track left the DTM
  const stopsBySol = data.stops.slice().sort((a, b) => a[3] - b[3]);
  const stopLine = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.stops, depthWrite: false }));
  stopLine.renderOrder = 1;   // like the route: drawn before the walker, so it never crosses over the figure
  function placeStops() {
    // the line follows the terrain between consecutive stops, a little above it
    const pos = [];
    for (let i = 1; i < stopsBySol.length; i++) {
      const a = stopsBySol[i - 1], b = stopsBySol[i], len = Math.hypot((b[0] - a[0]) * MW.ref.k, b[1] - a[1]);
      if (len > STOP_LINE_MAX_GAP_M) continue;
      const n = Math.max(Math.ceil(len / STOP_LINE_STEP_M), 1);
      let prev = view.surface(a[0], a[1], STOP_LINE_LIFT, a[2]);
      for (let j = 1; j <= n; j++) {
        const f = j / n, q = view.surface(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), STOP_LINE_LIFT, a[2] + f * (b[2] - a[2]));
        pos.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
        prev = q;
      }
    }
    stopLine.geometry.dispose();
    stopLine.geometry = new THREE.BufferGeometry();
    stopLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  }
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  MW.markers = {
    init() {
      data.points.forEach(p => items.push(makeMarker(p)));
      view.overlay.add(stopLine);
      place(); placeStops();
      MW.on('exaggeration', () => { place(); placeStops(); });
      MW.on('beforeRender', updateScreen);
      MW.on('selection', refreshSelection);
      MW.on('language', () => items.forEach(it => { it.label.textContent = MW.labelOf(it.p); }));
    },
    setStopsVisible(on) { stopLine.visible = on; MW.emit('stopsVisible', on); view.requestRender(); },
    // Point id under a screen position, or null
    pick(clientX, clientY) {
      mouse.set(clientX / innerWidth * 2 - 1, -clientY / innerHeight * 2 + 1);
      ray.setFromCamera(mouse, view.camera);
      const hit = ray.intersectObjects(items.map(it => it.group), true)[0];
      return hit ? hit.object.userData.pointId : null;
    },
    scenePosition(id) { return items.find(it => it.p.id === id).group.position.clone(); },
  };
})();
