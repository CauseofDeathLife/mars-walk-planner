"""Refresh data/rems_latest.json from NASA's public REMS weather feed (needs internet).
The page embeds this record as a fallback and also reads the feed live when it opens."""
import datetime
import json
import urllib.request

import config as cfg

FEED = 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json'


def main():
    with urllib.request.urlopen(FEED, timeout=60) as response:
        soles = json.load(response)['soles']
    valid = [r for r in soles if r.get('min_temp') not in (None, '--') and r.get('max_temp') not in (None, '--')]
    latest = max(valid, key=lambda r: int(r['sol']))
    record = {'source': FEED, 'retrieved': datetime.date.today().isoformat(),
              'credit': 'REMS, Centro de Astrobiología (CAB, CSIC-INTA) · NASA/JPL-Caltech', 'latest': latest}
    json.dump(record, open(cfg.REMS_FILE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('sols in feed', len(soles), '· latest valid sol', latest['sol'], latest['terrestrial_date'])


if __name__ == '__main__':
    main()
