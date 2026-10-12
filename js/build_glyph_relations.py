#!/usr/bin/env python3
"""Builds js/glyph_relations.json from the dump of the glyph table (https://chunom.org/media/glyphs.json).

python3 js/build_glyph_relations.py glyphs.json

Format: { "variant": ["v", "main glyph"] }, kind v = variant, s = simplified, t = traditional.
Drafts (is_draft) are left out, also as the target of a reference.
"""
import json, sys

KINDS = {'variant': 'v', 'simplified': 's', 'traditional': 't'}

fields = [entry['fields'] for entry in json.load(open(sys.argv[1], encoding='utf-8'))]
final = {f['code']: f for f in fields if not f['is_draft']}
relations = {
    chr(f['code']): [KINDS[f['category']], chr(f['reference'])]
    for f in final.values()
    if f['reference'] in final and f['category'] in KINDS
}
out = __file__.rsplit('/', 1)[0] + '/glyph_relations.json'
with open(out, 'w', encoding='utf-8') as file:
    json.dump(relations, file, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print(len(relations), 'relations ->', out)
