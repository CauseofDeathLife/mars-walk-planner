'use strict';
// Rovers standing on Curiosity's real track: stops where the rover took a Navcam panorama.
// Each one faces the way Curiosity was facing (yaw of the stop) and opens its photos when clicked.
(() => {
  const { view, data } = MW, stops = data.trackPhotos || [], items = [];
  const SIZE_PER_DISTANCE = 0.02, MIN_SIZE = 4, MAX_SIZE = 200;   // rover height in scene units
  let visible = true;

  function place() { items.forEach(it => it.group.position.copy(view.surface(it.stop.e, it.stop.n, 0, it.stop.z))); }
  function fitScreen() {
    if (!visible) return;
    const cam = view.camera.position;
    items.forEach(it => it.group.scale.setScalar(Math.min(Math.max(cam.distanceTo(it.group.position) * SIZE_PER_DISTANCE, MIN_SIZE), MAX_SIZE)));
  }

  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  MW.track = {
    init() {
      stops.forEach(stop => {
        const group = MW.walker.buildRover(), yaw = stop.yaw * Math.PI / 180;   // yaw: degrees clockwise from north
        group.rotation.y = Math.atan2(Math.sin(yaw), -Math.cos(yaw));            // the model faces +z (south)
        group.traverse(o => { o.userData.trackStop = stop; });
        view.overlay.add(group);
        items.push({ stop, group });
      });
      place();
      MW.on('exaggeration', place);
      MW.on('beforeRender', fitScreen);
      MW.on('stopsVisible', on => { visible = on; items.forEach(it => { it.group.visible = on; }); });
    },
    stops() { return stops; },
    // Stop under a screen position, or null
    pick(clientX, clientY) {
      if (!visible || !items.length) return null;
      mouse.set(clientX / innerWidth * 2 - 1, -clientY / innerHeight * 2 + 1);
      ray.setFromCamera(mouse, view.camera);
      const hit = ray.intersectObjects(items.map(it => it.group), true)[0];
      return hit ? hit.object.userData.trackStop : null;
    },
  };
})();
