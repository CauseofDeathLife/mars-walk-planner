"""Folder layout of the project: every script resolves its files from here."""
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, 'data')        # downloaded NASA files (read-only)
INPUTS_DIR = os.path.join(ROOT_DIR, 'inputs')    # CSVs prepared for Global Mapper
EXPORTS_DIR = os.path.join(ROOT_DIR, 'exports')  # files exported from Global Mapper / Excel
RESULTS_DIR = os.path.join(ROOT_DIR, 'results')  # outputs of these scripts

DTM_FILE = os.path.join(DATA_DIR, 'DTEEC_009149_1750_009294_1750_U01.tif')
WAYPOINTS_FILE = os.path.join(DATA_DIR, 'MSL_waypoints.json')
MARS_RADIUS_M = 3396190.0  # sphere used by the DTM projection (IAU 2015)
