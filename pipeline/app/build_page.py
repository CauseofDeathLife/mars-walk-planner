"""Assemble the self-contained page: terrain grids, fixed points, precomputed routes and
Curiosity's aligned stops go into one JSON; style.css and js/*.js are inlined into template.html."""
import base64
import json
import os
import numpy as np
import pandas as pd

import config as cfg
import ortho_layer
import globe_layer
import emblem_layer
from paths import DTM_FILE, MARS_RADIUS_M, RESULTS_DIR
from dtm_reader import read_dtm
from raster_sampling import bilinear
from terrain_grid import block_mean
from walk_grid import area_bounds

JS_ORDER = ['core', 'i18n', 'terrain', 'scene', 'markers', 'walker', 'routes', 'walkmodel', 'profile', 'compass', 'legend', 'weather', 'spaceweather', 'science', 'photos', 'track', 'frame', 'validation', 'tabs', 'ui', 'sky', 'tour', 'intro', 'themepick', 'main']


def encode(grid, ginfo):
    q = np.zeros(grid.shape, dtype='<u2')
    ok = ~np.isnan(grid)
    q[ok] = np.round((grid[ok] - cfg.Z_MIN) / cfg.Z_STEP).astype(np.int64) + 1
    return {'rows': grid.shape[0], 'cols': grid.shape[1], 'x0': ginfo['x0'], 'y0': ginfo['y0'], 'px': ginfo['px'],
            'py': ginfo['py'], 'b64': base64.b64encode(q.tobytes()).decode('ascii')}


def pack_route(r, ref):
    out = {'a': r['from'], 'b': r['to'], 'ok': r['status'] == 'ok'}
    if out['ok']:
        xy, z = np.asarray(r['xy']), np.asarray(r['z'])
        pts = np.column_stack([np.round((xy[:, 0] - ref['easting']) * 10), np.round((xy[:, 1] - ref['northing']) * 10),
                               np.round((z - ref['elevation']) * 100)]).astype(np.int64)
        out.update({'len': r['length_m'], 'maxSlope': r['max_slope_1m_deg'], 'pts': pts.ravel().tolist()})
    return out


def load_optional(path):
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else None


def validation():
    """Numbers of the checks shown in the page's validation block, read from their result files."""
    align, smooth, tilt = (load_optional(os.path.join(RESULTS_DIR, name)) for name in
                           ('test15_alignment.json', 'track_smoothing.json', 'test16_slope_vs_tilt.json'))
    if not (align and smooth and tilt):
        return None
    shifts = [seg['shift_m'] for seg in align['segments']]
    return {'shift_min_m': min(shifts), 'shift_max_m': max(shifts), 'control_n': align['control_n'],
            'std_m': smooth['std_smooth_control_m'], 'reader_points': cfg.READER_CHECK['points'],
            'reader_max_err_mm': cfg.READER_CHECK['max_err_mm'], 'tilt_n': tilt['n'], 'slope_mean_deg': tilt['slope_mean_deg'],
            'tilt_mean_deg': tilt['tilt_mean_deg'], 'pearson_r': tilt['pearson_r_aligned'], 'pearson_goal': 0.6,
            'ortho_match_m': list(cfg.ORTHO_MATCH_M)}


def track_photos(stops):
    """Stops of the track that carry Navcam photos, placed on the aligned track with the rover's heading."""
    src = load_optional(cfg.TRACK_PHOTOS_FILE)
    out = []
    for s in (src['stops'] if src else []):
        row = stops[(stops.sol == s['sol']) & (stops.site == s['site']) & (stops.drive == s['drive'])]
        if len(row):
            r = row.iloc[0]
            out.append({'sol': s['sol'], 'e': round(float(r.easting_aligned), 2), 'n': round(float(r.northing_aligned), 2),
                        'z': round(float(r.z), 2), 'yaw': float(r.yaw), 'photos': s['photos']})
    return out


def main():
    dem, info = read_dtm(DTM_FILE)
    overview, oinfo = block_mean(dem, info, (0, info['height'], 0, info['width']), cfg.OVERVIEW_FACTOR)
    area, ainfo = block_mean(dem, info, area_bounds(info, cfg.AREA_CENTER, cfg.AREA_HALF_M), cfg.PLAN_FACTOR)
    site = json.load(open(cfg.POINTS_FILE))
    routes = json.load(open(cfg.ROUTES_FILE))
    habitat = site['points'][0]
    ref = {'easting': habitat['easting'], 'northing': habitat['northing'], 'elevation': habitat['elevation'],
           'k': float(np.cos(cfg.AREA_CENTER[1] / MARS_RADIUS_M))}
    stops = pd.read_csv(cfg.TRACK_FILE)
    stops['z'] = bilinear(dem, info, stops.easting_aligned, stops.northing_aligned)
    stops = stops[stops.z.notna()]
    data = {
        'ref': ref,
        'quant': {'zmin': cfg.Z_MIN, 'step': cfg.Z_STEP},
        'overview': encode(overview, oinfo),
        'area': encode(area, ainfo),
        'stats': {'area_zmin': float(np.nanmin(area)), 'area_zmax': float(np.nanmax(area))},
        'meta': {'mars_radius_m': MARS_RADIUS_M, 'slope_limit_deg': routes['slope_limit_deg'], 'area_center': list(cfg.AREA_CENTER),
                 'site_summary': site['summary']},
        'points': site['points'],
        'routes': [pack_route(r, ref) for r in routes['routes']],
        'stops': stops[['easting_aligned', 'northing_aligned', 'z', 'sol']].round(2).values.tolist(),
        'ortho': ortho_layer.build(info, ainfo, area.shape),
        'weather': load_optional(cfg.REMS_FILE),
        'photos': load_optional(cfg.PHOTOS_FILE),
        'colorPhotos': load_optional(cfg.COLOR_PHOTOS_FILE),
        'spaceWeather': load_optional(cfg.DONKI_FILE),
        'trackPhotos': track_photos(stops),
        'validation': validation(),
        'globe': globe_layer.build(),
        'emblem': emblem_layer.build(),
    }
    read = lambda *parts: open(os.path.join(cfg.WEB_DIR, *parts), encoding='utf-8').read()
    scripts = '\n'.join(f'<script>\n// ---- js/{name}.js ----\n{read("js", name + ".js")}</script>' for name in JS_ORDER)
    html = (read('template.html').replace('/*__CSS__*/', read('style.css')).replace('/*__JS__*/', scripts)
            .replace('/*__DATA__*/null', json.dumps(data, separators=(',', ':'))))
    os.makedirs(os.path.dirname(cfg.PAGE_FILE), exist_ok=True)
    open(cfg.PAGE_FILE, 'w', encoding='utf-8').write(html)
    print('written', cfg.PAGE_FILE, round(os.path.getsize(cfg.PAGE_FILE) / 1e6, 2), 'MB · overview', overview.shape, '· area', area.shape,
          '· routes ok', sum(r['ok'] for r in data['routes']), '· stops', len(data['stops']), '· track rovers', len(data['trackPhotos']))


if __name__ == '__main__':
    main()
