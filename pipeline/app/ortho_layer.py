"""HiRISE orthoimage (USGS, 1 m, same grid as the DTM) turned into the two page textures:
the working area at full resolution and the whole strip at the overview resolution."""
import base64
import io
import os
import numpy as np
from PIL import Image

import config as cfg

Image.MAX_IMAGE_PIXELS = None
NO_DATA_GRAY = 46                              # pixels the image does not cover
AREA_TRIES = ((1, 80), (1, 70), (2, 82))       # (reduction, JPEG quality), first one under the budget wins
AREA_MAX_BYTES = 3.2e6
OVERVIEW_QUALITY = 78
OVERVIEW_PHOTO_M = 3      # context strip photo, metres per pixel (its terrain mesh stays at cfg.OVERVIEW_FACTOR)


def _stretch(raw):
    """1-99 % percentile stretch of the valid pixels to 1..255; no colour is added."""
    valid = raw > 0
    lo, hi = np.percentile(raw[valid], [1, 99])
    out = (np.clip((raw.astype(np.float32) - lo) / (hi - lo), 0, 1) * 254 + 1).astype(np.uint8)
    out[~valid] = NO_DATA_GRAY
    return out


def _jpeg(img, quality):
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


def _pack(jpg, info, r0, r1, c0, c1, note):
    return {'x0': info['x0'] + c0 * info['px'], 'x1': info['x0'] + c1 * info['px'],
            'y0': info['y0'] - r0 * info['py'], 'y1': info['y0'] - r1 * info['py'],
            'kb': round(len(jpg) / 1024), 'note': note, 'b64': base64.b64encode(jpg).decode('ascii')}


def build(info, ainfo, area_shape):
    """Textures placed pixel on pixel over the DTM (see check_ortho_alignment.py). None if the file is missing."""
    if not os.path.exists(cfg.ORTHO_FILE):
        print('orthoimage not found, the page is built without the photo layer:', cfg.ORTHO_FILE)
        return None
    im = Image.open(cfg.ORTHO_FILE)
    scale = im.tag_v2[33550]
    if im.size != (info['width'], info['height']) or abs(scale[0] - info['px']) > 1e-6:
        raise SystemExit(f'orthoimage grid {im.size} at {scale[0]} m differs from the DTM grid: not used')
    gray = _stretch(np.asarray(im))
    H, W = gray.shape
    c0 = max(0, int(round((ainfo['x0'] - info['x0']) / info['px'])))
    r0 = max(0, int(round((info['y0'] - ainfo['y0']) / info['py'])))
    c1 = min(W, c0 + int(round(area_shape[1] * ainfo['px'] / info['px'])))
    r1 = min(H, r0 + int(round(area_shape[0] * ainfo['py'] / info['py'])))
    crop = Image.fromarray(gray[r0:r1, c0:c1])
    for reduction, quality in AREA_TRIES:
        jpg = _jpeg(crop.reduce(reduction) if reduction > 1 else crop, quality)
        if len(jpg) <= AREA_MAX_BYTES:
            break
    area = _pack(jpg, info, r0, r1, c0, c1, f'{reduction} m, q{quality}')
    overview = _pack(_jpeg(Image.fromarray(gray).reduce(OVERVIEW_PHOTO_M), OVERVIEW_QUALITY), info, 0, H, 0, W,
                     f'{OVERVIEW_PHOTO_M} m, q{OVERVIEW_QUALITY}')
    print('orthoimage · area', (r1 - r0, c1 - c0), area['note'], area['kb'], 'KB · overview', overview['kb'], 'KB')
    return {'area': area, 'overview': overview}
