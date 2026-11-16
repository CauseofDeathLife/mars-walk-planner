'use strict';
// Fixed compass rose: the needle always points to Mars north; a click turns the view north-up.
(() => {
  const needle = document.getElementById('needle');
  MW.compass = {
    init() {
      MW.on('rendered', () => needle.setAttribute('transform', `rotate(${-MW.view.heading()})`));
      document.getElementById('compass').addEventListener('click', () => MW.view.northUp());
    },
  };
})();
