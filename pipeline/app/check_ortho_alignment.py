"""Check where the HiRISE orthoimage really sits on the DTM: fit brightness = a*dz/dx + b*dz/dy + c
(shaded-relief model) for integer pixel shifts and report the shift with the best R2."""
import os
import numpy as np
from PIL import Image

import config as cfg  # noqa: F401  (adds pipeline/ to the path)
from paths import DATA_DIR, DTM_FILE
from dtm_reader import read_dtm

Image.MAX_IMAGE_PIXELS = None
ORTHO_FILE = os.path.join(DATA_DIR, 'PSP_009149_1750_RED_C_01_ORTHO.tif')
MAX_SHIFT = 6
WINDOWS = [(7000, 2500), (8500, 1800), (6000, 3200)]   # (row, col) of 1200 px windows inside the working area
SIZE = 1200


def r2_by_shift(dem, ortho, r0, c0):
    z = dem[r0 - 1:r0 + SIZE + 1, c0 - 1:c0 + SIZE + 1]
    gx = (z[1:-1, 2:] - z[1:-1, :-2]).ravel()
    gy = (z[2:, 1:-1] - z[:-2, 1:-1]).ravel()
    out = {}
    for dr in range(-MAX_SHIFT, MAX_SHIFT + 1):
        for dc in range(-MAX_SHIFT, MAX_SHIFT + 1):
            b = ortho[r0 + dr:r0 + dr + SIZE, c0 + dc:c0 + dc + SIZE].astype(np.float64).ravel()
            ok = (b > 0) & np.isfinite(gx) & np.isfinite(gy)
            A = np.column_stack([gx[ok], gy[ok], np.ones(ok.sum())])
            coef, res, *_ = np.linalg.lstsq(A, b[ok], rcond=None)
            out[(dr, dc)] = 1 - res[0] / ((b[ok] - b[ok].mean()) ** 2).sum()
    return out


def main():
    dem, info = read_dtm(DTM_FILE)
    im = Image.open(ORTHO_FILE)
    tie, scale = im.tag_v2[33922], im.tag_v2[33550]
    ortho = np.asarray(im)
    geo_dc = (info['x0'] - tie[3]) / scale[0]
    geo_dr = (tie[4] - info['y0']) / scale[1]
    print('georeference says ortho index = DTM index + (rows %.2f, cols %.2f)' % (geo_dr, geo_dc))
    for r0, c0 in WINDOWS:
        r2 = r2_by_shift(dem, ortho, r0, c0)
        best = max(r2, key=r2.get)
        near = sorted(r2, key=r2.get, reverse=True)[:4]
        print('window', (r0, c0), 'best shift (rows, cols)', best, 'R2 %.3f' % r2[best], '· R2 at (0,0) %.3f' % r2[(0, 0)],
              '· at (-1,-1) %.3f · at (-2,-2) %.3f' % (r2[(-1, -1)], r2[(-2, -2)]), '· top4', near)


if __name__ == '__main__':
    main()
