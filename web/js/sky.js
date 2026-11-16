'use strict';
// Decorative star field around the terrain scene (random points, not a real sky catalogue). It follows the camera.
(() => {
  const COUNT = 1400, RADIUS = 60000;
  function makeStars(count, radius, minY) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x, y, z, d;
      do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; d = Math.hypot(x, y, z); } while (d > 1 || d < 0.2 || y / d < minY);
      pos[3 * i] = x / d * radius; pos[3 * i + 1] = y / d * radius; pos[3 * i + 2] = z / d * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
  }
  MW.sky = {
    makeStars,
    init() {
      const stars = makeStars(COUNT, RADIUS, -0.05);
      MW.view.scene.add(stars);
      MW.on('beforeRender', () => stars.position.copy(MW.view.camera.position));
    },
  };
})();
