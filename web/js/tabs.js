'use strict';
// Panel tabs: Route / Map / Mars today / Data. Picking a destination brings the Route tab forward.
(() => {
  const buttons = () => document.querySelectorAll('#tabs button'), panes = () => document.querySelectorAll('#panel .tab');
  function show(name) {
    buttons().forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    panes().forEach(p => { p.hidden = p.dataset.tab !== name; });
    document.getElementById('panel').scrollTop = 0;
  }
  MW.tabs = {
    show,
    init() {
      buttons().forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
      let lastTo = MW.state.to;
      MW.on('selection', () => { if (MW.state.to && MW.state.to !== lastTo) show('route'); lastTo = MW.state.to; });
      show('route');
    },
  };
})();
