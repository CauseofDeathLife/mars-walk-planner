"""Check: the DTM reader must reproduce the terrain elevations that Global Mapper gives at Curiosity's stops."""
import time
import numpy as np
import pandas as pd
from paths import DTM_FILE, EXPORTS_DIR
from dtm_reader import read_dtm
from raster_sampling import bilinear
import os

t0 = time.time()
dem, info = read_dtm(DTM_FILE)
print('read s', round(time.time() - t0, 1), dem.shape, np.nanmin(dem), np.nanmax(dem), 'nan%', round(np.isnan(dem).mean() * 100, 1))
gm = pd.read_csv(os.path.join(EXPORTS_DIR, 'msl_track_terrain.csv'))
mine = bilinear(dem, info, gm.easting, gm.northing)
diff = mine - gm.terrain_elev.values
ok = ~np.isnan(diff)
print('points', ok.sum(), 'max abs diff m', np.nanmax(np.abs(diff[1:])), 'first row diff', diff[0])
