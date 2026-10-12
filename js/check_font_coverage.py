#!/usr/bin/env python3
"""Prüft, welche Zeichen aus dict.csv, den IME-Wörterbüchern und glyphs.json eine Schrift enthält.

Aufruf: python3 js/check_font_coverage.py FONT.ttf [glyphs.json]
"""
import csv, json, sys, os
from fontTools.ttLib import TTFont

here = os.path.dirname(os.path.abspath(__file__))
font = TTFont(sys.argv[1], fontNumber=0)
cmap = set()
for table in font['cmap'].tables:
    cmap.update(table.cmap)

def report(name, chars):
    chars = {c for c in chars if c.strip()}
    missing = sorted(c for c in chars if not all(ord(ch) in cmap for ch in c))
    print(f'{name}: {len(chars) - len(missing)}/{len(chars)} enthalten ({100 * (len(chars) - len(missing)) / max(len(chars), 1):.1f} %)')
    return missing

with open(os.path.join(here, 'dict.csv'), newline='', encoding='utf-8') as f:
    csv_chars = {ch for row in csv.reader(f) if len(row) > 1 for ch in row[1]}
miss = report('dict.csv', csv_chars)
print('  fehlend (Beispiele):', ' '.join(miss[:40]))

for name in ('base_chars.json', 'generated_chars.json'):
    p = os.path.join(here, name)
    if os.path.exists(p):
        # Format: {"dict": "lesung:zeichen,zeichen|lesung:zeichen..."}
        entries = json.load(open(p, encoding='utf-8'))['dict'].split('|')
        chars = {ch for e in entries if ':' in e for ch in e.split(':', 1)[1] if ch != ','}
        miss = report(name, chars)
        print('  fehlend (Beispiele):', ' '.join(miss[:40]))

if len(sys.argv) > 2:
    data = json.load(open(sys.argv[2], encoding='utf-8'))
    glyphs = data if isinstance(data, list) else data.get('glyphs', [])
    chars = {chr(int(g['reference'])) for g in glyphs if not g.get('is_draft') and str(g.get('reference', '')).isdigit()}
    miss = report('glyphs.json', chars)
    print('  fehlend (Beispiele):', ' '.join(miss[:40]))
