"""Summarise a Search Console Performance export (the .xlsx from Export > Download Excel).
   python3 scripts/gsc-summary.py research/status/gsc/<date>.xlsx
Prints JSON: totals, daily averages, top queries and pages, device split."""
import json, sys
import openpyxl

wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
sheet = lambda name: [r for r in list(wb[name].iter_rows(values_only=True))[1:] if r and r[0] is not None]
days = sheet('Chart')
clicks = sum(r[1] for r in days); impr = sum(r[2] for r in days)
pos = sum(r[4] * r[2] for r in days) / impr if impr else None
def top(name, key, n=10):
    rows = sheet(name)
    return [{'item': r[0], 'clicks': int(r[1]), 'impressions': int(r[2]), 'position': round(r[4], 1)} for r in sorted(rows, key=key)[:n]]
filters = dict(sheet('Filters'))
print(json.dumps({
    'range': filters.get('Date'), 'from': days[0][0], 'to': days[-1][0], 'days': len(days),
    'clicks': int(clicks), 'impressions': int(impr), 'ctr': round(clicks / impr, 4) if impr else None,
    'position': round(pos, 1) if pos else None,
    'clicksPerDay': round(clicks / len(days), 2), 'impressionsPerDay': round(impr / len(days)),
    'topQueriesByClicks': top('Queries', lambda r: (-r[1], -r[2])),
    'topQueriesByImpressions': top('Queries', lambda r: -r[2]),
    'topPagesByClicks': top('Pages', lambda r: (-r[1], -r[2])),
    'devices': {r[0]: {'clicks': int(r[1]), 'impressions': int(r[2]), 'position': round(r[4], 1)} for r in sheet('Devices')},
}, indent=1))
