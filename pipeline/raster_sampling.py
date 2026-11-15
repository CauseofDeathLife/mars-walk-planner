"""Bilinear sampling of a north-up raster with pixel-is-area georeferencing."""
import numpy as np


def bilinear(arr, info, x, y):
    col = (np.asarray(x, dtype=float) - info['x0']) / info['px'] - 0.5
    row = (info['y0'] - np.asarray(y, dtype=float)) / info['py'] - 0.5
    c0 = np.floor(col).astype(np.int64); r0 = np.floor(row).astype(np.int64)
    fc, fr = col - c0, row - r0
    inside = (c0 >= 0) & (r0 >= 0) & (c0 < arr.shape[1] - 1) & (r0 < arr.shape[0] - 1)
    c0c = np.clip(c0, 0, arr.shape[1] - 2); r0c = np.clip(r0, 0, arr.shape[0] - 2)
    a = arr[r0c, c0c]; b = arr[r0c, c0c + 1]; c = arr[r0c + 1, c0c]; d = arr[r0c + 1, c0c + 1]
    val = a * (1 - fc) * (1 - fr) + b * fc * (1 - fr) + c * (1 - fc) * fr + d * fc * fr
    return np.where(inside, val, np.nan)


def to_pixel(info, x, y):
    """Fractional (row, col) of a point, pixel centres at integer + 0.5 offsets removed."""
    col = (np.asarray(x, dtype=float) - info['x0']) / info['px'] - 0.5
    row = (info['y0'] - np.asarray(y, dtype=float)) / info['py'] - 0.5
    return row, col


def pixel_center(info, row, col):
    return info['x0'] + (np.asarray(col) + 0.5) * info['px'], info['y0'] - (np.asarray(row) + 0.5) * info['py']
