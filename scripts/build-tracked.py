"""Builds research/status/tracked-keywords.json: the fixed list the monthly report checks.
Run once (and again only on purpose). Same list every month = comparable months.
  python3 scripts/build-tracked.py research/status/gsc/2026-11-05.xlsx"""
import json, re, sys, glob
import openpyxl

kw = json.load(open('research/keywords.json'))
types = {u['slug']: u['type'] for u in json.load(open('src/data/urls.json'))}
group_of = {'service': 'Services', 'hub': 'Services', 'home': 'Services', 'guide': 'Guides', 'about': 'Brand', 'contact': 'Brand'}
tracked = {}
def add(k, vol, page, group, source):
    k = k.lower().strip()
    if k in tracked:
        if (vol or 0) > (tracked[k]['volume'] or 0): tracked[k].update(volume=vol)
        return
    tracked[k] = {'keyword': k, 'volume': vol, 'page': page, 'group': group, 'source': source}

# Researched keywords with real volume (NZ, monthly).
for slug, v in kw.items():
    page = slug or ''
    for k, n in (v.get('volumes') or {}).items():
        if n and n >= 50 and v.get('type') != 'suburb':
            add(k, n, page, group_of.get(v.get('type'), 'Services'), 'research')

# Searches the site already appears for (Search Console, 100+ impressions in 3 months).
wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
for r in list(wb['Queries'].iter_rows(values_only=True))[1:]:
    if r[0] and r[2] >= 100:
        add(r[0], None, None, 'Search Console', f'gsc {int(r[2])} impressions')

# Brand.
for k in ['heat pumps hq', 'heat pumps hq christchurch', 'heat pump hq christchurch']:
    add(k, None, '', 'Brand', 'brand')

# Every suburb page's own keyword, reported as a group.
for f in sorted(glob.glob('src/content/*.md')):
    slug = f.split('/')[-1][:-3]
    if types.get(slug) != 'suburb': continue
    m = re.search(r'^keyword: *"?([^"\n]+)"?$', open(f).read(), re.M)
    if m: add(m.group(1), (kw.get(slug, {}).get('volumes') or {}).get(m.group(1)), slug, 'Suburbs', 'page keyword')

out = sorted(tracked.values(), key=lambda x: (x['group'], -(x['volume'] or 0), x['keyword']))
json.dump(out, open('research/status/tracked-keywords.json', 'w'), indent=1)
from collections import Counter
print(len(out), dict(Counter(x['group'] for x in out)))
