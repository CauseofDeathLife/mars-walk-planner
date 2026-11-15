"""Reader for the HiRISE DTM: tiled BigTIFF, deflate, float32 with horizontal predictor (2).

Predictor 2 on float32 differences the 32-bit integer words, so the cumulative sum is done
on a uint32 view (a float cumsum would be wrong). Only numpy + zlib.
"""
import struct
import zlib
import numpy as np

_TYPES = {1: ('B', 1), 2: ('s', 1), 3: ('H', 2), 4: ('I', 4), 5: ('II', 8), 11: ('f', 4),
          12: ('d', 8), 16: ('Q', 8), 17: ('q', 8), 18: ('Q', 8)}


def _read_tags(f):
    order = '<' if f.read(2) == b'II' else '>'
    big = struct.unpack(order + 'H', f.read(2))[0] == 43
    if big:
        f.read(4)
        f.seek(struct.unpack(order + 'Q', f.read(8))[0])
        count = struct.unpack(order + 'Q', f.read(8))[0]
    else:
        f.seek(struct.unpack(order + 'I', f.read(4))[0])
        count = struct.unpack(order + 'H', f.read(2))[0]
    tags = {}
    for _ in range(count):
        if big:
            tag, typ, n = struct.unpack(order + 'HHQ', f.read(12)); raw, limit = f.read(8), 8
        else:
            tag, typ, n = struct.unpack(order + 'HHI', f.read(8)); raw, limit = f.read(4), 4
        if typ not in _TYPES:
            continue
        fmt, size = _TYPES[typ]
        total, here = size * n, f.tell()
        if total > limit:
            f.seek(struct.unpack(order + ('Q' if big else 'I'), raw)[0]); data = f.read(total); f.seek(here)
        else:
            data = raw[:total]
        tags[tag] = data.rstrip(b'\0').decode('latin1') if typ == 2 else struct.unpack(order + fmt * n, data)
    return order, tags


def read_dtm(path):
    """Return (elevation array float32 with NaN for nodata, info dict)."""
    with open(path, 'rb') as f:
        order, t = _read_tags(f)
        width, height = t[256][0], t[257][0]
        if (t[258][0], t.get(339, (1,))[0], t[259][0]) != (32, 3, 8):
            raise ValueError('expected float32 deflate DTM')
        predictor = t.get(317, (1,))[0]
        tw, th = t[322][0], t[323][0]
        tiles_x = (width + tw - 1) // tw
        out = np.empty((height, width), dtype=np.float32)
        for k, (off, cnt) in enumerate(zip(t[324], t[325])):
            f.seek(off)
            words = np.frombuffer(zlib.decompress(f.read(cnt)), dtype=order + 'u4').reshape(th, tw)
            if predictor == 2:
                words = np.cumsum(words, axis=1, dtype=np.uint32)
            tile = words.astype('=u4').view(np.float32)
            r0, c0 = (k // tiles_x) * th, (k % tiles_x) * tw
            r1, c1 = min(r0 + th, height), min(c0 + tw, width)
            out[r0:r1, c0:c1] = tile[:r1 - r0, :c1 - c0]
    nodata = float(t[42113]) if 42113 in t else None
    if nodata is not None:
        out[out <= nodata * 0.999] = np.nan
    info = {'x0': t[33922][3], 'y0': t[33922][4], 'px': t[33550][0], 'py': t[33550][1],
            'width': width, 'height': height}
    return out, info
