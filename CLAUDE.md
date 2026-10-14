# qtng/chunom

The dictionary site of Chữ Nôm (search, character details popup, decks and practice, Nôm writer, Génibrel and Bonet dictionaries) in `index.html`, `writer.html`, `decks/`, `dict/`, `js/`, `css/`, with the data `dict.csv`, `js/*.json`.
Served at `/chunom/` of the Chunom site. `js/navigation.js` is the menu of the Chunom site only; its logo and icons are in `img/`. `js/detail.js` (the details popup) is also loaded by pages of other sites, so it finds its files from its own script URL.
Images, audio, fonts and scans are not in this repository but in `qtng/chunom-assets` (`/chunom-assets/…`). The landing pages for search engines are generated in `qtng/pages` from `dict.csv` and `js/glyph_relations.json`; after changing those files, regenerate there.
`js/check_font_coverage.py` reports which characters of the data a font covers.

## The sites and their four repositories

Two websites, hosted with GitHub Pages, built from four repositories of the GitHub account `qtng`:

| Repository | Served at | How |
|---|---|---|
| `qtng/qatt` | `https://qatt.org/` (root) | custom domain `qatt.org` set on this repo |
| `qtng/qtng.github.io` | `https://v2.chunom.org/` (`https://chunom.org/` when live) | the user site; its custom domain is `v2.chunom.org`; the other repos below hang under it as sub-paths |
| `qtng/chunom` | `https://v2.chunom.org/chunom/` | project site of `qtng.github.io` (dictionary, decks, writer, dictionaries) |
| `qtng/pages` | `https://v2.chunom.org/pages/` | project site, published from its folder `docs/` (landing pages of the characters) |
| `qtng/chunom-assets` | `https://v2.chunom.org/chunom-assets/` | project site (images, audio, fonts, scans; no code) |

`chunom`, `pages` and `chunom-assets` are **one site** (the Chunom site, same origin); `qatt` is **a separate site** (another origin).
GitHub Pages allows one custom domain per repository, which is why `qatt` has its own domain and the others share `qtng.github.io`.
When the Chunom site goes live, `v2.chunom.org` becomes `chunom.org` (see "Going live").

Old addresses that must keep working: `chunom.org/pages/<HEX>/`, `chunom.org/pages/grade/<N>/`, `chunom.org/pages/pa/`, `…/fonts/`, `…/links/` (same paths in `qtng/pages`),
`/pages/genibrel/`, `/pages/bonet/`, `/pages/ime/`, `/pages/imepad/`, `/pages/moses/`, `/pages/standard/` (redirect stubs in `qtng/pages`), and
`qatt.org/qatt/<path>` (now `qatt.org/<path>`), `qatt.org/chunom/…`, `qatt.org/chunom-assets/…`, `qatt.org/pages/…` (forwarded by `qtng/qatt/404.html`).

## URL rules (important when you add or change a link)

- **Inside the Chunom site** (`chunom`, `pages`, `chunom-assets`) use **root-relative** paths: `/chunom/js/detail.js`, `/chunom-assets/fonts/fonts.css`, `/pages/site.js`. Never write the domain, so the same file works on `v2.chunom.org` and `chunom.org`.
- **From the Chunom site to qatt.org** use **absolute** URLs: `https://qatt.org/vendor/bootstrap/…` (Bootstrap, Bootstrap Icons, Supabase), `https://qatt.org/js/qatt.js`, `parser.js`, `supabase.js`, `login.js`, `https://qatt.org/fonts/…`.
- **Inside qatt.org** use **root paths** without any folder prefix: `/js/navigation.js`, `/editor.html`, `/img/logo.svg` (the old prefix `/qatt/` no longer exists).
- **From qatt.org to the Chunom site** use **absolute** URLs with the domain: `https://v2.chunom.org/chunom/js/ime.js`, `https://v2.chunom.org/chunom-assets/fonts/fonts.css`.
- **Scripts that other pages load across sites** (`chunom/js/detail.js`, `ime.js`, `practice.js`) must not assume their own origin: they derive their location from `document.currentScript.src` (e.g. `new URL('../../', BASE)` = root of the Chunom site).
- Canonical links, `og:` tags and the sitemap need absolute URLs; `qtng/pages` writes them from `tools/generate.py --site …`.
- Each site has **its own `js/navigation.js`** (menu bar, brand, bottom bar on phones): `qtng/qatt/js/navigation.js` (Qatt.org brand, `CHUNOM_SITE` constant for the Chunom links) and `qtng/chunom/js/navigation.js` (Chunom.org brand, own logo and icons in `chunom/img/`, `QATT_SITE` constant). They do not share code.
- The Supabase login (decks, practice) is stored in `localStorage`, i.e. **per origin**: a user signed in on `qatt.org` is not signed in on the Chunom site.
- The site is plain HTML and JavaScript with Bootstrap 5.3, no build step. Local preview of the real URLs is not possible; to test, serve the repos under mocked hosts (Playwright `page.route` mapping `https://v2.chunom.org/chunom/*`, `/chunom-assets/*`, `/pages/*` and `https://qatt.org/*` to the checkouts) and look for 404s and console errors.

## Going live on chunom.org

1. DNS of `chunom.org` to GitHub Pages (A records `185.199.108.153` … `185.199.111.153`; `www` as CNAME to `qtng.github.io`), then set the custom domain `chunom.org` in `qtng.github.io` → Settings → Pages and enforce HTTPS. Never use "Unpublish site" to switch domains (it removes the certificate).
2. In `qtng/qatt` replace `v2.chunom.org` by `chunom.org` (`js/navigation.js` constant `CHUNOM_SITE`, `404.html` constant `CHUNOM_SITE`, `editor.html`, `type.html`, `practice/qatt.html`, `admin/index.html`).
3. In `qtng/pages` run `python3 tools/generate.py --site https://chunom.org` (add `--chunom ../chunom --assets ../chunom-assets` for local checkouts) and commit `docs/`.
4. Nothing to change in `qtng/chunom` and `qtng/chunom-assets` (root-relative paths).
5. Search Console: verify `chunom.org`, submit `https://chunom.org/pages/sitemap.xml`.
