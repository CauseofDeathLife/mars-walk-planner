"""Team emblem for the page. The emblem was generated with AI (Gemini), so the copy used here carries a
visible watermark, as the Space Apps submission guide requires for AI-generated images."""
import base64
import io
import os
from PIL import Image, ImageDraw, ImageFont

import config as cfg

SIZE = 320
WATERMARK = 'AI-GENERATED IMAGE'
BAND = 46          # watermark band height in pixels of the reduced image
FONT_SIZE = 27


def build():
    """Watermarked emblem as a base64 JPEG, or None when the file is missing."""
    if not os.path.exists(cfg.EMBLEM_FILE):
        if not os.path.exists(cfg.EMBLEM_OUT):
            print('team emblem not found, the page is built without it:', cfg.EMBLEM_FILE)
            return None
        # the original stays outside the repository: use the watermarked copy as it is
        b64 = base64.b64encode(open(cfg.EMBLEM_OUT, 'rb').read()).decode('ascii')
        return {'team': 'Paisa Single Stage to Orbit', 'generator': 'Gemini', 'b64': b64}
    im = Image.open(cfg.EMBLEM_FILE).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    draw = ImageDraw.Draw(im, 'RGBA')
    draw.rectangle((0, SIZE - BAND, SIZE, SIZE), fill=(0, 0, 0, 205))
    try:
        font = ImageFont.load_default(FONT_SIZE)
    except TypeError:   # older Pillow: fixed-size bitmap font
        font = ImageFont.load_default()
    box = draw.textbbox((0, 0), WATERMARK, font=font)
    draw.text(((SIZE - (box[2] - box[0])) / 2 - box[0], SIZE - BAND + (BAND - (box[3] - box[1])) / 2 - box[1]), WATERMARK,
              font=font, fill=(255, 255, 255, 255))
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=86, optimize=True)
    im.save(cfg.EMBLEM_OUT, 'JPEG', quality=90)
    print('team emblem', SIZE, 'px, watermarked,', round(len(buf.getvalue()) / 1024), 'KB')
    return {'team': 'Paisa Single Stage to Orbit', 'generator': 'Gemini', 'b64': base64.b64encode(buf.getvalue()).decode('ascii')}
