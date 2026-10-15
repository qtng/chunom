# qtng/chunom

The dictionary site of Chữ Nôm (search, character details popup, decks and practice, Nôm writer, Génibrel and Bonet dictionaries) in `index.html`, `writer.html`, `decks/`, `dict/`, `js/`, `css/`, with the data `dict.csv`, `js/*.json`.
Served at `/chunom/` of the Chunom site. The menu (`js/navigation.js`, also the translation `Lang`) is the one of `qtng/qatt`, loaded from `https://qatt.org/js/navigation.js`; the logo and icons of the Chunom site are in `img/`. `js/detail.js` (the details popup) is also loaded by pages of other sites, so it finds its files from its own script URL.
Images, audio, fonts and scans are not in this repository but in `qtng/chunom-assets` (`/chunom-assets/…`). The landing pages for search engines are generated in `qtng/pages` from `dict.csv` and `js/glyph_relations.json`; after changing those files, regenerate there.
`js/check_font_coverage.py` reports which characters of the data a font covers.
`translate.html` (Quốc Ngữ → Chữ Nôm) is the translator: the page builds the Chữ Nôm options of every syllable and compound (`dict.csv`, `js/ime.js`; the usual character of the dictionary is marked `*`) and sends them to the Supabase Edge Function `translate2` (source in `qtng/qatt` `supabase/functions/translate2/`, project ChunomApp). The model only chooses from the lists in the context of the sentence and may name a character of its own only where no option fits (shown as uncertain), so the reading of a chosen character is right by construction; the page rates every word (from the list / model's own / uncertain). It can also return a free translation of the sentence into a language chosen on the page (`lang`, allow-list `LANGUAGES` in the function; stored in `localStorage.translate_target`). While the answer is awaited a small animation (four characters) is shown.
The function loads its prompts and the order of the model names from `js/translate2_prompts.json` of this site (cached 1 minute, fetched with a cache-busting query; if the file is missing or invalid it uses the defaults built into the function and logs it). So a prompt change is a commit here, no deploy; change `version` in the file with every edit (the function logs it, the page shows it under the result). Each prompt is a list of lines, `{{name}}` marks the values the function fills in (`main`: `text`, `syllables`, `spans`; `retry`: `error`; `translation`: `language`, appended only when the page sends `lang`); the file is rejected as a whole when a required placeholder is missing. `translate-chatbot.html` is the manual variant for a chatbot (the same protocol as one prompt).
The older two-step translator (Edge Function `translate`, `js/translate_prompts.json`) is no longer used by a page; it can be deleted.

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
- There is **one `js/navigation.js`** (menu bar, brand, bottom bar on phones, and the translation `Lang`), in `qtng/qatt`, served at `https://qatt.org/js/navigation.js`. The pages of the Chunom site load it from there with `<script src="https://qatt.org/js/navigation.js"></script>` early in `<head>` (a normal script, not `defer`, so that the page is translated while it is parsed). It picks brand, logo, icons, colours and the own block of the menu from the address of the page (`chunom.org`, `v2.chunom.org` or the folders `/chunom/`, `/pages/`, `/chunom-assets/` = Chunom site, else qatt.org); the constants `CHUNOM_SITE` and `QATT_SITE` hold the absolute addresses for the links to the other site. The Chunom logo and icons are in `chunom/img/`.
- The Supabase login (decks, practice) is stored in `localStorage`, i.e. **per origin**: a user signed in on `qatt.org` is not signed in on the Chunom site.
- The site is plain HTML and JavaScript with Bootstrap 5.3, no build step. Local preview of the real URLs is not possible; to test, serve the repos under mocked hosts (Playwright `page.route` mapping `https://v2.chunom.org/chunom/*`, `/chunom-assets/*`, `/pages/*` and `https://qatt.org/*` to the checkouts) and look for 404s and console errors.

## Translation (Vietnamese)

`js/navigation.js` defines `Lang` (also on the Chunom site). The language is `localStorage.lang` (`en` or `vi`) if somebody chose it (the switch EN | VI next to the menu button in the menu bar, also in `license.html` of qatt.org, or `?lang=vi` in the address), else the first of English and Vietnamese in the languages of the browser (`vi` only if it comes before `en`). It is not stored until it was chosen.
In `vi`, a MutationObserver gives every tag with `data-vi` the text of that attribute as its text content (the English text is kept and returns in `en`). It works while the page is parsed and for tags that JavaScript adds or changes later.

Rules when you write or change pages:

- A text that is translated sits **in a tag of its own without tags inside**: `<span data-vi="Ký hiệu">Symbols</span>`. Tags with tags inside are not translated. The English text stays in the tag and must not be empty.
- When the user says that something is called `xyz` in Vietnamese, put `data-vi="xyz"` on the tag of that text (wrap the text in a `<span>` if it has no tag of its own).
- When the English text of a tag that has `data-vi` changes, renew its translation too and tell the user which ones (translations written by Claude are drafts: say so).
- Texts are written in sentence case, not title case ("Symbol table", "Next word"); only app names such as Sound Check are capitalised.
- Scope: translate interface elements (buttons, menu entries, labels, option groups, placeholders) and headings. Long texts (paragraphs, explanations) stay English; single English words in a Vietnamese interface are fine, a completely foreign interface is not.
- In JavaScript just set the text of such a tag (or add one with `data-vi`); the observer translates it. `Lang.t("English", "Tiếng Việt")` gives a text for a string that is not in a tag; the event `langchange` (on `document`) is sent when the language is switched. Attributes: `data-vi-label`, `data-vi-title`, `data-vi-placeholder` and `data-vi-aria-label` give the attribute without the prefix its Vietnamese text (e.g. the `label` of an `<optgroup>`: `<optgroup label="Choose font" data-vi-label="Lựa chọn phông chữ">`).

## Going live on chunom.org

1. DNS of `chunom.org` to GitHub Pages (A records `185.199.108.153` … `185.199.111.153`; `www` as CNAME to `qtng.github.io`), then set the custom domain `chunom.org` in `qtng.github.io` → Settings → Pages and enforce HTTPS. Never use "Unpublish site" to switch domains (it removes the certificate).
2. In `qtng/qatt` replace `v2.chunom.org` by `chunom.org` (`js/navigation.js` constant `CHUNOM_SITE`, `404.html` constant `CHUNOM_SITE`, `editor.html`, `type.html`, `practice/qatt.html`, `admin/index.html`).
3. In `qtng/pages` run `python3 tools/generate.py --site https://chunom.org` (add `--chunom ../chunom --assets ../chunom-assets` for local checkouts) and commit `docs/`.
4. Nothing to change in `qtng/chunom` and `qtng/chunom-assets` (root-relative paths).
5. Search Console: verify `chunom.org`, submit `https://chunom.org/pages/sitemap.xml`.
