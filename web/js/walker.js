'use strict';
// Walk-through figure (astronaut, rover or plain dot) built from Three.js primitives. It stands on the
// terrain, faces the direction of travel, keeps a similar size on screen and is never hidden by the route line.
(() => {
  const { view, colors: C } = MW;
  const SIZE_PER_DISTANCE = 0.05, MIN_SIZE = 6, MAX_SIZE = 500;   // figure height in scene units
  const lit = color => new THREE.MeshLambertMaterial({ color });
  const MAT = { body: lit(C.walker), trim: lit(C.walkerTrim), dark: new THREE.MeshBasicMaterial({ color: C.walkerDark }),
    dot: new THREE.MeshBasicMaterial({ color: C.walker }) };

  // Each model is one unit tall, feet at the origin, facing +z
  function part(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    return m;
  }
  // Astronaut: rounded suit, gold visor, life-support backpack and chest unit. Legs and arms hang from
  // pivots at the hips and shoulders so they can swing while the walk-through plays.
  const VISOR = new THREE.MeshLambertMaterial({ color: C.walkerVisor, emissive: C.walkerVisor, emissiveIntensity: 0.25 });
  const swing = { legs: [], arms: [] };
  function astronaut() {
    const g = new THREE.Group(), capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 12);
    [-1, 1].forEach(side => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.085, 0.46, 0);
      hip.add(part(capsule(0.068, 0.3), MAT.body, 0, -0.2, 0));                        // leg
      hip.add(part(new THREE.CylinderGeometry(0.074, 0.074, 0.05, 14), MAT.trim, 0, -0.17, 0));   // knee band
      hip.add(part(new THREE.BoxGeometry(0.12, 0.08, 0.2), MAT.trim, 0, -0.42, 0.03));  // boot
      g.add(hip); swing.legs.push({ pivot: hip, side });
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.215, 0.79, 0);
      shoulder.rotation.z = side * 0.12;
      shoulder.add(part(capsule(0.052, 0.27), MAT.body, 0, -0.18, 0));                  // arm
      shoulder.add(part(new THREE.SphereGeometry(0.058, 12, 10), MAT.trim, 0, -0.36, 0));   // glove
      g.add(shoulder); swing.arms.push({ pivot: shoulder, side });
    });
    const torso = part(capsule(0.165, 0.2), MAT.body, 0, 0.66, 0);
    torso.scale.z = 0.78;
    g.add(torso);
    g.add(part(new THREE.CylinderGeometry(0.168, 0.168, 0.05, 20), MAT.trim, 0, 0.5, 0));       // waist ring
    g.add(part(new THREE.BoxGeometry(0.17, 0.1, 0.06), MAT.trim, 0, 0.66, 0.135));              // chest control unit
    g.add(part(new THREE.BoxGeometry(0.11, 0.025, 0.012), MAT.dark, 0, 0.68, 0.168));           // its display
    g.add(part(new THREE.BoxGeometry(0.33, 0.42, 0.15), MAT.trim, 0, 0.69, -0.2));              // backpack
    g.add(part(new THREE.BoxGeometry(0.27, 0.07, 0.1), MAT.body, 0, 0.92, -0.2));               // backpack top
    const neck = part(new THREE.TorusGeometry(0.11, 0.022, 8, 20), MAT.trim, 0, 0.86, 0);   // neck ring
    neck.rotation.x = Math.PI / 2;
    g.add(neck);
    g.add(part(new THREE.SphereGeometry(0.14, 24, 16), MAT.body, 0, 0.97, 0));                  // helmet
    // gold visor: front cap of a slightly larger sphere
    g.add(part(new THREE.SphereGeometry(0.144, 24, 12, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.6, 0.95), VISOR, 0, 0.975, 0));
    return g;
  }
  // Legs and arms swing in opposite phase while walking; standing still, they rest
  function pose(phase) {
    const a = phase === null ? 0 : Math.sin(phase) * 0.45;
    swing.legs.forEach(l => { l.pivot.rotation.x = a * l.side; });
    swing.arms.forEach(r => { r.pivot.rotation.x = -a * r.side * 0.8; });
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
  // Drawn after the route tube, which does not write depth: the line never hides the figure (the terrain still does)
  root.traverse(o => { if (o.isMesh) o.renderOrder = 2; });
  const STEPS_PER_SECOND = 1.6;
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
    pose(MW.routes && MW.routes.walkState() === 'walking' ? performance.now() / 1000 * STEPS_PER_SECOND * Math.PI : null);
  }
  const head = new THREE.Vector3();

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
    visible() { return root.visible; },
    // Scene position just above the figure's head, for the floating label
    top() { return head.copy(root.position).setY(root.position.y + root.scale.y * 1.12); },
    setKind, kind() { return kind; },
    buildRover: rover,   // a new rover model (one unit tall, facing +z) for the track
  };
})();
