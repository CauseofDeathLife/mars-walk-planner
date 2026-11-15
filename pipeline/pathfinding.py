"""A* and Dijkstra on an 8-connected elevation grid.

Edge cost = 3D length * (1 + (slope / limit)^2); edges steeper than the limit are forbidden.
Heuristic for A* = straight-line ground distance (a lower bound of every path cost, so A*
returns the same optimum as Dijkstra).
"""
import heapq
import math
import numpy as np

_STEPS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def find_path(z, dx, dy, start, goal, slope_limit_deg, use_heuristic=True):
    """z: elevation grid (NaN = blocked); dx, dy: cell size in metres east-west / north-south.
    Returns (path as list of (row, col), total cost, nodes expanded) or (None, inf, n)."""
    h, w = z.shape
    tan_lim = math.tan(math.radians(slope_limit_deg))
    steps = [(dr, dc, math.hypot(dr * dy, dc * dx)) for dr, dc in _STEPS]
    gr, gc = goal
    zl = z.tolist()
    best = {start: 0.0}
    parent = {start: None}
    def heur(r, c):
        return math.hypot((r - gr) * dy, (c - gc) * dx) if use_heuristic else 0.0
    heap = [(heur(*start), 0.0, start)]
    closed = set()
    expanded = 0
    while heap:
        f, g, node = heapq.heappop(heap)
        if node in closed:
            continue
        closed.add(node)
        expanded += 1
        if node == goal:
            path = []
            while node is not None:
                path.append(node); node = parent[node]
            return path[::-1], g, expanded
        r, c = node
        z0 = zl[r][c]
        for dr, dc, run in steps:
            nr, nc = r + dr, c + dc
            if nr < 0 or nc < 0 or nr >= h or nc >= w:
                continue
            z1 = zl[nr][nc]
            if z1 != z1:  # NaN
                continue
            rise = abs(z1 - z0)
            if rise > run * tan_lim:
                continue
            slope_ratio = math.degrees(math.atan2(rise, run)) / slope_limit_deg
            ng = g + math.hypot(run, rise) * (1.0 + slope_ratio * slope_ratio)
            nxt = (nr, nc)
            if ng < best.get(nxt, math.inf):
                best[nxt] = ng; parent[nxt] = node
                heapq.heappush(heap, (ng + heur(nr, nc), ng, nxt))
    return None, math.inf, expanded


def path_slopes(z, dx, dy, path):
    """Directional slope (degrees) and ground length of each edge along a path."""
    out = []
    for (r0, c0), (r1, c1) in zip(path, path[1:]):
        run = math.hypot((r1 - r0) * dy, (c1 - c0) * dx)
        out.append((math.degrees(math.atan2(abs(z[r1, c1] - z[r0, c0]), run)), run))
    return out
