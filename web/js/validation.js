'use strict';
// "Validation" block of the panel: what was measured against published values, with its numbers,
// and what is still an assumption. Numbers come from the result files of the checks (build_page.py).
(() => {
  const V = MW.data.validation, f = MW.fmt;
  function render() {
    const routes = MW.data.routes, ok = routes.filter(r => r.ok);
    const v = {
      shiftMin: f(V.shift_min_m), shiftMax: f(V.shift_max_m), controlN: f(V.control_n), std: f(V.std_m, 2),
      routesOk: ok.length, routesBlocked: routes.length - ok.length, slopeMax: f(Math.max(...ok.map(r => r.maxSlope)), 1),
      limit: MW.data.meta.slope_limit_deg, readerErr: f(V.reader_max_err_mm, 2), readerN: f(V.reader_points),
      tiltN: f(V.tilt_n), slopeMean: f(V.slope_mean_deg, 1), tiltMean: f(V.tilt_mean_deg, 1), pearson: f(V.pearson_r, 2), pearsonGoal: f(V.pearson_goal, 1),
      orthoA: V.ortho_match_m[0], orthoB: V.ortho_match_m[1],
    };
    const items = MW.t('val.items', v);
    items.splice(3, 0, MW.t('val.gm'));   // right after the reader check, which also rests on Global Mapper
    document.getElementById('validationBody').innerHTML = `<ul>${items.map(s => `<li>${s}</li>`).join('')}</ul>` +
      `<p class="hint">${MW.t('val.limits')}</p>`;
  }
  MW.validation = {
    init() {
      if (!V) { document.getElementById('validation').hidden = true; return; }
      render();
      MW.on('language', render);
    },
  };
})();
