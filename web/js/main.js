'use strict';
// Start-up: build the terrain, place the camera south of the working area looking north, wire modules.
(() => {
  const t0 = performance.now(), { view, data } = MW;
  view.world.scale.y = MW.state.exag;
  const triangles = MW.terrain.build(view.world);
  MW.markers.init();
  MW.walker.init();
  MW.track.init();
  MW.frame.init();
  MW.routes.init();
  MW.profile.init();
  MW.compass.init();
  MW.legend.init();
  MW.weather.init();
  MW.spaceweather.init();
  MW.validation.init();
  MW.photos.init();
  MW.ui.init();
  MW.tabs.init();
  MW.sky.init();
  MW.tour.init();
  MW.intro.init();
  MW.themepick.init();
  const E = data.emblem, teamBox = document.getElementById('team');
  if (E) teamBox.querySelector('img').src = `data:image/jpeg;base64,${E.b64}`; else teamBox.hidden = true;
  if (E) teamBox.querySelector('img').addEventListener('click', ev => ev.currentTarget.classList.toggle('big'));

  const centre = view.surface(data.meta.area_center[0], data.meta.area_center[1]);
  view.controls.target.copy(centre);
  view.camera.position.set(centre.x, centre.y + 2900, centre.z + 3300);
  view.clampCamera();
  MW.emit('selection');
  view.requestRender();
  requestAnimationFrame(() => {
    const seconds = (performance.now() - t0) / 1000, ok = data.routes.filter(r => r.ok).length;
    const status = () => {
      document.getElementById('status').innerHTML = MW.t('status.loaded', MW.fmt(seconds, 1), MW.fmt(triangles / 1e6, 2), data.points.length, ok);
    };
    status();
    MW.on('language', status);
  });
  window.MW = MW;   // exposed for the headless checks
})();
