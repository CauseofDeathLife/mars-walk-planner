"""Walking grid of the working area: 5 m elevation, terrain slope and the obstacle rule.

Obstacle rule of the planner: a cell whose terrain slope (5 m grid, central differences, east-west
spacing corrected by cos(latitude)) exceeds the limit is not walkable. Test 1.7 only limited the
slope along the direction of travel, which lets a route traverse steep hillsides sideways.
"""
import math
from collections import deque
import numpy as np
from paths import MARS_RADIUS_M
from terrain_grid import block_mean

_STEPS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def area_bounds(info, center, half_m):
    c0 = int((center[0] - half_m - info['x0']) / info['px'])
    c1 = int((center[0] + half_m - info['x0']) / info['px'])
    r0 = int((info['y0'] - (center[1] + half_m)) / info['py'])
    r1 = int((info['y0'] - (center[1] - half_m)) / info['py'])
    return max(r0, 0), min(r1, info['height']), max(c0, 0), min(c1, info['width'])


def build_walk_grid(dem, info, center, half_m, factor, slope_limit_deg):
    """Return dict with z (5 m), slope (deg), walkable z (NaN on obstacles), grid info, dx, dy."""
    z, gi = block_mean(dem, info, area_bounds(info, center, half_m), factor)
    k = math.cos(center[1] / MARS_RADIUS_M)
    dx, dy = gi['px'] * k, gi['py']
    gy, gx = np.gradient(z, dy, dx)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    walk = z.copy()
    walk[~(slope <= slope_limit_deg)] = np.nan   # NaN slope (next to nodata) is also blocked
    return {'z': z, 'slope': slope, 'walk': walk, 'info': gi, 'dx': dx, 'dy': dy, 'k': k}


def reachable_from(walk, dx, dy, start, slope_limit_deg):
    """Cells connected to start with every step under the directional slope limit."""
    h, w = walk.shape
    tan_lim = math.tan(math.radians(slope_limit_deg))
    steps = [(dr, dc, math.hypot(dr * dy, dc * dx) * tan_lim) for dr, dc in _STEPS]
    seen = np.zeros((h, w), dtype=bool)
    if walk[start] != walk[start]:
        return seen
    seen[start] = True
    queue = deque([start])
    zl = walk.tolist()
    while queue:
        r, c = queue.popleft()
        z0 = zl[r][c]
        for dr, dc, max_rise in steps:
            nr, nc = r + dr, c + dc
            if 0 <= nr < h and 0 <= nc < w and not seen[nr, nc]:
                z1 = zl[nr][nc]
                if z1 == z1 and abs(z1 - z0) <= max_rise:
                    seen[nr, nc] = True
                    queue.append((nr, nc))
    return seen


def label_regions(mask):
    """8-connected regions of a boolean mask, largest first, as arrays of (row, col)."""
    h, w = mask.shape
    done = np.zeros((h, w), dtype=bool)
    regions = []
    for r, c in zip(*np.nonzero(mask)):
        if done[r, c]:
            continue
        done[r, c] = True
        stack, cells = [(r, c)], []
        while stack:
            a, b = stack.pop()
            cells.append((a, b))
            for da, db in _STEPS:
                x, y = a + da, b + db
                if 0 <= x < h and 0 <= y < w and mask[x, y] and not done[x, y]:
                    done[x, y] = True
                    stack.append((x, y))
        regions.append(np.array(cells))
    regions.sort(key=len, reverse=True)
    return regions
