'use strict';
// What Curiosity studied at each target stop, with the mission blog post it comes from.
// Texts live in i18n.js (sci.<sol>); only the source links are here.
(() => {
  const BLOG = 'https://science.nasa.gov/';
  const SOURCES = {
    4071: 'missions/mars-science-laboratory/sols-4070-4072-so-many-textures-so-little-time/',
    4298: 'blog/sols-4300-4301-rippled-pages/',
    4389: 'blog/sols-4389-4390-a-wealth-of-ripples-nodules-and-veins',
    4532: 'blog/sols-4532-4533-polygon-heaven',
    4600: 'blog/curiosity-blog-sols-4804-4811-kicking-off-the-final-phase-of-boxwork-exploration',
    4865: 'blog/curiosity-blog-sols-4867-4872-sand-fill-in-antofagasta-crater-and-finding-our-next-drill-target',
    4987: 'blog/curiosity-blog-sols-4982-4987-back-to-our-regularly-scheduled-programming/',
  };
  MW.science = {
    // Block for the result card, or '' when the destination is not a Curiosity stop with a known goal
    html(point) {
      if (!point || point.kind !== 'target' || !SOURCES[point.sol]) return '';
      return `<div class="science"><h4>${MW.t('sci.title')}</h4><p>${MW.t(`sci.${point.sol}`)}</p>` +
        `<p class="note"><a href="${BLOG}${SOURCES[point.sol]}" target="_blank" rel="noopener">${MW.t('sci.source')}</a></p></div>`;
    },
  };
})();
