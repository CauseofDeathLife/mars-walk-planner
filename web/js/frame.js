'use strict';
// Outline of the working area (where routes are computed): a ribbon lying on the terrain, wide enough to read
// as the limit of the study area. Where the square leaves the terrain data (east side of the strip) the
// outline is pulled inward to the data edge.
(() => {
  const { view } = MW, A = MW.terrain.area, INSET_M = 10, STEP_M = 10, LIFT = 4, PULL_STEP_M = 5, WIDTH_M = 14;
  const ribbon = new THREE.Mesh(new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ color: MW.colors.frame, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));

  // Centre line as [easting, northing] pairs, in order around the square
  function centreLine() {
    const e0 = A.x0 + INSET_M, e1 = A.x0 + A.cols * A.px - INSET_M, n0 = A.y0 - INSET_M, n1 = A.y0 - A.rows * A.py + INSET_M, pts = [];
    const ec = (e0 + e1) / 2, nc = (n0 + n1) / 2;
    // (de, dn): unit step toward the inside of the square for this edge
    const edge = (ea, na, eb, nb, de, dn) => {
      const n = Math.ceil(Math.hypot(eb - ea, nb - na) / STEP_M);
      for (let i = 0; i < n; i++) {
        const f = i / n;
        let e = ea + f * (eb - ea), nn = na + f * (nb - na);
        const reach = Math.abs(de ? ec - e : nc - nn);
        for (let d = 0; d < reach && !MW.inArea(e, nn); d += PULL_STEP_M) { e += de * PULL_STEP_M; nn += dn * PULL_STEP_M; }
        if (MW.inArea(e, nn)) pts.push([e, nn]);
      }
    };
    edge(e0, n0, e1, n0, 0, -1); edge(e1, n0, e1, n1, -1, 0); edge(e1, n1, e0, n1, 0, 1); edge(e0, n1, e0, n0, 1, 0);
    return pts;
  }

  function build() {
    const pts = centreLine().map(p => MW.toScene(p[0], p[1])), n = pts.length, pos = [], idx = [], half = WIDTH_M / 2;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], c = pts[i];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const centre = MW.fromScene(c[0], c[1]), zc = MW.elevationAt(centre[0], centre[1]);
      [-1, 1].forEach(side => {   // the two edges of the ribbon, each resting on the terrain
        const en = MW.fromScene(c[0] - dz * half * side, c[1] + dx * half * side), p = view.surface(en[0], en[1], LIFT, zc);
        pos.push(p.x, p.y, p.z);
      });
      const j = (i + 1) % n;
      idx.push(2 * i, 2 * i + 1, 2 * j, 2 * j, 2 * i + 1, 2 * j + 1);
    }
    ribbon.geometry.dispose();
    ribbon.geometry = new THREE.BufferGeometry();
    ribbon.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ribbon.geometry.setIndex(idx);
  }

  MW.frame = { init() { view.overlay.add(ribbon); build(); MW.on('exaggeration', build); } };
})();
