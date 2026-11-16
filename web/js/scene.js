'use strict';
// Renderer, camera and orbit controls. Renders on demand (no continuous loop) and keeps the camera
// and the orbit target on or above the terrain at all times.
(() => {
  const CAMERA_CLEARANCE = 8;       // scene units above the exaggerated terrain
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.getElementById('view').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090c);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 2, 90000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.rotateSpeed = 0.45;
  controls.minDistance = 25;
  controls.maxDistance = 26000;
  controls.screenSpacePanning = false;   // "Mover" slides over the ground plane; clampCamera then sets the height
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a22, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-1, 1.2, -0.6);
  scene.add(sun);

  const world = new THREE.Group();     // terrain; its y scale is the vertical exaggeration
  const overlay = new THREE.Group();   // markers and routes, placed with the exaggeration applied
  scene.add(world, overlay);

  let pending = false;
  function requestRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      camera.updateMatrixWorld();
      MW.emit('beforeRender');   // screen-sized overlays are fitted to the camera of this very frame
      renderer.render(scene, camera);
      MW.emit('rendered');
    });
  }

  // Terrain under a position; outside the data, the first terrain found towards the orbit target
  function floorUnder(p, toward) {
    let y = MW.groundY(p.x, p.z);
    if (y !== null) return y;
    const dx = toward.x - p.x, dz = toward.z - p.z, steps = Math.min(Math.ceil(Math.hypot(dx, dz) / 20), 600);
    for (let i = 1; i <= steps; i++) {
      y = MW.groundY(p.x + dx * i / steps, p.z + dz * i / steps);
      if (y !== null) return y;
    }
    return null;
  }

  const lastTarget = new THREE.Vector3();
  function clampCamera() {
    const t = controls.target;
    let ground = MW.groundY(t.x, t.z);
    if (ground === null) {             // the orbit target never leaves the map
      camera.position.add(lastTarget.clone().sub(t));
      t.copy(lastTarget);
      ground = MW.groundY(t.x, t.z);
    }
    if (ground !== null) { camera.position.y += ground - t.y; t.y = ground; }
    const floor = floorUnder(camera.position, t);
    if (floor !== null && camera.position.y < floor + CAMERA_CLEARANCE) camera.position.y = floor + CAMERA_CLEARANCE;
    lastTarget.copy(t);
    camera.lookAt(t);
  }
  controls.addEventListener('change', () => { clampCamera(); requestRender(); });

  let animation = null;
  function stopAnimation() { if (animation) { cancelAnimationFrame(animation); animation = null; } }
  // Move camera and target smoothly; the path is clamped every frame so it never dips under terrain
  function flyTo(position, target, ms = 700) {
    stopAnimation();
    const p0 = camera.position.clone(), t0 = controls.target.clone(), start = performance.now();
    (function step() {
      const f = ms > 0 ? Math.min((performance.now() - start) / ms, 1) : 1, s = f * f * (3 - 2 * f);
      camera.position.lerpVectors(p0, position, s);
      controls.target.lerpVectors(t0, target, s);
      clampCamera();
      requestRender();
      animation = f < 1 ? requestAnimationFrame(step) : null;
      if (f >= 1) MW.emit('cameraSettled');
    })();
  }
  // Frame a set of scene points keeping the current viewing direction (not flatter than 40° from above)
  function frame(points, ms) {
    const sphere = new THREE.Box3().setFromPoints(points).getBoundingSphere(new THREE.Sphere());
    const dist = Math.max(sphere.radius, 120) / Math.sin(camera.fov * Math.PI / 360) * 1.15;
    const dir = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(dir);
    sph.phi = Math.min(sph.phi, 50 * Math.PI / 180); sph.radius = dist;
    flyTo(sphere.center.clone().add(new THREE.Vector3().setFromSpherical(sph)), sphere.center, ms);
  }
  function northUp() {
    const d = camera.position.clone().sub(controls.target), sph = new THREE.Spherical().setFromVector3(d);
    sph.theta = 0;
    flyTo(controls.target.clone().add(new THREE.Vector3().setFromSpherical(sph)), controls.target.clone(), 500);
  }
  // Azimuth the camera looks towards, degrees clockwise from north
  function heading() {
    const d = controls.target.clone().sub(camera.position);
    return (Math.atan2(d.x, -d.z) * 180 / Math.PI + 360) % 360;
  }

  // Navigation mode: which gesture a left-button drag (or one finger) does; the right button does the other
  const NAV_HINT = {
    rotate: 'nav.hintRotate',
    pan: 'nav.hintPan',
  };
  let navMode = 'rotate';
  function setNavMode(mode) {
    navMode = mode;
    const pan = mode === 'pan';
    controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    controls.touches.ONE = pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    document.querySelectorAll('#navMode button').forEach(b => {
      b.classList.toggle('on', b.dataset.nav === mode);
      b.setAttribute('aria-pressed', b.dataset.nav === mode);
    });
    document.getElementById('navHint').innerHTML = MW.t(NAV_HINT[mode]);
  }
  document.querySelectorAll('#navMode button').forEach(b => b.addEventListener('click', () => setNavMode(b.dataset.nav)));
  setNavMode('rotate');
  MW.on('language', () => setNavMode(navMode));

  renderer.domElement.addEventListener('pointerdown', () => { if (animation) { stopAnimation(); MW.emit('interrupted'); } });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); requestRender();
  });

  MW.view = {
    renderer, scene, camera, controls, world, overlay, requestRender, clampCamera, flyTo, frame, northUp, heading, stopAnimation,
    setAnimation(id) { animation = id; },
    setExaggeration(v) {
      const old = MW.state.exag;
      MW.state.exag = v; world.scale.y = v;
      camera.position.y = controls.target.y * (v / old) + (camera.position.y - controls.target.y);
      controls.target.y *= v / old;
      MW.emit('exaggeration', v);
      clampCamera(); requestRender();
    },
    // Scene position on the displayed terrain, lifted by `lift` scene units
    surface(e, n, lift = 0, fallbackElev = null) {
      const s = MW.toScene(e, n);
      let v = MW.elevationAt(e, n);
      if (v === null) v = fallbackElev === null ? MW.ref.elevation : fallbackElev;
      return new THREE.Vector3(s[0], (v - MW.ref.elevation) * MW.state.exag + lift, s[1]);
    },
  };
})();
