'use strict';
// Entrance: Mars as a globe (Viking MDIM 2.1 mosaic) over decorative stars. A button flies down to Gale crater
// and hands over to the terrain. It has its own small renderer and canvas, disposed when the entrance ends.
(() => {
  const G = MW.data.globe, t = MW.t;
  const SPIN_RAD_S = 0.07, FLY_MS = 3400, FADE_MS = 700, FAR = 3.6, NEAR = 1.16, SIDE_SHIFT = 0.17;
  let box, renderer, scene, camera, globe, ring, galeLabel, raf = null, last = 0, fly = null, done = false;
  const galeLocal = new THREE.Vector3(), tmp = new THREE.Vector3();

  function texts() {
    box.querySelector('.intro-kicker').textContent = t('intro.kicker');
    box.querySelector('h1').textContent = t('app.title');
    box.querySelector('.intro-lead').textContent = t('intro.lead');
    box.querySelector('.intro-real').textContent = t('app.realNote');
    box.querySelector('#introGo').textContent = t('intro.go');
    box.querySelector('#introSkip').textContent = t('intro.skip');
    box.querySelector('.intro-credit').textContent = t('intro.credit');
    galeLabel.textContent = t('intro.gale');
    box.querySelectorAll('.intro-lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === MW.lang));
  }

  function setShift(k) {   // k = 1: globe to the right of the text; k = 0: centred
    const w = box.clientWidth, h = box.clientHeight;
    camera.aspect = w / h;
    camera.setViewOffset(w, h, -w * SIDE_SHIFT * k, 0, w, h);
    camera.updateProjectionMatrix();
  }

  function finish() {
    if (done) return;
    done = true;
    box.classList.add('out');
    setTimeout(() => {
      box.remove();
      MW.emit('introDone');   // first, so the tutorial starts even if releasing the renderer fails
      cancelAnimationFrame(raf);
      try { renderer.dispose(); } catch (e) { /* nothing else to release */ }
    }, FADE_MS);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!fly) globe.rotation.y += SPIN_RAD_S * dt;
    else {
      const f = Math.min((now - fly.start) / FLY_MS, 1), s = f * f * (3 - 2 * f);
      globe.rotation.y = fly.from + (fly.to - fly.from) * Math.min(s * 1.6, 1);   // the globe is already facing Gale before the dive ends
      const dist = FAR + (NEAR - FAR) * s * s;
      camera.position.copy(fly.dir).multiplyScalar(dist).lerp(tmp.set(0, 0.35, FAR), 1 - s);
      camera.lookAt(0, 0, 0);
      setShift(1 - s);
      ring.visible = true;
      if (f >= 1) finish();
    }
    // label over Gale while it is on the near side
    globe.updateMatrixWorld();
    tmp.copy(galeLocal).applyMatrix4(globe.matrixWorld);
    const facing = tmp.clone().normalize().dot(camera.position.clone().normalize()) > 0.25;
    tmp.project(camera);
    galeLabel.style.display = facing && fly ? '' : 'none';
    galeLabel.style.left = `${(tmp.x + 1) / 2 * box.clientWidth}px`;
    galeLabel.style.top = `${(1 - tmp.y) / 2 * box.clientHeight - 14}px`;
    renderer.render(scene, camera);
  }

  function start() {
    if (fly) return;
    const lonLat = MW.toLonLat(MW.data.meta.area_center[0], MW.data.meta.area_center[1]);
    const lat = lonLat[1] * Math.PI / 180, target = -Math.PI / 2 - lonLat[0] * Math.PI / 180;
    let to = target;
    while (to < globe.rotation.y) to += 2 * Math.PI;
    fly = { start: performance.now(), from: globe.rotation.y, to, dir: new THREE.Vector3(0, Math.sin(lat), Math.cos(lat)) };
    box.classList.add('flying');
  }

  MW.intro = {
    init() {
      if (!G || MW.quick) { setTimeout(() => MW.emit('introDone'), 0); return; }
      box = document.createElement('div');
      box.id = 'intro';
      box.innerHTML = '<div class="intro-text"><div class="intro-team"></div><div class="intro-kicker"></div><h1></h1><p class="intro-lead"></p><p class="intro-real"></p>' +
        '<div class="intro-actions"><button id="introGo" class="primary"></button><button id="introSkip"></button></div>' +
        `<div class="intro-lang seg">${MW.langButtons()}</div></div>` +
        '<div class="label to intro-gale"></div><div class="intro-credit"></div>';
      document.body.appendChild(box);
      galeLabel = box.querySelector('.intro-gale');
      const E = MW.data.emblem;
      if (E) box.querySelector('.intro-team').innerHTML = `<img alt="" src="data:${E.mime || 'image/jpeg'};base64,${E.b64}"><span>${E.team}</span>`;
      try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { box.remove(); setTimeout(() => MW.emit('introDone'), 0); return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(box.clientWidth, box.clientHeight);
      box.insertBefore(renderer.domElement, box.firstChild);
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x03040a);
      camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
      camera.position.set(0, 0.35, FAR);
      camera.lookAt(0, 0, 0);
      scene.add(MW.sky.makeStars(1800, 90, -1));
      scene.add(new THREE.AmbientLight(0xffffff, 0.3));
      const sun = new THREE.DirectionalLight(0xffffff, 1.05);
      sun.position.set(-2.2, 1.2, 2.6);
      scene.add(sun);
      const tex = new THREE.TextureLoader().load('data:image/jpeg;base64,' + G.b64);
      tex.anisotropy = 8;
      delete G.b64;
      globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ map: tex }));
      scene.add(globe);
      // Gale crater on the globe: longitude 0 of the mosaic faces +x, east longitudes turn towards -z
      const ll = MW.toLonLat(MW.data.meta.area_center[0], MW.data.meta.area_center[1]), lon = ll[0] * Math.PI / 180, lat = ll[1] * Math.PI / 180;
      galeLocal.set(Math.cos(lon) * Math.cos(lat), Math.sin(lat), -Math.sin(lon) * Math.cos(lat));
      ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.027, 40), new THREE.MeshBasicMaterial({ color: MW.colors.route, side: THREE.DoubleSide }));
      globe.add(ring);
      ring.position.copy(galeLocal).multiplyScalar(1.003);
      ring.lookAt(galeLocal.clone().multiplyScalar(3));
      ring.visible = false;
      globe.rotation.y = 1.2;   // set after the ring is oriented, while the globe's local and world axes still coincide
      setShift(1);
      box.querySelector('#introGo').addEventListener('click', start);
      box.querySelector('#introSkip').addEventListener('click', finish);
      box.querySelectorAll('.intro-lang button').forEach(b => b.addEventListener('click', () => MW.setLang(b.dataset.lang)));
      MW.on('language', () => { if (!done) texts(); });
      addEventListener('resize', () => { if (done) return; renderer.setSize(box.clientWidth, box.clientHeight); setShift(fly ? 0 : 1); });
      texts();
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
  };
})();
