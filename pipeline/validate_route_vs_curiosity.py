"""Test 1.9 (informative): route of 1.7 vs the stretch Curiosity actually drove between A and B
(aligned stops). Different limits (rover vs astronaut), so no pass/fail."""
import json
import math
import os
import numpy as np
import pandas as pd
from paths import DTM_FILE, RESULTS_DIR, MARS_RADIUS_M
from dtm_reader import read_dtm
from slope import horn_slope_at


def to_local(x, y, lat0):
    return np.asarray(x) * math.cos(lat0), np.asarray(y)


def point_to_polyline(px, py, lx, ly):
    d = np.full(len(px), np.inf)
    for x0, y0, x1, y1 in zip(lx[:-1], ly[:-1], lx[1:], ly[1:]):
        vx, vy = x1 - x0, y1 - y0
        L2 = vx * vx + vy * vy
        t = np.clip(((px - x0) * vx + (py - y0) * vy) / L2, 0, 1) if L2 > 0 else 0
        d = np.minimum(d, np.hypot(px - (x0 + t * vx), py - (y0 + t * vy)))
    return d


def main():
    dem, info = read_dtm(DTM_FILE)
    tr = pd.read_csv(os.path.join(RESULTS_DIR, 'msl_track_aligned.csv'))
    r17 = json.load(open(os.path.join(RESULTS_DIR, 'test17_route.json')))
    route = pd.read_csv(os.path.join(RESULTS_DIR, 'test17_route.csv'))
    a = tr.index[(tr.sol == r17['A']['sol']) & (tr.site == r17['A']['site']) & (tr.drive == r17['A']['drive'])][0]
    b = tr.index[(tr.sol == r17['B']['sol']) & (tr.site == r17['B']['site']) & (tr.drive == r17['B']['drive'])][0]
    seg = tr.loc[a:b]
    lat0 = seg.northing_aligned.mean() / MARS_RADIUS_M
    tx, ty = to_local(seg.easting_aligned, seg.northing_aligned, lat0)
    rx, ry = to_local(route.easting, route.northing, lat0)
    track_len = float(np.sum(np.hypot(np.diff(tx), np.diff(ty))))
    d_route_to_track = point_to_polyline(rx, ry, tx, ty)
    d_track_to_route = point_to_polyline(tx, ty, rx, ry)
    slopes = horn_slope_at(dem, info, seg.easting_aligned, seg.northing_aligned)
    out = {'test': '1.9', 'type': 'informative', 'stops_between': int(len(seg)),
           'sols': [int(seg.sol.iloc[0]), int(seg.sol.iloc[-1])],
           'curiosity_track_length_m': track_len, 'route_length_m': r17['route_ground_length_m'],
           'curiosity_odometry_m': float(seg.dist_total_m.iloc[-1] - seg.dist_total_m.iloc[0]),
           'mean_route_to_track_m': float(d_route_to_track.mean()), 'max_route_to_track_m': float(d_route_to_track.max()),
           'hausdorff_m': float(max(d_route_to_track.max(), d_track_to_route.max())),
           'curiosity_dtm_slope_at_stops_max_deg': float(np.nanmax(slopes)),
           'curiosity_tilt_max_deg': float(seg.tilt.max()),
           'curiosity_stops_with_dtm_slope_over_15': int(np.nansum(slopes > 15))}
    json.dump(out, open(os.path.join(RESULTS_DIR, 'test19_compare_track.json'), 'w'), indent=2)
    seg.to_csv(os.path.join(RESULTS_DIR, 'test19_curiosity_stretch.csv'), index=False)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
