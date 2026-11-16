# Data

## In the repository

| File | What it is | Source |
|---|---|---|
| `MSL_waypoints.json` | Curiosity's drive stops (sol, site, drive, position in the DTM projection, roll, pitch, tilt) | NASA/JPL-Caltech, Mars Science Laboratory |
| `curiosity_photos.json` | Navcam frames taken at each target stop | https://mars.nasa.gov/api/v1/raw_image_items/ |
| `curiosity_track_photos.json` | Navcam frames at stops along Curiosity's track | https://mars.nasa.gov/api/v1/raw_image_items/ |
| `curiosity_color_photos.json` | Mastcam colour frames, where published | https://mars.nasa.gov/api/v1/raw_image_items/ |
| `rems_latest.json` | Latest REMS weather record (fallback when the live feed fails) | https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json |
| `donki_latest.json` | Latest CME reaching Mars in the WSA-ENLIL simulations (fallback) | https://api.nasa.gov/DONKI/WSAEnlilSimulations |
| `team_emblem_watermarked.png` | Team emblem, generated with AI (Gemini), cut round; carries a small visible "AI-generated image" watermark | Team Paisa Single Stage to Orbit |

Each JSON records its source, retrieval date and selection rule.

## Not in the repository (download before building)

These files are too large for GitHub. Put them in this folder with the same names.

| File | What it is | Source |
|---|---|---|
| `DTEEC_009149_1750_009294_1750_U01.tif` (182 MB) | HiRISE digital terrain model, 1 m, Mount Sharp | USGS: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/PSP_009149_1750_PSP_009294_1750/DTEEC_009149_1750_009294_1750_U01.tif |
| `PSP_009149_1750_RED_C_01_ORTHO.tif` (75 MB) | HiRISE orthoimage on the same 1 m grid as the DTM | HiRISE (MRO), USGS |
| `Mars_Viking_MDIM21_ClrMosaic_1km.jpg` (37 MB) | Viking MDIM 2.1 global colour mosaic, public domain | USGS: https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m · copy used: https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg |
