import re, sys

html = open(sys.argv[1], encoding='utf-8', errors='replace').read()

print('=== LINKS with text ===')
for m in re.finditer(r'<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', html):
    href, text = m.group(1), re.sub(r'<[^>]+>', '', m.group(2)).strip()
    if text:
        print(f'{href}  =>  {text[:60]}')

print('\n=== MENU ITEMS (li with class containing menu/nav) ===')
for m in re.finditer(r'<li[^>]*>([\s\S]*?)</li>', html):
    t = re.sub(r'<[^>]+>', ' ', m.group(1))
    t = re.sub(r'\s+', ' ', t).strip()
    if re.search(r'mantenimiento|servicio|soat|revis|mant|vehiculo|veh|taller|combustible|alerta|reporte', t, re.I) and len(t) < 150:
        print('-', t[:120])

print('\n=== FORMS/SELECTS ===')
for m in re.finditer(r'<(form|select|input|button)[^>]*>', html):
    print(m.group(0)[:160])
