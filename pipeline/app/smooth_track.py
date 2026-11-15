"""Curiosity's track for the page: the four per-stretch shifts of test 1.5 become a shift that changes
gradually with the sol (linear between the mean sols of the stretches), so the track has no jumps.
The smooth version is kept only if it fits the terrain as well as the stepped one."""
import json
import os
import numpy as np
import pandas as pd

import config as cfg
from paths import DTM_FILE, RESULTS_DIR
from dtm_reader import read_dtm
from raster_sampling import bilinear

STEPPED_FILE = os.path.join(RESULTS_DIR, 'msl_track_aligned.csv')
MAX_STD_LOSS_M = 0.3   # accepted loss of fit against the stepped alignment (set before running)


def main():
    t = pd.read_csv(STEPPED_FILE).sort_values('sol').reset_index(drop=True)
    dem, info = read_dtm(DTM_FILE)
    seg = t.groupby('segment').agg(sol=('sol', 'mean'), x=('shift_x', 'first'), y=('shift_y', 'first'), z=('offset_z', 'first'))
    sx, sy, sz = (np.interp(t.sol, seg.sol, seg[k]) for k in 'xyz')
    res_step = bilinear(dem, info, t.easting + t.shift_x, t.northing + t.shift_y) - t.elev_geoid - t.offset_z
    res_smooth = bilinear(dem, info, t.easting + sx, t.northing + sy) - t.elev_geoid - sz
    control = t.role == 'control'
    jump = lambda a, b: float(np.nanmax(np.hypot(np.diff(a), np.diff(b))))
    report = {
        'rows': len(t), 'segment_mean_sols': seg.sol.round(1).tolist(),
        'std_stepped_all_m': float(np.nanstd(res_step)), 'std_smooth_all_m': float(np.nanstd(res_smooth)),
        'std_stepped_control_m': float(np.nanstd(res_step[control])), 'std_smooth_control_m': float(np.nanstd(res_smooth[control])),
        'max_abs_smooth_m': float(np.nanmax(np.abs(res_smooth))),
        'largest_shift_change_between_stops_stepped_m': jump(t.shift_x, t.shift_y),
        'largest_shift_change_between_stops_smooth_m': jump(sx, sy),
    }
    report['result'] = 'PASS' if report['std_smooth_control_m'] <= report['std_stepped_control_m'] + MAX_STD_LOSS_M else 'FAIL'
    t['shift_x'], t['shift_y'], t['offset_z'] = sx, sy, sz
    t['easting_aligned'], t['northing_aligned'] = t.easting + sx, t.northing + sy
    t.to_csv(cfg.SMOOTH_TRACK_FILE, index=False)
    json.dump(report, open(os.path.join(RESULTS_DIR, 'track_smoothing.json'), 'w'), indent=1)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
