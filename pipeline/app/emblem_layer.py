"""Team emblem for the page. The emblem was generated with AI (Gemini), so the copy used here carries a
visible watermark, as the Space Apps submission guide requires for AI-generated images."""
import base64
import io
import os
from PIL import Image, ImageDraw, ImageFont

import config as cfg

SIZE = 512
WATERMARK = 'AI-generated image'
FONT_SIZE = 14     # small, in the transparent bottom-right corner outside the round cut: it covers none of the drawing
MARGIN = 4


def build():
    """Round watermarked emblem as a base64 WebP, or None when the file is missing."""
    if not os.path.exists(cfg.EMBLEM_FILE):
        if not os.path.exists(cfg.EMBLEM_OUT):
            print('team emblem not found, the page is built without it:', cfg.EMBLEM_FILE)
            return None
        # the original stays outside the repository: use the watermarked copy as it is
        b64 = base64.b64encode(open(cfg.EMBLEM_OUT, 'rb').read()).decode('ascii')
        return {'team': 'Paisa Single Stage to Orbit', 'generator': 'Gemini', 'mime': 'image/png', 'b64': b64}
    im = Image.open(cfg.EMBLEM_FILE).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')
    # round cut: transparent outside the circle (4x supersampled mask for a smooth edge)
    mask = Image.new('L', (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(mask).ellipse((4, 4, SIZE * 4 - 5, SIZE * 4 - 5), fill=255)
    im.putalpha(mask.resize((SIZE, SIZE), Image.LANCZOS))
    # watermark on its own layer, in the bottom-right corner
    layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    try:
        font = ImageFont.load_default(FONT_SIZE)
    except TypeError:   # older Pillow: fixed-size bitmap font
        font = ImageFont.load_default()
    box = draw.textbbox((0, 0), WATERMARK, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    x, y = SIZE - MARGIN - 5 - w, SIZE - MARGIN - 4 - h
    draw.rounded_rectangle((x - 5, y - 3, x + w + 5, y + h + 4), radius=4, fill=(0, 0, 0, 170))
    draw.text((x - box[0], y - box[1]), WATERMARK, font=font, fill=(255, 255, 255, 235))
    im = Image.alpha_composite(im, layer)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=88, method=6)
    im.save(cfg.EMBLEM_OUT, 'PNG', optimize=True)
    print('team emblem', SIZE, 'px, watermarked,', round(len(buf.getvalue()) / 1024), 'KB')
    return {'team': 'Paisa Single Stage to Orbit', 'generator': 'Gemini', 'mime': 'image/webp', 'b64': base64.b64encode(buf.getvalue()).decode('ascii')}
