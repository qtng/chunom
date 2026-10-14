#!/usr/bin/env python3
"""Generates one static page per character of dict.csv: c/<HEX>/index.html, plus sitemap-characters.xml.

The pages hold the content as plain HTML (for search engines) and open the detail popup of js/detail.js on load.
Usage: python3 js/generate_pages.py        (run from the repository root; rewrites the folder c/)
"""
import csv, html, json, shutil, urllib.parse
from pathlib import Path

SITE = 'https://qatt.org/chunom'
ROOT = Path(__file__).resolve().parent.parent
KINDS = {'v': 'Variant', 's': 'Simplified', 't': 'Traditional'}


def is_char(text):
    return len(text) == 1  # a single code point (also beyond the BMP)


def hexcode(ch):
    return f'{ord(ch):X}'


def esc(text):
    return html.escape(str(text), quote=True)


rows = [r for r in csv.reader(open(ROOT / 'dict.csv', encoding='utf-8')) if len(r) >= 3]
relations = json.load(open(ROOT / 'js' / 'glyph_relations.json', encoding='utf-8'))

by_char = {}
for r in rows:
    if is_char(r[1]):
        by_char.setdefault(r[1], []).append(r)
chars = sorted(by_char, key=ord)

words = {}  # char -> compound words containing it
for r in rows:
    if not is_char(r[1]):
        for ch in dict.fromkeys(r[1]):
            if ch in by_char:
                words.setdefault(ch, []).append(r)

variants_of = {}
for variant, (kind, main) in relations.items():
    variants_of.setdefault(main, []).append((variant, kind))


def link(ch, label=None):
    return f'<a class="nom-link" href="{SITE}/c/{hexcode(ch)}/">{esc(ch)}</a>' if ch in by_char else f'<span class="nom-link">{esc(ch)}</span>'


def related(ch):
    items = []
    if ch in relations:
        kind, main = relations[ch]
        items.append((main, 'Standard form'))
        others = [(v, k) for v, k in variants_of.get(main, []) if v != ch]
    else:
        others = variants_of.get(ch, [])
    items += [(v, KINDS[k]) for v, k in others]
    return items


def page(ch):
    entries = by_char[ch]
    code = hexcode(ch)
    readings = list(dict.fromkeys(r[0] for r in entries))
    first = entries[0]
    meaning = first[2]
    title = f'{ch} – Chữ Nôm {", ".join(readings[:3])}'
    description = f'{ch} ({", ".join(readings[:3])}): {meaning}. Chữ Nôm character with readings, meanings, variants and example words.'
    rel = related(ch)
    meta = []
    for r in entries:
        extra = []
        if len(r) > 3 and r[3]:
            extra.append(f'Level {esc(r[3])}')
        if len(r) > 5 and r[5]:
            extra.append(f'Rank #{esc(r[5])}')
        meta.append(f'<tr><th scope="row">{esc(r[0])}</th><td>{esc(r[2])}</td><td class="text-secondary small">{" · ".join(extra)}</td></tr>')
    word_items = ''.join(f'<li><span class="nom">{esc(r[1])}</span> <b>{esc(r[0])}</b> – {esc(r[2])}</li>' for r in words.get(ch, [])[:30])
    ld = {
        '@context': 'https://schema.org', '@type': 'DefinedTerm', 'name': ch, 'description': meaning,
        'inDefinedTermSet': 'Chữ Nôm', 'url': f'{SITE}/c/{code}/', 'alternateName': readings,
    }
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
  <link rel="canonical" href="{SITE}/c/{code}/">
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
  <link rel="stylesheet" href="https://qatt.org/qatt/vendor/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://qatt.org/qatt/vendor/bootstrap-icons/bootstrap-icons.min.css">
  <link rel="stylesheet" href="https://qatt.org/chunom-assets/fonts/fonts.css">
  <script defer src="https://qatt.org/qatt/js/navigation.js"></script>
  <script defer src="https://qatt.org/qatt/js/qatt.js"></script>
  <script defer src="https://qatt.org/qatt/js/parser.js"></script>
  <script defer src="https://qatt.org/qatt/vendor/supabase/supabase.min.js"></script>
  <script defer src="https://qatt.org/qatt/js/supabase.js"></script>
  <script defer src="https://qatt.org/qatt/js/login.js"></script>
  <script defer src="{SITE}/js/detail.js"></script>
  <style>
    :root {{ --ink: #2b2118; --cinnabar: #a8362a; --paper: #f7efdc; --line: #e4d9c0; --muted: #7b6c58; }}
    body {{ background: #fffdf8; color: var(--ink); }}
    a {{ color: var(--cinnabar); }}
    .hero {{ background: radial-gradient(60rem 22rem at 50% -6rem, rgba(168, 54, 42, .10), transparent 70%), linear-gradient(180deg, var(--paper) 0%, #fffdf8 100%); border-bottom: 1px solid #e8dcc0; }}
    .nom {{ font-family: 'Nom Na Tong Supplement', 'NomKhai-Supplement', 'Han-Nom Gothic Supplement', serif; }}
    .hero .big {{ font-size: clamp(5rem, 22vw, 9rem); line-height: 1.25; }}
    .nom-link {{ font-family: 'Nom Na Tong Supplement', 'NomKhai-Supplement', 'Han-Nom Gothic Supplement', serif; font-size: 2rem; text-decoration: none; padding: 0 .3rem; }}
    .btn-cinnabar {{ background: var(--cinnabar); border-color: var(--cinnabar); color: #fff; border-radius: 2rem; padding: .5rem 1.3rem; }}
    .btn-cinnabar:hover {{ background: #8c2c22; border-color: #8c2c22; color: #fff; }}
    table {{ --bs-table-bg: transparent; }}
    .words {{ columns: 2 18rem; list-style: none; padding: 0; }}
    .words li {{ break-inside: avoid; margin-bottom: .35rem; }}
  </style>
</head>
<body>
  <header class="hero text-center py-5">
    <div class="container">
      <div class="big nom">{esc(ch)}</div>
      <h1 class="h2 font-serif">{esc(", ".join(readings))}</h1>
      <p class="lead mb-3">{esc(meaning)}</p>
      <button type="button" class="btn btn-cinnabar" id="open-detail"><i class="bi bi-card-text me-1"></i> Show details</button>
      <a class="btn btn-outline-secondary rounded-pill ms-1" href="{SITE}/index.html?search={urllib.parse.quote(readings[0])}">Search the dictionary</a>
    </div>
  </header>
  <main class="container py-5" style="max-width: 46rem">
    <h2 class="h5">Readings and meanings</h2>
    <table class="table mb-5"><tbody>{"".join(meta)}</tbody></table>
{f'<h2 class="h5">Related characters</h2><p class="mb-5">' + "".join(f'{link(c)} <small class="text-secondary me-3">{esc(k)}</small>' for c, k in rel) + '</p>' if rel else ''}
{f'<h2 class="h5">Words with {esc(ch)}</h2><ul class="words mb-5">{word_items}</ul>' if word_items else ''}
    <p class="text-secondary small">Chữ Nôm dictionary · <a href="{SITE}/index.html">chunom.org</a></p>
  </main>
  <script>
    // the same popup as on the dictionary page (js/detail.js): readings, glyphs, "Add to deck"
    window.addEventListener('load', () => {{
      const open = () => ChunomDetail.open({json.dumps(ch, ensure_ascii=False)});
      document.getElementById('open-detail').addEventListener('click', open);
      ChunomDetail.get().configure({{ urlFor: () => location.href }});
      open();
    }});
  </script>
</body>
</html>
'''


out = ROOT / 'c'
shutil.rmtree(out, ignore_errors=True)
for ch in chars:
    d = out / hexcode(ch)
    d.mkdir(parents=True)
    (d / 'index.html').write_text(page(ch), encoding='utf-8')

urls = ''.join(f'  <url><loc>{SITE}/c/{hexcode(ch)}/</loc></url>\n' for ch in chars)
(ROOT / 'sitemap-characters.xml').write_text(
    f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n', encoding='utf-8')
print(f'{len(chars)} pages written to {out}')
