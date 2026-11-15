"""Informative check after test 1.8: can the 1.7 route meet the
15 deg limit at 1 m? Refine with A* on the native 1 m DTM inside a corridor around the 5 m route,
then resample the result every 1 m with bilinear interpolation (as Global Mapper's profile does)
and measure the slope between consecutive samples. Same limit, same endpoints, no new criterion
beyond 1.8's: max slope <= 15 deg."""
import json
import math
import os
import time
import numpy as np
import pandas as pd
from paths import DTM_FILE, RESULTS_DIR, INPUTS_DIR, MARS_RADIUS_M
from dtm_reader import read_dtm
from raster_sampling import bilinear, to_pixel, pixel_center
from pathfinding import find_path
from profile_sampling import resample_profile

SLOPE_LIMIT, CORRIDOR_M = 15.0, 100.0
PLANNING_LIMITS = (15.0, 14.5, 14.0)  # plan with a margin, always verify against SLOPE_LIMIT


def corridor_grid(dem, info, route, corridor_m):
    rr, cc = to_pixel(info, route.easting, route.northing)
    r0 = int(max(rr.min() - corridor_m, 0)); r1 = int(min(rr.max() + corridor_m, info['height']))
    c0 = int(max(cc.min() - corridor_m, 0)); c1 = int(min(cc.max() + corridor_m, info['width']))
    sub = dem[r0:r1, c0:c1].astype(np.float64).copy()
    # mask cells farther than corridor_m from the 5 m route (distance in pixels ~ metres)
    yy, xx = np.mgrid[r0:r1, c0:c1]
    near = np.zeros(sub.shape, dtype=bool)
    pts = np.column_stack([rr, cc])
    for (ra, ca), (rb, cb) in zip(pts[:-1], pts[1:]):
        vr, vc = rb - ra, cb - ca
        L2 = vr * vr + vc * vc
        t = np.clip(((yy - ra) * vr + (xx - ca) * vc) / L2, 0, 1) if L2 > 0 else 0
        near |= np.hypot(yy - (ra + t * vr), xx - (ca + t * vc)) <= corridor_m
    sub[~near] = np.nan
    gi = {'x0': info['x0'] + c0 * info['px'], 'y0': info['y0'] - r0 * info['py'], 'px': info['px'], 'py': info['py'],
          'width': sub.shape[1], 'height': sub.shape[0]}
    return sub, gi


def main():
    dem, info = read_dtm(DTM_FILE)
    route5 = pd.read_csv(os.path.join(RESULTS_DIR, 'test17_route.csv'))
    r17 = json.load(open(os.path.join(RESULTS_DIR, 'test17_route.json')))
    k = math.cos(route5.northing.mean() / MARS_RADIUS_M)
    t0 = time.time()
    grid, gi = corridor_grid(dem, info, route5, CORRIDOR_M)
    rr, cc = to_pixel(gi, [r17['A']['easting'], r17['B']['easting']], [r17['A']['northing'], r17['B']['northing']])
    start = (int(round(rr[0])), int(round(cc[0]))); goal = (int(round(rr[1])), int(round(cc[1])))
    prep = time.time() - t0
    out = {'check': '1.8b informative', 'corridor_m': CORRIDOR_M, 'grid_shape': list(grid.shape),
           'corridor_cells': int((~np.isnan(grid)).sum()), 'prep_s': prep,
           'route5_length_m': r17['route_ground_length_m'], 'attempts': []}
    for plan in PLANNING_LIMITS:
        t0 = time.time()
        path, cost, n = find_path(grid, gi['px'] * k, gi['py'], start, goal, plan, True)
        att = {'planning_limit_deg': plan, 'found': path is not None, 'astar_s': time.time() - t0, 'expanded': n}
        if path is not None:
            rows = np.array([p[0] for p in path]); cols = np.array([p[1] for p in path])
            xs, ys = pixel_center(gi, rows, cols)
            px, py, z, slope, length = resample_profile(dem, info, xs, ys, k)
            att.update({'route_vertices': len(path), 'route_length_m': length, 'profile_samples': int(len(px)),
                        'max_slope_1m_deg': float(slope.max()), 'samples_over_15': int((slope > SLOPE_LIMIT).sum())})
            if slope.max() <= SLOPE_LIMIT and 'chosen_planning_limit_deg' not in out:
                out['chosen_planning_limit_deg'] = plan
                pd.DataFrame({'easting': xs, 'northing': ys, 'elevation': bilinear(dem, info, xs, ys)}).to_csv(
                    os.path.join(INPUTS_DIR, 'route_check18b_line.csv'), index=False, float_format='%.3f')
        out['attempts'].append(att)
        if 'chosen_planning_limit_deg' in out:
            break
    out['result'] = 'MEETS 15 deg at 1 m' if 'chosen_planning_limit_deg' in out else 'DOES NOT MEET'
    json.dump(out, open(os.path.join(RESULTS_DIR, 'check18b_route_1m.json'), 'w'), indent=2)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
