"""Test 1.6: DTM slope (Horn 3x3, at the positions aligned in 1.5) vs Curiosity's measured tilt.
PASS if Pearson correlation >= 0.6 over all stops with a valid slope. Unaligned value is informative."""
import json
import os
import numpy as np
import pandas as pd
from paths import DTM_FILE, RESULTS_DIR
from dtm_reader import read_dtm
from slope import horn_slope_at

PASS_R = 0.6


def main():
    dem, info = read_dtm(DTM_FILE)
    tr = pd.read_csv(os.path.join(RESULTS_DIR, 'msl_track_aligned.csv'))
    tr['slope_aligned'] = horn_slope_at(dem, info, tr.easting_aligned, tr.northing_aligned)
    tr['slope_raw'] = horn_slope_at(dem, info, tr.easting, tr.northing)
    ok = tr.slope_aligned.notna() & tr.tilt.notna()
    okr = tr.slope_raw.notna() & tr.tilt.notna()
    r = float(np.corrcoef(tr.slope_aligned[ok], tr.tilt[ok])[0, 1])
    r_raw = float(np.corrcoef(tr.slope_raw[okr], tr.tilt[okr])[0, 1])
    diff = tr.slope_aligned[ok] - tr.tilt[ok]
    out = {'test': '1.6', 'criterion': f'Pearson r >= {PASS_R}', 'n': int(ok.sum()),
           'pearson_r_aligned': r, 'pearson_r_unaligned_informative': r_raw,
           'tilt_mean_deg': float(tr.tilt[ok].mean()), 'slope_mean_deg': float(tr.slope_aligned[ok].mean()),
           'slope_minus_tilt_mean_deg': float(diff.mean()), 'slope_minus_tilt_std_deg': float(diff.std()),
           'result': 'PASS' if r >= PASS_R else 'FAIL'}
    json.dump(out, open(os.path.join(RESULTS_DIR, 'test16_slope_vs_tilt.json'), 'w'), indent=2)
    tr[['sol', 'easting_aligned', 'northing_aligned', 'tilt', 'slope_aligned', 'slope_raw']].to_csv(
        os.path.join(RESULTS_DIR, 'test16_slope_vs_tilt.csv'), index=False)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
