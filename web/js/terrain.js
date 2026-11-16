'use strict';
// Terrain grids (uint16-quantised elevations), elevation/slope lookups and the two meshes:
// the whole DTM at 10 m for context and the working area at 5 m. Each mesh can also wear the HiRISE orthoimage.
(() => {
  const { data, ref } = MW, Q = data.quant;
  const ELEV_RAMP = [[0, [0.23, 0.12, 0.08]], [0.35, [0.55, 0.29, 0.17]], [0.7, [0.80, 0.55, 0.34]], [1, [0.96, 0.84, 0.66]]];
  const SLOPE_CLASSES = [[5, [0.30, 0.62, 0.36]], [10, [0.62, 0.70, 0.30]], [15, [0.92, 0.72, 0.26]], [Infinity, [0.76, 0.22, 0.17]]];
  const NO_DATA_COLOR = [0.25, 0.25, 0.27], PHOTO_MIN_DIM = 0.9;
  const MARS_TINT = [1, 0.70, 0.47];   // approximate colour for the tinted photo layer; not a measured colour

  function prepare(g) {
    const bin = atob(g.b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const q = new Uint16Array(bytes.buffer), n = g.rows * g.cols;
    g.elev = new Float32Array(n);
    for (let i = 0; i < n; i++) g.elev[i] = q[i] ? Q.zmin + (q[i] - 1) * Q.step : NaN;
    g.slope = new Float32Array(n).fill(NaN);
    const dx = 2 * g.px * ref.k, dy = 2 * g.py, C = g.cols;
    for (let r = 1; r < g.rows - 1; r++) for (let c = 1; c < C - 1; c++) {
      const i = r * C + c;
      g.slope[i] = Math.atan(Math.hypot((g.elev[i + 1] - g.elev[i - 1]) / dx, (g.elev[i + C] - g.elev[i - C]) / dy)) * 180 / Math.PI;
    }
    delete g.b64;
    return g;
  }
  const area = prepare(data.area), overview = prepare(data.overview);

  function bilinear(g, e, n) {
    const col = (e - g.x0) / g.px - 0.5, row = (g.y0 - n) / g.py - 0.5;
    const c0 = Math.floor(col), r0 = Math.floor(row);
    if (c0 < 0 || r0 < 0 || c0 >= g.cols - 1 || r0 >= g.rows - 1) return null;
    const i = r0 * g.cols + c0, fc = col - c0, fr = row - r0;
    const v = g.elev[i] * (1 - fc) * (1 - fr) + g.elev[i + 1] * fc * (1 - fr) + g.elev[i + g.cols] * (1 - fc) * fr + g.elev[i + g.cols + 1] * fc * fr;
    return Number.isNaN(v) ? null : v;
  }
  function nearestSlope(g, e, n) {
    const c = Math.floor((e - g.x0) / g.px), r = Math.floor((g.y0 - n) / g.py);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return null;
    const v = g.slope[r * g.cols + c];
    return Number.isNaN(v) ? null : v;
  }

  MW.elevationAt = (e, n) => { const v = bilinear(area, e, n); return v !== null ? v : bilinear(overview, e, n); };
  MW.slopeAt = (e, n) => { const v = nearestSlope(area, e, n); return v !== null ? v : nearestSlope(overview, e, n); };
  // Height of the displayed terrain in scene units (already exaggerated), or null outside the data
  MW.groundY = (x, z) => {
    const en = MW.fromScene(x, z), v = MW.elevationAt(en[0], en[1]);
    return v === null ? null : (v - ref.elevation) * MW.state.exag;
  };
  MW.inArea = (e, n) => bilinear(area, e, n) !== null;

  function rampColor(t, out) {
    t = Math.min(Math.max(t, 0), 1);
    for (let i = 1; i < ELEV_RAMP.length; i++) if (t <= ELEV_RAMP[i][0]) {
      const [a, ca] = ELEV_RAMP[i - 1], [b, cb] = ELEV_RAMP[i], f = (t - a) / (b - a);
      for (let j = 0; j < 3; j++) out[j] = ca[j] + f * (cb[j] - ca[j]);
      return;
    }
  }
  function paint(g, mode) {
    const col = g.mesh.geometry.attributes.color, c = [0, 0, 0], lo = data.stats.area_zmin, span = data.stats.area_zmax - lo;
    for (let i = 0; i < g.elev.length; i++) {
      if (mode === 'slope') {
        const s = g.slope[i];
        const cls = Number.isNaN(s) ? NO_DATA_COLOR : SLOPE_CLASSES.find(k => s <= k[0])[1];
        c[0] = cls[0]; c[1] = cls[1]; c[2] = cls[2];
      } else rampColor((g.elev[i] - lo) / span, c);
      col.setXYZ(i, c[0] * g.dim, c[1] * g.dim, c[2] * g.dim);
    }
    col.needsUpdate = true;
  }

  function buildMesh(g, hole, dim, photo) {
    const R = g.rows, C = g.cols, n = R * C, pos = new Float32Array(n * 3), uv = photo ? new Float32Array(n * 2) : null;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const i = r * C + c, s = MW.toScene(g.x0 + (c + 0.5) * g.px, g.y0 - (r + 0.5) * g.py);
      pos[3 * i] = s[0]; pos[3 * i + 1] = Number.isNaN(g.elev[i]) ? 0 : g.elev[i] - ref.elevation; pos[3 * i + 2] = s[1];
      if (uv) {   // texture coordinates from the same projected metres as the terrain
        uv[2 * i] = (g.x0 + (c + 0.5) * g.px - photo.x0) / (photo.x1 - photo.x0);
        uv[2 * i + 1] = 1 - (photo.y0 - (g.y0 - (r + 0.5) * g.py)) / (photo.y0 - photo.y1);
      }
    }
    const idx = [];
    for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
      const a = r * C + c, b = a + 1, d = a + C, e = d + 1;
      if (Number.isNaN(g.elev[a] + g.elev[b] + g.elev[d] + g.elev[e])) continue;
      if (hole) {
        const ee = g.x0 + (c + 1) * g.px, nn = g.y0 - (r + 1) * g.py;
        if (ee > hole.e0 && ee < hole.e1 && nn < hole.n0 && nn > hole.n1) continue;
      }
      idx.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    geo.computeVertexNormals();
    g.dim = dim;
    g.colorMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    if (photo) {   // the photo already carries the real shading of the Sun, so it is drawn unlit
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const tex = new THREE.TextureLoader().load('data:image/jpeg;base64,' + photo.b64, () => { if (MW.view) MW.view.requestRender(); });
      tex.anisotropy = 8;
      const shade = Math.max(dim, PHOTO_MIN_DIM);   // the context strip stays almost as bright as the working area
      g.photoMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(shade, shade, shade) });
      g.shade = shade;
      delete photo.b64;
    }
    g.mesh = new THREE.Mesh(geo, g.colorMat);
    return g.mesh;
  }

  MW.terrain = {
    area, overview,
    build(world) {
      const m = 3 * area.px;   // overlap so no gap shows between the two meshes
      const hole = { e0: area.x0 + m, e1: area.x0 + area.cols * area.px - m, n0: area.y0 - m, n1: area.y0 - area.rows * area.py + m };
      const ortho = data.ortho || {};
      world.add(buildMesh(overview, hole, 0.6, ortho.overview));
      world.add(buildMesh(area, null, 1, ortho.area));
      this.setMode(MW.state.mode);
      return (overview.mesh.geometry.index.count + area.mesh.geometry.index.count) / 3;
    },
    setMode(mode) {
      [overview, area].forEach(g => {
        const wantsPhoto = mode === 'photo' || mode === 'tint', photo = wantsPhoto && g.photoMat;
        g.mesh.material = photo ? g.photoMat : g.colorMat;
        if (photo) {
          const k = mode === 'tint' ? MARS_TINT : [1, 1, 1];
          g.photoMat.color.setRGB(g.shade * k[0], g.shade * k[1], g.shade * k[2]);
        } else paint(g, wantsPhoto ? 'elev' : mode);
      });
    },
    hasPhoto() { return !!area.photoMat; },
    meshes() { return [area.mesh, overview.mesh]; },
    elevCss() { return `linear-gradient(90deg, ${ELEV_RAMP.map(s => `rgb(${s[1].map(v => Math.round(v * 255)).join(',')}) ${s[0] * 100}%`).join(', ')})`; },
    // Slope classes as [upper limit in degrees, CSS colour] for legends
    slopeClasses() { return SLOPE_CLASSES.map(k => [k[0], `rgb(${k[1].map(v => Math.round(v * 255)).join(',')})`]); },
    slopeCss() {
      const rgb = k => `rgb(${k[1].map(v => Math.round(v * 255)).join(',')})`, s = SLOPE_CLASSES;
      return `linear-gradient(90deg, ${rgb(s[0])} 0 25%, ${rgb(s[1])} 25% 50%, ${rgb(s[2])} 50% 75%, ${rgb(s[3])} 75% 100%)`;
    },
  };
})();
