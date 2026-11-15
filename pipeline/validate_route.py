"""Test 1.7: A* route on the resampled DTM between two real Curiosity stops 1-2 km apart.

Fixed before running: positions aligned in 1.5; A = first stop of the last segment; B = first later
stop at >= 1.5 km straight-line ground distance (must be <= 2 km). Grid = 5x5 block mean of the
1 m DTM (~5.06 m), window = A,B + 500 m. Slope limit 15 deg (MoonPath, Pena-Asensio et al. 2024).
PASS if a route is found, no edge exceeds the limit, A* cost == Dijkstra cost, time measured.
"""
import json
import math
import os
import time
import numpy as np
import pandas as pd
from paths import DTM_FILE, RESULTS_DIR, INPUTS_DIR, MARS_RADIUS_M
from dtm_reader import read_dtm
from raster_sampling import to_pixel, pixel_center, bilinear
from terrain_grid import window_bounds, block_mean, east_west_scale
from pathfinding import find_path, path_slopes

SLOPE_LIMIT, FACTOR, BUFFER_M, MIN_D, MAX_D = 15.0, 5, 500.0, 1500.0, 2000.0


def ground_distance(x0, y0, x1, y1):
    k = math.cos(((y0 + y1) / 2) / MARS_RADIUS_M)
    return math.hypot((x1 - x0) * k, y1 - y0)


def pick_pair(tr):
    last = tr[tr.segment == tr.segment.max()]
    a = last.index[0]
    for b in tr.index[tr.index > a]:
        d = ground_distance(tr.easting_aligned[a], tr.northing_aligned[a], tr.easting_aligned[b], tr.northing_aligned[b])
        if d >= MIN_D:
            if d > MAX_D:
                raise ValueError(f'first stop beyond {MIN_D} m is at {d:.0f} m')
            return a, b, d
    raise ValueError('no pair found')


def main():
    dem, info = read_dtm(DTM_FILE)
    tr = pd.read_csv(os.path.join(RESULTS_DIR, 'msl_track_aligned.csv'))
    a, b, dist = pick_pair(tr)
    xs = [tr.easting_aligned[a], tr.easting_aligned[b]]; ys = [tr.northing_aligned[a], tr.northing_aligned[b]]
    t0 = time.time()
    grid, gi = block_mean(dem, info, window_bounds(info, xs, ys, BUFFER_M), FACTOR)
    k = east_west_scale(gi); dx, dy = gi['px'] * k, gi['py']
    prep_s = time.time() - t0
    rr, cc = to_pixel(gi, xs, ys)
    start = (int(round(rr[0])), int(round(cc[0]))); goal = (int(round(rr[1])), int(round(cc[1])))
    t0 = time.time(); path, cost, n_astar = find_path(grid, dx, dy, start, goal, SLOPE_LIMIT, True); t_astar = time.time() - t0
    t0 = time.time(); path_d, cost_d, n_dij = find_path(grid, dx, dy, start, goal, SLOPE_LIMIT, False); t_dij = time.time() - t0
    out = {'test': '1.7', 'slope_limit_deg': SLOPE_LIMIT, 'grid_cell_m': [dx, dy], 'grid_shape': list(grid.shape),
           'window_nodata_pct': float(np.isnan(grid).mean() * 100),
           'A': {'sol': int(tr.sol[a]), 'site': int(tr.site[a]), 'drive': int(tr.drive[a]), 'easting': xs[0], 'northing': ys[0]},
           'B': {'sol': int(tr.sol[b]), 'site': int(tr.site[b]), 'drive': int(tr.drive[b]), 'easting': xs[1], 'northing': ys[1]},
           'straight_distance_m': dist, 'grid_prep_s': prep_s,
           'astar': {'found': path is not None, 'cost': cost, 'expanded': n_astar, 'seconds': t_astar},
           'dijkstra': {'found': path_d is not None, 'cost': cost_d, 'expanded': n_dij, 'seconds': t_dij}}
    if path is not None:
        sl = path_slopes(grid, dx, dy, path)
        rows, cols = np.array([p[0] for p in path]), np.array([p[1] for p in path])
        px, py = pixel_center(gi, rows, cols)
        z1m = bilinear(dem, info, px, py)
        out.update({'route_vertices': len(path), 'route_ground_length_m': float(sum(s[1] for s in sl)),
                    'route_max_edge_slope_deg': float(max(s[0] for s in sl)),
                    'edges_over_limit': int(sum(s[0] > SLOPE_LIMIT + 1e-9 for s in sl)),
                    'cost_equal_rel_diff': abs(cost - cost_d) / cost})
        route = pd.DataFrame({'easting': px, 'northing': py, 'elevation': z1m,
                              'label': [f'R{i:03d}' for i in range(len(path))]})
        route.to_csv(os.path.join(RESULTS_DIR, 'test17_route.csv'), index=False)
        route.to_csv(os.path.join(INPUTS_DIR, 'route_test17_for_gm.csv'), index=False, float_format='%.3f')
        ok = (out['edges_over_limit'] == 0) and out['cost_equal_rel_diff'] < 1e-9 and path_d is not None
        out['result'] = 'PASS' if ok else 'FAIL'
    else:
        out['result'] = 'FAIL'
    json.dump(out, open(os.path.join(RESULTS_DIR, 'test17_route.json'), 'w'), indent=2)
    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
