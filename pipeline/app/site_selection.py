"""Pick the fixed points of the planner: a habitat on flat ground, real Curiosity stops as
targets, and walkable areas that cannot be reached from the habitat under the slope limit.
Everything is chosen by rule (no hand-picked coordinates) and written to points.json."""
import json
import math
import os
import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

import config as cfg
from paths import DTM_FILE
from dtm_reader import read_dtm
from raster_sampling import to_pixel, pixel_center, bilinear
from walk_grid import build_walk_grid, reachable_from, label_regions


def ground_distance(k, x0, y0, x1, y1):
    return math.hypot((x1 - x0) * k, y1 - y0)


def pick_habitat(grid, stops):
    """Flattest-footprint cell closest to the centroid of Curiosity's stops in the area."""
    slope, w = grid['slope'], cfg.HABITAT_WINDOW
    half = w // 2
    worst = np.full(slope.shape, np.inf)
    worst[half:-half, half:-half] = sliding_window_view(np.nan_to_num(slope, nan=90.0), (w, w)).max(axis=(2, 3))
    rows, cols = np.nonzero(worst <= cfg.HABITAT_FLAT_DEG)
    e, n = pixel_center(grid['info'], rows, cols)
    ce, cn = stops.easting_aligned.mean(), stops.northing_aligned.mean()
    best = np.argmin(np.hypot((e - ce) * grid['k'], n - cn))
    return int(rows[best]), int(cols[best]), float(worst[rows[best], cols[best]])


def pick_targets(grid, stops, reach, habitat_en):
    """Farthest-point sampling over the reachable Curiosity stops inside the walking radius."""
    rr, cc = to_pixel(grid['info'], stops.easting_aligned.values, stops.northing_aligned.values)
    ri, ci = np.round(rr).astype(int), np.round(cc).astype(int)
    inside = (ri >= 0) & (ci >= 0) & (ri < reach.shape[0]) & (ci < reach.shape[1])
    ok = np.zeros(len(stops), dtype=bool)
    ok[inside] = reach[ri[inside], ci[inside]]
    d_hab = np.hypot((stops.easting_aligned.values - habitat_en[0]) * grid['k'], stops.northing_aligned.values - habitat_en[1])
    ok &= (d_hab >= cfg.WALK_RADIUS_M[0]) & (d_hab <= cfg.WALK_RADIUS_M[1])
    cand = np.nonzero(ok)[0]
    chosen = [int(cand[np.argmax(d_hab[cand])])]
    e, n = stops.easting_aligned.values, stops.northing_aligned.values
    while len(chosen) < cfg.N_TARGETS:
        dmin = np.min([np.hypot((e[cand] - e[j]) * grid['k'], n[cand] - n[j]) for j in chosen], axis=0)
        dmin = np.minimum(dmin, d_hab[cand])
        chosen.append(int(cand[np.argmax(dmin)]))
    return sorted(chosen, key=lambda j: stops.sol.values[j]), ri, ci


def pick_isolated(grid, reach, habitat_en):
    """Centres of the largest walkable areas that the habitat cannot reach, inside the radius."""
    islands = label_regions(~np.isnan(grid['walk']) & ~reach)
    out = []
    for cells in islands:
        if len(cells) < cfg.ISLAND_MIN_CELLS:
            break
        centre = cells.mean(axis=0)
        r, c = cells[np.argmin(np.hypot(cells[:, 0] - centre[0], cells[:, 1] - centre[1]))]
        e, n = pixel_center(grid['info'], r, c)
        d = ground_distance(grid['k'], habitat_en[0], habitat_en[1], float(e), float(n))
        if cfg.WALK_RADIUS_M[0] <= d <= cfg.WALK_RADIUS_M[1]:
            out.append((int(r), int(c), len(cells), d))
    out.sort(key=lambda t: t[3])
    return out[:cfg.N_ISOLATED]


def main():
    os.makedirs(cfg.OUT_DIR, exist_ok=True)
    dem, info = read_dtm(DTM_FILE)
    grid = build_walk_grid(dem, info, cfg.AREA_CENTER, cfg.AREA_HALF_M, cfg.PLAN_FACTOR, cfg.SLOPE_LIMIT_DEG)
    gi = grid['info']
    track = pd.read_csv(cfg.TRACK_FILE)
    rr, cc = to_pixel(gi, track.easting_aligned.values, track.northing_aligned.values)
    stops = track[(rr >= 0) & (cc >= 0) & (rr < gi['height'] - 1) & (cc < gi['width'] - 1)].reset_index(drop=True)

    hr, hc, hab_slope = pick_habitat(grid, stops)
    he, hn = (float(v) for v in pixel_center(gi, hr, hc))
    reach = reachable_from(grid['walk'], grid['dx'], grid['dy'], (hr, hc), cfg.SLOPE_LIMIT_DEG)
    chosen, ri, ci = pick_targets(grid, stops, reach, (he, hn))
    isolated = pick_isolated(grid, reach, (he, hn))

    def point(pid, kind, label, e, n, extra):
        return {'id': pid, 'kind': kind, 'label': label, 'easting': round(e, 3), 'northing': round(n, 3),
                'elevation': round(float(bilinear(dem, info, [e], [n])[0]), 3),
                'distance_from_habitat_m': round(ground_distance(grid['k'], he, hn, e, n), 1), **extra}

    points = [point('H', 'habitat', 'Habitat', he, hn, {'footprint_max_slope_deg': round(hab_slope, 2)})]
    for i, j in enumerate(chosen, 1):
        s = stops.iloc[j]
        # snap to the centre of its 5 m cell so every route starts on a walkable cell
        e, n = (float(v) for v in pixel_center(gi, ri[j], ci[j]))
        points.append(point(f'T{i}', 'target', f'Curiosity sol {int(s.sol)}', e, n,
                            {'sol': int(s.sol), 'site': int(s.site), 'drive': int(s.drive),
                             'stop_easting_aligned': float(s.easting_aligned), 'stop_northing_aligned': float(s.northing_aligned)}))
    for i, (r, c, cells, _) in enumerate(isolated, 1):
        e, n = (float(v) for v in pixel_center(gi, r, c))
        points.append(point(f'X{i}', 'isolated', f'Isolated area {i}', e, n, {'island_area_m2': round(cells * grid['dx'] * grid['dy'])}))

    valid = ~np.isnan(grid['z'])
    summary = {'area_center': cfg.AREA_CENTER, 'area_half_m': cfg.AREA_HALF_M, 'slope_limit_deg': cfg.SLOPE_LIMIT_DEG,
               'grid_shape': list(grid['z'].shape), 'cell_m': [grid['dx'], grid['dy']],
               'valid_cells': int(valid.sum()), 'obstacle_pct_of_valid': round(float(np.isnan(grid['walk'])[valid].mean() * 100), 2),
               'reachable_pct_of_valid': round(float(reach.sum() / valid.sum() * 100), 2),
               'stops_in_area': len(stops), 'stops_reachable': int(reach[ri, ci].sum())}
    json.dump({'summary': summary, 'points': points}, open(cfg.POINTS_FILE, 'w'), indent=2)
    print(json.dumps(summary, indent=1))
    for p in points:
        print(p['id'], p['label'], p['easting'], p['northing'], p['elevation'], p['distance_from_habitat_m'])


if __name__ == '__main__':
    main()
