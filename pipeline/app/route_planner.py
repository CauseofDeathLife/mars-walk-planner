"""Two-stage route between two fixed points, the method of check 1.8b plus the obstacle rule:
1. A* on the 5 m walking grid (steep cells are obstacles, steps limited to the slope limit).
2. A* on the 1 m DTM inside a corridor around that route, planned with a margin.
3. The 1 m route is resampled every metre and only accepted if no sample exceeds the limit.
"""
import math
import time
import numpy as np

import config as cfg
from raster_sampling import bilinear, to_pixel, pixel_center
from pathfinding import find_path
from profile_sampling import resample_profile


def _cell(gi, e, n):
    rr, cc = to_pixel(gi, [e], [n])
    return int(round(rr[0])), int(round(cc[0]))


def corridor_grid(dem, info, grid, path5, corridor_m):
    """1 m elevations around the 5 m path; NaN outside the corridor and on 5 m obstacle cells."""
    gi, f = grid['info'], cfg.PLAN_FACTOR
    e, n = pixel_center(gi, np.array([p[0] for p in path5]), np.array([p[1] for p in path5]))
    rr, cc = to_pixel(info, e, n)
    rad = int(math.ceil(corridor_m / info['px']))
    r0 = int(max(rr.min() - rad, 0)); r1 = int(min(rr.max() + rad + 1, info['height']))
    c0 = int(max(cc.min() - rad, 0)); c1 = int(min(cc.max() + rad + 1, info['width']))
    near = np.zeros((r1 - r0, c1 - c0), dtype=bool)
    yy, xx = np.mgrid[-rad:rad + 1, -rad:rad + 1]
    disc = (yy * yy + xx * xx) <= rad * rad
    for r, c in zip(np.round(rr).astype(int) - r0, np.round(cc).astype(int) - c0):
        a0, a1, b0, b1 = max(r - rad, 0), min(r + rad + 1, near.shape[0]), max(c - rad, 0), min(c + rad + 1, near.shape[1])
        near[a0:a1, b0:b1] |= disc[a0 - (r - rad):a1 - (r - rad), b0 - (c - rad):b1 - (c - rad)]
    sub = dem[r0:r1, c0:c1].astype(np.float64)
    # 5 m obstacle mask brought to 1 m: pixel (r, c) of the DTM belongs to one 5 m block
    area_r0 = int(round((info['y0'] - gi['y0']) / info['py'])); area_c0 = int(round((gi['x0'] - info['x0']) / info['px']))
    br = (np.arange(r0, r1) - area_r0) // f; bc = (np.arange(c0, c1) - area_c0) // f
    ok_r = (br >= 0) & (br < gi['height']); ok_c = (bc >= 0) & (bc < gi['width'])
    walk = np.zeros(sub.shape, dtype=bool)
    walk[np.ix_(ok_r, ok_c)] = ~np.isnan(grid['walk'][np.ix_(br[ok_r], bc[ok_c])])
    sub[~(near & walk)] = np.nan
    si = {'x0': info['x0'] + c0 * info['px'], 'y0': info['y0'] - r0 * info['py'], 'px': info['px'], 'py': info['py'],
          'width': sub.shape[1], 'height': sub.shape[0]}
    return sub, si


def plan_route(dem, info, grid, a, b):
    """a, b: dicts with easting/northing. Returns a result dict; 'status' is ok, no_route or unverified."""
    gi, k = grid['info'], grid['k']
    out = {'status': 'no_route', 'stage': '5 m grid'}
    t0 = time.time()
    path5, _, n5 = find_path(grid['walk'], grid['dx'], grid['dy'], _cell(gi, a['easting'], a['northing']),
                             _cell(gi, b['easting'], b['northing']), cfg.SLOPE_LIMIT_DEG, True)
    out['search5_s'] = round(time.time() - t0, 2); out['expanded5'] = n5
    if path5 is None:
        return out
    sub, si = corridor_grid(dem, info, grid, path5, cfg.CORRIDOR_M)
    start, goal = _cell(si, a['easting'], a['northing']), _cell(si, b['easting'], b['northing'])
    out['stage'] = '1 m corridor'
    for limit in cfg.PLANNING_LIMITS_DEG:
        t0 = time.time()
        path1, _, n1 = find_path(sub, si['px'] * k, si['py'], start, goal, limit, True)
        out['search1_s'] = round(time.time() - t0, 2); out['expanded1'] = n1
        if path1 is None:
            continue
        xs, ys = pixel_center(si, np.array([p[0] for p in path1]), np.array([p[1] for p in path1]))
        _, _, _, slope, length = resample_profile(dem, info, xs, ys, k)
        out['status'] = 'unverified'
        if slope.max() <= cfg.SLOPE_LIMIT_DEG:
            z = bilinear(dem, info, xs, ys)
            dz = np.diff(z)
            out.update({'status': 'ok', 'planning_limit_deg': limit, 'length_m': round(length, 1),
                        'max_slope_1m_deg': round(float(slope.max()), 2), 'vertices': len(path1),
                        'ascent_m': round(float(dz[dz > 0].sum()), 1), 'descent_m': round(float(-dz[dz < 0].sum()), 1),
                        'xs': xs, 'ys': ys, 'zs': z})
            return out
        out['max_slope_1m_deg'] = round(float(slope.max()), 2)
    return out
