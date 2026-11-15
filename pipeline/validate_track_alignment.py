"""Test 1.5: per-segment alignment of Curiosity's track to the DTM, with cross-validation.

Fixed before running: stops inside the DTM, sorted by sol; even positions train, odd control;
4 segments by sol (equal counts). For each segment the training stops give the horizontal shift
(grid search +-150 m, 2 m then 0.25 m) that minimises the std of D = DTM - rover, and the mean D
(vertical offset). Control stops use those values unchanged. PASS if the pooled std of control
residuals <= 3 m.
"""
import json
import os
import numpy as np
from paths import DTM_FILE, RESULTS_DIR
from dtm_reader import read_dtm
from raster_sampling import bilinear
from waypoints import load_waypoints

N_SEGMENTS, SEARCH_M, PASS_STD_M = 4, 150.0, 3.0


def d_values(dem, info, x, y, rover_z, sx, sy):
    return bilinear(dem, info, x + sx, y + sy) - rover_z


def best_shift(dem, info, x, y, z):
    def score(sx, sy):
        d = d_values(dem, info, x, y, z, sx, sy)
        ok = ~np.isnan(d)
        return np.std(d[ok]) if ok.mean() >= 0.9 else np.inf
    best = (np.inf, 0.0, 0.0)
    for sx in np.arange(-SEARCH_M, SEARCH_M + 0.1, 2.0):
        for sy in np.arange(-SEARCH_M, SEARCH_M + 0.1, 2.0):
            s = score(sx, sy)
            if s < best[0]:
                best = (s, sx, sy)
    _, bx, by = best
    for sx in np.arange(bx - 2, bx + 2.01, 0.25):
        for sy in np.arange(by - 2, by + 2.01, 0.25):
            s = score(sx, sy)
            if s < best[0]:
                best = (s, sx, sy)
    return best


def main():
    dem, info = read_dtm(DTM_FILE)
    wp = load_waypoints()
    wp['dtm'] = bilinear(dem, info, wp.easting, wp.northing)
    inside = wp[~wp.dtm.isna()].reset_index(drop=True)
    inside['segment'] = np.minimum(np.arange(len(inside)) * N_SEGMENTS // len(inside), N_SEGMENTS - 1)
    inside['role'] = np.where(np.arange(len(inside)) % 2 == 0, 'train', 'control')
    segs, residuals = [], []
    inside['shift_x'] = np.nan; inside['shift_y'] = np.nan; inside['offset_z'] = np.nan
    for s in range(N_SEGMENTS):
        seg = inside[inside.segment == s]
        tr, co = seg[seg.role == 'train'], seg[seg.role == 'control']
        d_raw_tr = tr.dtm - tr.elev_geoid
        std_tr, sx, sy = best_shift(dem, info, tr.easting.values, tr.northing.values, tr.elev_geoid.values)
        d_tr = d_values(dem, info, tr.easting.values, tr.northing.values, tr.elev_geoid.values, sx, sy)
        off = float(np.nanmean(d_tr))
        d_co = d_values(dem, info, co.easting.values, co.northing.values, co.elev_geoid.values, sx, sy)
        res = d_co - off
        residuals.append(res[~np.isnan(res)])
        inside.loc[seg.index, ['shift_x', 'shift_y', 'offset_z']] = [sx, sy, off]
        segs.append({'segment': s, 'sol_from': int(seg.sol.min()), 'sol_to': int(seg.sol.max()),
                     'n_train': int(len(tr)), 'n_control': int(len(co)), 'n_control_valid': int((~np.isnan(res)).sum()),
                     'shift_east_m': float(sx), 'shift_north_m': float(sy), 'shift_m': float(np.hypot(sx, sy)),
                     'vertical_offset_m': off, 'train_std_before_m': float(np.nanstd(d_raw_tr)),
                     'train_std_after_m': float(std_tr), 'control_std_before_m': float(np.nanstd(co.dtm - co.elev_geoid)),
                     'control_residual_std_m': float(np.std(res[~np.isnan(res)])),
                     'control_residual_max_abs_m': float(np.nanmax(np.abs(res)))})
    allres = np.concatenate(residuals)
    pooled = float(np.std(allres))
    out = {'test': '1.5', 'criterion': f'pooled control residual std <= {PASS_STD_M} m',
           'waypoints_total': int(len(wp)), 'inside_dtm': int(len(inside)),
           'sol_range_inside': [int(inside.sol.min()), int(inside.sol.max())],
           'segments': segs, 'control_n': int(len(allres)), 'control_pooled_std_m': pooled,
           'control_mean_m': float(allres.mean()), 'control_p95_abs_m': float(np.percentile(np.abs(allres), 95)),
           'control_max_abs_m': float(np.abs(allres).max()),
           'result': 'PASS' if pooled <= PASS_STD_M else 'FAIL'}
    json.dump(out, open(os.path.join(RESULTS_DIR, 'test15_alignment.json'), 'w'), indent=2)
    inside['easting_aligned'] = inside.easting + inside.shift_x
    inside['northing_aligned'] = inside.northing + inside.shift_y
    inside.to_csv(os.path.join(RESULTS_DIR, 'msl_track_aligned.csv'), index=False)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
