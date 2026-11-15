"""Profile along a route: points every metre of ground distance, bilinear heights and the slope
between consecutive samples (the way Global Mapper samples a profile)."""
import math
import numpy as np
from raster_sampling import bilinear


def resample_profile(dem, info, xs, ys, k, step=1.0):
    """Points every `step` ground metres along the polyline, keeping original vertices."""
    px, py = [xs[0]], [ys[0]]
    for x0, y0, x1, y1 in zip(xs[:-1], ys[:-1], xs[1:], ys[1:]):
        L = math.hypot((x1 - x0) * k, y1 - y0)
        n = max(int(math.floor(L / step)), 0)
        for i in range(1, n + 1):
            f = i * step / L
            if f < 1:
                px.append(x0 + f * (x1 - x0)); py.append(y0 + f * (y1 - y0))
        px.append(x1); py.append(y1)
    px, py = np.array(px), np.array(py)
    z = bilinear(dem, info, px, py)
    run = np.hypot(np.diff(px) * k, np.diff(py))
    keep = run > 1e-6
    slope = np.degrees(np.arctan(np.abs(np.diff(z))[keep] / run[keep]))
    return px, py, z, slope, float(run.sum())
