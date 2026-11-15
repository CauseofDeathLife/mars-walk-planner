"""Test 1.8: Global Mapper profile (1 m spacing) along the 1.7 route vs this script's DTM sampling.
PASS if max |GM elevation - script bilinear| <= 0.5 m and max |GM slope| <= 15 deg."""
import json
import os
import numpy as np
import pandas as pd
from paths import DTM_FILE, EXPORTS_DIR, RESULTS_DIR
from dtm_reader import read_dtm
from raster_sampling import bilinear

MAX_DZ, SLOPE_LIMIT = 0.5, 15.0


def main():
    dem, info = read_dtm(DTM_FILE)
    gm = pd.read_csv(os.path.join(EXPORTS_DIR, 'route_test17_profile.csv'))
    mine = bilinear(dem, info, gm.X, gm.Y)
    dz = gm.Elevation - mine
    slope = pd.to_numeric(gm['Slope (Degrees)'], errors='coerce').abs()
    over = slope > SLOPE_LIMIT
    r17 = json.load(open(os.path.join(RESULTS_DIR, 'test17_route.json')))
    out = {'test': '1.8', 'samples': int(len(gm)), 'gm_total_distance_m': float(gm['Distance (Total)'].iloc[-1]),
           'script_route_length_m': r17['route_ground_length_m'],
           'max_abs_dz_m': float(np.nanmax(np.abs(dz))), 'mean_abs_dz_m': float(np.nanmean(np.abs(dz))),
           'gm_max_abs_slope_deg': float(slope.max()), 'samples_over_15deg': int(over.sum()),
           'samples_over_15deg_pct': float(over.mean() * 100),
           'heights_ok': bool(np.nanmax(np.abs(dz)) <= MAX_DZ), 'slope_ok': bool(slope.max() <= SLOPE_LIMIT)}
    out['result'] = 'PASS' if out['heights_ok'] and out['slope_ok'] else 'FAIL'
    if over.any():
        idx = np.where(over)[0]
        out['over_limit_at_distance_m'] = [float(gm['Distance (Total)'].iloc[i]) for i in idx[:40]]
        out['slope_values_over_limit_deg'] = [float(slope.iloc[i]) for i in idx[:40]]
        # informative: slope over 5 m and 10 m baselines along the same profile
        d = gm['Distance (Total)'].values; z = gm.Elevation.values
        for base in (5.0, 10.0):
            j = np.searchsorted(d, d + base)
            ok = j < len(d)
            s = np.degrees(np.arctan(np.abs(z[j[ok]] - z[ok]) / (d[j[ok]] - d[ok])))
            out[f'informative_max_slope_{int(base)}m_baseline_deg'] = float(s.max())
            out[f'informative_pct_over_15_{int(base)}m_baseline'] = float((s > 15).mean() * 100)
    json.dump(out, open(os.path.join(RESULTS_DIR, 'test18_profile_check.json'), 'w'), indent=2)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
