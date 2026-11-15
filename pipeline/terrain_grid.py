"""Coarse walking grid cut from the 1 m DTM: block-mean resampling over a window."""
import numpy as np
from paths import MARS_RADIUS_M


def window_bounds(info, xs, ys, buffer_m):
    """Pixel window (r0, r1, c0, c1) covering the points plus a buffer, clipped to the raster."""
    c = (np.asarray(xs) - info['x0']) / info['px']
    r = (info['y0'] - np.asarray(ys)) / info['py']
    b = buffer_m / info['px']
    r0 = max(int(np.floor(r.min() - b)), 0); r1 = min(int(np.ceil(r.max() + b)), info['height'])
    c0 = max(int(np.floor(c.min() - b)), 0); c1 = min(int(np.ceil(c.max() + b)), info['width'])
    return r0, r1, c0, c1


def block_mean(dem, info, bounds, factor):
    """Average factor x factor blocks; a block with any nodata becomes NaN (not walkable)."""
    r0, r1, c0, c1 = bounds
    r1 = r0 + (r1 - r0) // factor * factor
    c1 = c0 + (c1 - c0) // factor * factor
    sub = dem[r0:r1, c0:c1]
    h, w = sub.shape[0] // factor, sub.shape[1] // factor
    grid = sub.reshape(h, factor, w, factor).mean(axis=(1, 3))
    ginfo = {'x0': info['x0'] + c0 * info['px'], 'y0': info['y0'] - r0 * info['py'],
             'px': info['px'] * factor, 'py': info['py'] * factor, 'width': w, 'height': h}
    return grid.astype(np.float64), ginfo


def east_west_scale(ginfo):
    """Equirectangular true at the equator: east-west metres shrink by cos(latitude)."""
    lat = (ginfo['y0'] - ginfo['height'] * ginfo['py'] / 2) / MARS_RADIUS_M
    return float(np.cos(lat))
