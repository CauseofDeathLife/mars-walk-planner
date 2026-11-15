"""Terrain slope with Horn's 3x3 method, east-west spacing corrected by cos(latitude)."""
import numpy as np
from paths import MARS_RADIUS_M


def horn_slope_at(dem, info, x, y):
    """Slope (degrees) at the nearest pixel to each point; NaN if the 3x3 window has nodata."""
    col = np.floor((np.asarray(x) - info['x0']) / info['px']).astype(int)
    row = np.floor((info['y0'] - np.asarray(y)) / info['py']).astype(int)
    out = np.full(col.shape, np.nan)
    lat = np.asarray(y) / MARS_RADIUS_M
    for i, (r, c) in enumerate(zip(row, col)):
        if r < 1 or c < 1 or r >= dem.shape[0] - 1 or c >= dem.shape[1] - 1:
            continue
        w = dem[r - 1:r + 2, c - 1:c + 2]
        if np.isnan(w).any():
            continue
        dx = info['px'] * np.cos(lat[i]); dy = info['py']
        dzdx = ((w[0, 2] + 2 * w[1, 2] + w[2, 2]) - (w[0, 0] + 2 * w[1, 0] + w[2, 0])) / (8 * dx)
        dzdy = ((w[2, 0] + 2 * w[2, 1] + w[2, 2]) - (w[0, 0] + 2 * w[0, 1] + w[0, 2])) / (8 * dy)
        out[i] = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    return out
