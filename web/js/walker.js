'use strict';
// Walk-through figure (astronaut, rover or plain dot) built from Three.js primitives. It stands on the
// terrain, faces the direction of travel and keeps a similar size on screen.
(() => {
  const { view, colors: C } = MW;
  const SIZE_PER_DISTANCE = 0.035, MIN_SIZE = 5, MAX_SIZE = 350;   // figure height in scene units
  const lit = color => new THREE.MeshLambertMaterial({ color });
  const MAT = { body: lit(C.walker), trim: lit(C.walkerTrim), dark: new THREE.MeshBasicMaterial({ color: C.walkerDark }),
    dot: new THREE.MeshBasicMaterial({ color: C.walker }) };

  // Each model is one unit tall, feet at the origin, facing +z
  function part(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    return m;
  }
  function astronaut() {
    const g = new THREE.Group(), limb = (r, h) => new THREE.CylinderGeometry(r, r, h, 10);
    g.add(part(limb(0.07, 0.42), MAT.trim, -0.09, 0.21, 0), part(limb(0.07, 0.42), MAT.trim, 0.09, 0.21, 0));
    g.add(part(new THREE.BoxGeometry(0.38, 0.4, 0.24), MAT.body, 0, 0.6, 0));
    const armL = part(limb(0.055, 0.38), MAT.body, -0.25, 0.58, 0), armR = armL.clone();
    armL.rotation.z = -0.15; armR.position.x = 0.25; armR.rotation.z = 0.15;
    g.add(armL, armR);
    g.add(part(new THREE.BoxGeometry(0.32, 0.38, 0.13), MAT.trim, 0, 0.63, -0.18));   // backpack
    g.add(part(new THREE.SphereGeometry(0.15, 20, 14), MAT.body, 0, 0.92, 0));      // helmet
    // dark visor: front cap of a slightly larger sphere
    g.add(part(new THREE.SphereGeometry(0.153, 20, 10, Math.PI / 2 - 0.85, 1.7, Math.PI / 2 - 0.55, 0.9), MAT.dark, 0, 0.93, 0));
    return g;
  }
  function rover() {
    const g = new THREE.Group();
    g.add(part(new THREE.BoxGeometry(0.62, 0.18, 1.0), MAT.body, 0, 0.42, 0));         // chassis
    g.add(part(new THREE.BoxGeometry(0.4, 0.14, 0.3), MAT.trim, 0, 0.58, -0.3));        // rear deck
    const wheel = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16);
    [-0.37, 0.37].forEach(x => [-0.38, 0, 0.38].forEach(z => {
      const w = part(wheel, MAT.dark, x, 0.15, z); w.rotation.z = Math.PI / 2; g.add(w);
    }));
    g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), MAT.trim, 0.18, 0.72, 0.36));   // mast
    g.add(part(new THREE.BoxGeometry(0.22, 0.1, 0.12), MAT.body, 0.18, 0.97, 0.38));           // camera head
    g.add(part(new THREE.BoxGeometry(0.16, 0.05, 0.02), MAT.dark, 0.18, 0.97, 0.445));         // lenses
    return g;
  }
  function dot() { return part(new THREE.SphereGeometry(0.35, 16, 12), MAT.dot, 0, 0.35, 0); }

  const root = new THREE.Group(), models = { astronaut: astronaut(), rover: rover(), dot: dot() };
  Object.values(models).forEach(m => root.add(m));
  root.visible = false;
  let kind = 'astronaut';

  function setKind(k) {
    kind = models[k] ? k : 'astronaut';
    Object.entries(models).forEach(([name, m]) => { m.visible = name === kind; });
    MW.emit('walkerKind', kind);
    view.requestRender();
  }
  function fitScreen() {
    if (!root.visible) return;
    const s = Math.min(Math.max(view.camera.position.distanceTo(root.position) * SIZE_PER_DISTANCE, MIN_SIZE), MAX_SIZE);
    root.scale.setScalar(s);
  }

  MW.walker = {
    init() {
      view.overlay.add(root);
      setKind(kind);
      MW.on('beforeRender', fitScreen);
    },
    // Stand on `feet` (scene vector on the terrain) facing the horizontal direction `dir`
    place(feet, dir) {
      root.position.copy(feet);
      if (dir && dir.x * dir.x + dir.z * dir.z > 1e-6) root.rotation.y = Math.atan2(dir.x, dir.z);
      root.visible = true;
      view.requestRender();
    },
    hide() { root.visible = false; view.requestRender(); },
    setKind, kind() { return kind; },
    buildRover: rover,   // a new rover model (one unit tall, facing +z) for the track
  };
})();
