"""Global colour mosaic of Mars (Viking MDIM 2.1, USGS / NASA Ames, public domain) reduced to the texture
of the entrance globe. The reduced JPEG is cached next to the page so the 21339 x 10670 original is read once."""
import base64
import os
from PIL import Image

import config as cfg

Image.MAX_IMAGE_PIXELS = None
SIZE = (4096, 2048)     # equirectangular, longitude 0 at the centre
QUALITY = 84


def build():
    """Texture for the entrance globe, or None when the mosaic has not been downloaded."""
    if not os.path.exists(cfg.GLOBE_FILE):
        print('global mosaic not found, the page is built without the entrance globe:', cfg.GLOBE_FILE)
        return None
    if not os.path.exists(cfg.GLOBE_CACHE) or os.path.getmtime(cfg.GLOBE_CACHE) < os.path.getmtime(cfg.GLOBE_FILE):
        im = Image.open(cfg.GLOBE_FILE)
        im.draft('RGB', SIZE)   # JPEG decodes at a reduced scale: fast and light on memory
        im.convert('RGB').resize(SIZE, Image.LANCZOS).save(cfg.GLOBE_CACHE, 'JPEG', quality=QUALITY, optimize=True)
    jpg = open(cfg.GLOBE_CACHE, 'rb').read()
    print('globe texture', SIZE, round(len(jpg) / 1024), 'KB')
    return {'kb': round(len(jpg) / 1024), 'source': 'Mars Viking MDIM 2.1 colorized global mosaic (1 km version)',
            'credit': 'NASA/JPL/USGS · NASA Ames', 'b64': base64.b64encode(jpg).decode('ascii')}
