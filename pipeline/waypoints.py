"""Curiosity stops from MSL_waypoints.json (easting/northing already in the DTM projection)."""
import json
import pandas as pd
from paths import WAYPOINTS_FILE


def load_waypoints():
    feats = json.load(open(WAYPOINTS_FILE, encoding='utf-8'))['features']
    df = pd.DataFrame([f['properties'] for f in feats])
    return df.sort_values(['sol', 'site', 'drive'], kind='stable').reset_index(drop=True)
