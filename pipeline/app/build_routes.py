"""Precompute the route of every pair of fixed points and write routes.json + routes_summary.csv.
Routes are symmetric (the cost uses the absolute slope), so each pair is computed once."""
import itertools
import json
import time
import numpy as np
import pandas as pd

import config as cfg
from paths import DTM_FILE
from dtm_reader import read_dtm
from walk_grid import build_walk_grid
from route_planner import plan_route


def main():
    dem, info = read_dtm(DTM_FILE)
    grid = build_walk_grid(dem, info, cfg.AREA_CENTER, cfg.AREA_HALF_M, cfg.PLAN_FACTOR, cfg.SLOPE_LIMIT_DEG)
    points = json.load(open(cfg.POINTS_FILE))['points']
    routes, rows = [], []
    for a, b in itertools.combinations(points, 2):
        t0 = time.time()
        res = plan_route(dem, info, grid, a, b)
        res.update({'from': a['id'], 'to': b['id'], 'total_s': round(time.time() - t0, 1)})
        rows.append({key: val for key, val in res.items() if key not in ('xs', 'ys', 'zs')})
        if res['status'] == 'ok':
            res['xy'] = np.column_stack([res.pop('xs'), res.pop('ys')]).round(2).tolist()
            res['z'] = np.asarray(res.pop('zs')).round(2).tolist()
        routes.append(res)
        print(rows[-1], flush=True)
    json.dump({'slope_limit_deg': cfg.SLOPE_LIMIT_DEG, 'routes': routes}, open(cfg.ROUTES_FILE, 'w'), separators=(',', ':'))
    pd.DataFrame(rows).to_csv(cfg.ROUTES_SUMMARY_FILE, index=False)
    print('done', pd.DataFrame(rows).status.value_counts().to_dict())


if __name__ == '__main__':
    main()
