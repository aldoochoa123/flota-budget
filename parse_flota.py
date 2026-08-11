import re, sys

html = open(sys.argv[1], encoding='utf-8', errors='replace').read()

print('=== TABLE ROWS ===')
for tr in re.finditer(r'<tr[^>]*>([\s\S]*?)</tr>', html):
    cells = []
    for td in re.finditer(r'<td[^>]*>([\s\S]*?)</td>', tr.group(1)):
        t = re.sub(r'<[^>]+>', ' ', td.group(1))
        t = re.sub(r'\s+', ' ', t).strip()
        cells.append(t[:40])
    if cells:
        print(' | '.join(cells))

print('\n=== AJAX / URL refs in scripts ===')
for m in re.finditer(r'url\s*[:=]\s*["\']([^"\']*)["\']', html):
    print(m.group(1))
for m in re.finditer(r'window\.open\(["\']([^"\']*)["\']', html):
    print('open:', m.group(1))

print('\n=== Script sources ===')
for m in re.finditer(r'<script[^>]*src="([^"]*)"', html):
    print(m.group(1))
