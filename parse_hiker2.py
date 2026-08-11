import re, sys

html = open(sys.argv[1], encoding='utf-8', errors='replace').read()

# strip scripts and styles for text view
body = re.sub(r'<script[\s\S]*?</script>', '', html)
body = re.sub(r'<style[\s\S]*?</style>', '', body)

print('=== VISIBLE TEXT (first 3000 chars) ===')
text = re.sub(r'<[^>]+>', '\n', body)
text = re.sub(r'\n\s*\n+', '\n', text)
print(text.strip()[:3000])

print('\n=== BUTTONS / CLICKABLE ===')
for m in re.finditer(r'<(button|a|div|li)[^>]*(?:onclick|data-url|data-href|href)="([^"]*)"[^>]*>', html):
    tag, attr = m.group(1), m.group(2)
    inner = re.sub(r'<[^>]+>', '', m.group(0))
    print(f'<{tag}> attr="{attr}" text="{inner.strip()[:40]}"')

print('\n=== INPUTS/SELECTS ===')
for m in re.finditer(r'<(input|select|option)[^>]*>', html):
    print(m.group(0)[:140])
