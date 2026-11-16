'use strict';
// Short tutorial shown on every page load: a few bubbles pointing at parts of the screen. It never blocks the map
// (the highlight ignores the pointer) and can be skipped or replayed with the "?" button.
(() => {
  const STEPS = [
    { sel: '#selTo', tab: 'route', key: 'tour.1' },
    { sel: '#segLoad', tab: 'route', key: 'tour.2' },
    { sel: '#tabs', key: 'tour.3' },
    { sel: '#navMode', key: 'tour.4' },
  ];
  const PAD = 6, GAP = 14, t = MW.t;
  let ring = null, bubble = null, index = -1;

  function place() {
    const r = document.querySelector(STEPS[index].sel).getBoundingClientRect();
    Object.assign(ring.style, { left: `${r.left - PAD}px`, top: `${r.top - PAD}px`, width: `${r.width + 2 * PAD}px`, height: `${r.height + 2 * PAD}px` });
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const left = r.right + GAP + w < innerWidth ? r.right + GAP : Math.max(r.left - GAP - w, 12);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${Math.min(Math.max(r.top, 12), innerHeight - h - 12)}px`;
  }
  function end() {
    ring.hidden = bubble.hidden = true;
    index = -1;
  }
  function show(i) {
    if (i >= STEPS.length) { end(); return; }
    index = i;
    const step = STEPS[i], lastStep = i === STEPS.length - 1;
    if (step.tab) MW.tabs.show(step.tab);
    ring.hidden = bubble.hidden = false;
    bubble.innerHTML = `<p>${t(step.key)}</p><div class="row"><span class="muted">${t('tour.step', i + 1, STEPS.length)}</span>` +
      `<span><button data-act="skip">${t('tour.skip')}</button> <button data-act="next" class="primary">${t(lastStep ? 'tour.done' : 'tour.next')}</button></span></div>`;
    place();
  }

  MW.tour = {
    start() { show(0); },
    init() {
      ring = document.createElement('div'); ring.id = 'tourRing'; ring.hidden = true;
      bubble = document.createElement('div'); bubble.id = 'tourBubble'; bubble.className = 'panel'; bubble.hidden = true;
      document.body.append(ring, bubble);
      bubble.addEventListener('click', ev => {
        const act = ev.target.dataset.act;
        if (act === 'next') show(index + 1); else if (act === 'skip') end();
      });
      document.getElementById('btnHelp').addEventListener('click', () => show(0));
      MW.on('language', () => { if (index >= 0) show(index); });
      addEventListener('resize', () => { if (index >= 0) place(); });
      MW.on('introDone', () => { if (!MW.quick) show(0); });   // every page load; "Skip" closes it for this visit
    },
  };
})();
