"""Shared settings of the Mars Walk Planner pipeline: files, working area, route limits and page encoding."""
import os
import sys

APP_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(APP_DIR))  # reuse the tested modules of pipeline/

from paths import ROOT_DIR, DATA_DIR, RESULTS_DIR  # noqa: E402

OUT_DIR = os.path.join(RESULTS_DIR, 'app')
WEB_DIR = os.path.join(ROOT_DIR, 'web')                                    # page template, styles and scripts
POINTS_FILE = os.path.join(OUT_DIR, 'points.json')
ROUTES_FILE = os.path.join(OUT_DIR, 'routes.json')
ROUTES_SUMMARY_FILE = os.path.join(OUT_DIR, 'routes_summary.csv')
PAGE_FILE = os.path.join(ROOT_DIR, 'public', 'index.html')                 # the published page
SMOOTH_TRACK_FILE = os.path.join(RESULTS_DIR, 'msl_track_smooth.csv')   # smooth_track.py
TRACK_FILE = SMOOTH_TRACK_FILE if os.path.exists(SMOOTH_TRACK_FILE) else os.path.join(RESULTS_DIR, 'msl_track_aligned.csv')
TRACK_PHOTOS_FILE = os.path.join(DATA_DIR, 'curiosity_track_photos.json')   # Navcam frames at stops along the track
ORTHO_FILE = os.path.join(DATA_DIR, 'PSP_009149_1750_RED_C_01_ORTHO.tif')   # HiRISE orthoimage, same grid as the DTM
REMS_FILE = os.path.join(DATA_DIR, 'rems_latest.json')                      # latest REMS weather record (fetch_rems.py)
PHOTOS_FILE = os.path.join(DATA_DIR, 'curiosity_photos.json')               # Navcam frames taken at each target stop
COLOR_PHOTOS_FILE = os.path.join(DATA_DIR, 'curiosity_color_photos.json')   # Mastcam colour frames, where published
GLOBE_FILE = os.path.join(DATA_DIR, 'Mars_Viking_MDIM21_ClrMosaic_1km.jpg')   # Viking global colour mosaic (entrance globe)
GLOBE_CACHE = os.path.join(OUT_DIR, 'globe_texture.jpg')
EMBLEM_FILE = os.path.join(ROOT_DIR, '..', 'team_emblem', 'v7_no_grid_final.jpeg')   # AI-generated (Gemini), kept outside the repository
EMBLEM_OUT = os.path.join(DATA_DIR, 'team_emblem_watermarked.jpg')          # the only copy in the repository
DONKI_FILE = os.path.join(DATA_DIR, 'donki_latest.json')                    # latest CME reaching Mars (DONKI WSA-ENLIL)

# Working area: 3.5 km square around Curiosity's stretch of test 1.7 (projected metres of the DTM)
AREA_CENTER = (8143900.0, -284800.0)
AREA_HALF_M = 1750.0

PLAN_FACTOR = 5            # 5 x 5 block mean of the 1 m DTM for the first search
SLOPE_LIMIT_DEG = 15.0     # MoonPath (Pena-Asensio et al. 2024); always verified at 1 m
PLANNING_LIMITS_DEG = (14.5, 14.0, 13.5)   # 1 m search runs with a margin (check 1.8b)
CORRIDOR_M = 100.0         # 1 m search stays this close to the 5 m route

# Site selection
HABITAT_FLAT_DEG = 5.0     # max terrain slope inside the habitat footprint
HABITAT_WINDOW = 9         # footprint in 5 m cells (45 m)
WALK_RADIUS_M = (400.0, 2000.0)   # targets between these straight distances (2 km: Kring)
N_TARGETS = 7
N_ISOLATED = 2
ISLAND_MIN_CELLS = 200     # an isolated walkable area must be at least 5000 m2

# Documented result of validate_dtm_reader.py: own DTM reader against Global Mapper at 238 stops
READER_CHECK = {'points': 238, 'max_err_mm': 0.73}
# check_ortho_alignment.py: brightness-vs-relief match of the orthoimage, in metres
ORTHO_MATCH_M = (1, 3)

# Page terrain encoding
Z_MIN, Z_STEP = -4410.0, 0.05
OVERVIEW_FACTOR = 10
