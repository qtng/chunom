/* The font pages of the Chunom site (/chunom/fonts/): the catalogue (fonts/index.html) and one page per font (fonts/<id>/index.html), both drawn from fonts.json.
   A page has <main id="fonts" data-page="catalog"> or data-page="font" data-font="<id>"; the header (title, lead) is written in the page itself for search engines.
   fonts.json: assets (the folder of the font files), sizes (the waterfall), sample (the texts of the specimen), fonts [{id, name, family, tagline, lead, about, cover, styles
   [{name, weight, stroke, file, mb}]}], external (other fonts), charset (the Unicode table). A style's files are <assets><file>.ttf (download), -specimen.woff2 (about 150 KB:
   the 100 most common characters, the sample texts, Latin and the QATT letters) and, for a character the specimen lacks, the web files web/<file>-latin.woff2 and web/<file>-NN.woff2 (see faces).
   Texts in English and Vietnamese ({en, vi}) are put into tags with data-vi, so the Lang of navigation.js translates them (the Vietnamese texts are drafts). */
(() => {
  const BASE = new URL('./', document.currentScript.src);   // /chunom/fonts/
  const $ = (s, r = document) => r.querySelector(s);
  // an element: el('div.cls', {attr}, children...); a child {en, vi} becomes a span with data-vi
  const el = (tag, attrs = {}, ...kids) => {
    const [t, id] = tag.split('#'), [name, ...cls] = t.split('.'); const e = document.createElement(name);
    if (id) e.id = id;
    if (cls.length) e.className = cls.join(' ');
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) k === 'text' ? e.textContent = v : e.setAttribute(k, v);
    for (const k of kids.flat()) if (k != null) e.append(k && typeof k === 'object' && 'en' in k && !(k instanceof Node) ? tr(k) : k);
    return e;
  };
  const tr = t => el('span', { 'data-vi': t.vi }, t.en);
  const fam = (font, style) => `QATT Font ${font.id} ${style.name}`;
  const stack = (font, style) => `"${fam(font, style)}", "${fam(font, style)} Latin", "${fam(font, style)} Full", serif`;

  // @font-face for every style: the specimen first; a character it lacks comes from the web files of the font (hannom_web_slices.py of the private repository):
  // "<style> Latin" (web/<file>-latin.woff2: ASCII, Latin-1, Quốc Ngữ) and "<style> Full" (the CJK slices web/<file>-NN.woff2, each with its unicode-range of
  // web/slices.json, so a typed rare character loads a slice of a few hundred KB, not the whole font); the QATT letters are all in the specimen
  function faces(data, slices) {
    const css = data.fonts.flatMap(f => f.styles.map(s =>
      `@font-face { font-family: "${fam(f, s)}"; src: url("${data.assets}${s.file}-specimen.woff2") format("woff2"); }\n` +
      `@font-face { font-family: "${fam(f, s)} Latin"; src: url("${data.assets}web/${s.file}-latin.woff2") format("woff2"); }\n` +
      slices.map((range, i) => `@font-face { font-family: "${fam(f, s)} Full"; src: url("${data.assets}web/${s.file}-${String(i).padStart(2, '0')}.woff2") format("woff2"); unicode-range: ${range}; }`).join('\n'))).join('\n');
    document.head.append(el('style', { text: css }));
  }
  // black on white (default) or white on black: one switch for the page, remembered in this browser
  const SCHEME_KEY = 'fontsSpecimen';
  const setScheme = v => { document.documentElement.dataset.specimen = v; try { localStorage.setItem(SCHEME_KEY, v); } catch (e) {}
    document.querySelectorAll('.scheme button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); };
  try { document.documentElement.dataset.specimen = localStorage.getItem(SCHEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { document.documentElement.dataset.specimen = 'light'; }
  const scheme = () => { const box = el('div.scheme', { role: 'group', 'aria-label': 'Colours' },
      [['light', { en: 'Black on white', vi: 'Đen trên trắng' }], ['dark', { en: 'White on black', vi: 'Trắng trên đen' }]].map(([v, t]) => {
        const b = el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(document.documentElement.dataset.specimen === v) }, t);
        b.addEventListener('click', () => setScheme(v)); return b; }));
    return box; };
  // a line that fills its box: the font size is set so that the text spans the width (at most `max` px); again when the fonts arrive or the window changes
  const FIT = new Set();
  const fit = e => { const max = +e.dataset.max || 160; e.style.fontSize = max + 'px'; const w = e.clientWidth, s = e.scrollWidth;
    if (s > w && w > 0) e.style.fontSize = Math.max(8, Math.floor(max * w / s * 0.98)) + 'px'; };
  const fitAll = () => FIT.forEach(e => e.isConnected ? fit(e) : FIT.delete(e));
  const fitted = (e, max) => { e.classList.add('fit'); e.dataset.max = max; FIT.add(e); requestAnimationFrame(() => fit(e)); return e; };
  document.fonts && document.fonts.addEventListener('loadingdone', fitAll);
  window.addEventListener('resize', fitAll);
  // a row of the sizes: the text repeated so that the row is full whatever its size
  const fill = t => Array(8).fill(t).join('\u3000');
  const regular = f => f.styles.find(s => s.name === 'Regular') || f.styles[0];

  // ---- the catalogue
  function catalog(root, data) {
    root.append(el('div.toolbar', {}, el('span'), scheme()));
    root.append(el('div.catalog', {}, data.fonts.map(f => el('a.card-box.font-card', { href: new URL(f.id + '/', BASE).pathname },
      el('img.cover', { src: new URL(`${f.id}/${f.cover}`, BASE).pathname, alt: f.name, loading: 'lazy' }),
      el('div.body', {},
        el('h2', { text: f.name }),
        el('div.tag', {}, f.tagline),
        el('div.specimen', {}, fitted(el('div.sample', { style: `font-family: ${stack(f, regular(f))}`, text: Array.from(data.sample.line).slice(0, 8).join('') }), 140)),
        el('div.styles', { text: f.styles.map(s => s.name).join(' · ') + (f.styles.length > 1 ? '' : '') }))))));
    root.append(otherFonts(data, null));
  }

  // ---- a font page
  function page(root, data, id) {
    const font = data.fonts.find(f => f.id === id);
    if (!font) { root.append(el('p', { text: 'Unknown font: ' + id })); return; }
    const S = data.sample;
    root.append(el('img.cover.mb-3', { src: new URL(`${font.id}/${font.cover}`, BASE).pathname, alt: font.name }));

    // own text: Telex and the Chữ Nôm candidates of ime.js; the QATT line is the text converted (the words that have a reading)
    const own = el('input.form-control#own', { type: 'text', lang: 'vi', autocomplete: 'off', spellcheck: 'false', placeholder: 'chữ nôm', 'data-vi-placeholder': 'chữ nôm' });
    root.append(el('div.card-box.try', {},
      el('div.toolbar', {}, el('label.form-label', { for: 'own', 'data-vi': 'Văn bản của bạn (gõ Telex, chọn chữ Nôm trong danh sách)' }, 'Your own text (type Telex, choose the Chữ Nôm from the list)'), scheme()),
      own,
      el('div.note', { 'data-vi': 'Các chữ thông dụng nhất đã có sẵn; chỉ khi bạn gõ một chữ hiếm, phông đầy đủ (khoảng 10 MB) mới được tải.' }, 'The most common characters are built in; the full font (about 10 MB) is loaded only when you type a rare one.')));

    // the styles
    const box = el('div.card-box', {}, el('h2', {}, { en: font.styles.length > 1 ? 'Styles' : 'The font', vi: font.styles.length > 1 ? 'Các kiểu' : 'Phông chữ' }));
    for (const s of font.styles) {
      const f = `font-family: ${stack(font, s)}`;
      box.append(el('section.style', {},
        el('div.head', {}, el('h3', { text: s.name }),
          el('span.facts', {}, { en: 'Weight', vi: 'Độ đậm' }, ` ${s.weight} · `, { en: 'stroke', vi: 'nét' }, ` ${s.stroke} · TTF ~${s.mb} MB`)),
        el('div.specimen', {},
          fitted(el('div.big.own-big', { style: f, text: S.display }), 150),
          fitted(el('div.line.own-line', { style: f, text: S.line }), 80),
          fitted(el('div.qatt.own-qatt', { style: f, 'data-src': S.qatt, text: S.qatt }), 80),
          fitted(el('div.latin', { style: f, text: S.latin }), 48)),
        el('div.dl', {}, el('a.btn.btn-cinnabar.btn-pill', { href: data.assets + s.file + '.ttf', download: '' },
          el('i.bi.bi-download'), ' ', { en: 'Download', vi: 'Tải về' }, ' ' + s.name))));
    }
    root.append(box);

    // the sizes: the text from small to large, in the style chosen
    let cur = regular(font);
    const rows = el('div.specimen');
    // below the sizes always the same two lines (not the own text): a QATT text and a Quốc Ngữ text at fixedSize
    const fixedRow = t => el('div.row-size.fixed', {}, el('span.px', { text: S.fixedSize + ' px' }), el('div.txt', { style: `font-family: ${stack(font, cur)}; font-size: ${S.fixedSize}px`, text: fill(t) }));
    const drawSizes = () => { rows.replaceChildren(...data.sizes.map(px => el('div.row-size', {}, el('span.px', { text: px + ' px' }),
      el('div.txt.own-size', { style: `font-family: ${stack(font, cur)}; font-size: ${px}px`, text: fill(own.value.trim() || S.text) }))),
      fixedRow(S.fixedQatt), fixedRow(S.fixedLatin)); };
    const pick = el('div.pick', {}, font.styles.length > 1 ? font.styles.map(s => {
      const b = el('button', { type: 'button', 'aria-pressed': String(s === cur), text: s.name });
      b.addEventListener('click', () => { cur = s; pick.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawSizes(); });
      return b; }) : []);
    root.append(el('div.card-box.sizes', {}, el('h2', {}, { en: 'Sizes', vi: 'Cỡ chữ' }), pick, rows));
    drawSizes();

    // the own text goes into the big lines, the sizes and (converted) the QATT line; empty: the samples again
    const qattOf = t => (typeof QattText !== 'undefined' && typeof VietnameseParser !== 'undefined') ? QattText.convert(t, new VietnameseParser()) : t;   // top-level consts of their scripts, not properties of window
    const show = () => {
      const v = own.value.trim();
      root.querySelectorAll('.own-big').forEach(e => e.textContent = v || S.display);
      root.querySelectorAll('.own-line').forEach(e => e.textContent = v || S.line);
      root.querySelectorAll('.own-qatt').forEach(e => e.textContent = qattOf(v || S.qatt));
      root.querySelectorAll('.own-size').forEach(e => e.textContent = fill(v || S.text));
      fitAll();
    };
    own.addEventListener('input', show);
    // the scripts (ime.js, parser.js, qatt-text.js) are deferred: the page may be loaded before fonts.json arrives, or after
    const ready = () => { show(); if (window.VietIme) new VietIme(own, { candidates: true, telex: true, returnSelect: true }); };
    if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready);

    root.append(el('div.card-box', {}, el('h2', {}, { en: 'About the font', vi: 'Về phông chữ' }), el('p.mb-0', {}, font.about)));
    root.append(charset(data), licence(), otherFonts(data, font));
    root.append(el('p.note', {}, { en: 'QATT stands for', vi: 'QATT là viết tắt của' }, ' ', el('a', { href: 'https://qatt.org/', text: 'Quốc Âm Tân Tự' }),
      { en: ', a phonetic script for Vietnamese. This font has the QATT letters together with Han characters and Chữ Nôm.', vi: ', chữ viết ghi âm cho tiếng Việt. Phông này có các chữ QATT cùng với chữ Hán và chữ Nôm.' }));
  }

  function charset(data) {
    return el('div.card-box', {}, el('h2', {}, { en: 'Unicode ranges', vi: 'Phạm vi Unicode' }),
      el('p.mb-2', {}, { en: `Each font file has the same set of ${data.characters.toLocaleString('en')} characters.`, vi: `Mỗi tệp phông có cùng một bộ ${data.characters.toLocaleString('vi')} ký tự.` }),
      el('div.table-responsive', {}, el('table.ranges', {},
        el('thead', {}, el('tr', {}, el('th', { text: 'Group' }), el('th', { text: 'Blocks' }), el('th', { text: 'Range' }), el('th.n', { text: 'Characters' }))),
        el('tbody', {}, data.charset.map(([g, b, r, n]) => el('tr', {}, el('th', { scope: 'row', text: g }), el('td', { text: b }), el('td.r', { text: r }), el('td.n', { text: n.toLocaleString('en') })))))),
      el('p.note.mb-0', {}, { en: 'A character missing in the source data is missing in the font.', vi: 'Ký tự nào thiếu trong bộ chữ nguồn thì không có trong phông.' }));
  }

  function licence() {
    return el('div.card-box#licence', {}, el('h2', {}, { en: 'Licence', vi: 'Giấy phép' }),
      el('p.mb-2', {}, el('b', {}, { en: 'QATT letters', vi: 'Chữ QATT' }), ' (U+F0000–F00A3): © 2026 qatt.org, ', { en: 'all rights reserved.', vi: 'bảo lưu mọi quyền.' }, ' ',
        { en: 'You may use them to read, write and print QATT text, for yourself and for others, and embed subsets in documents such as PDF files.', vi: 'Bạn được dùng để đọc, viết và in văn bản QATT, cho mình và cho người khác, và nhúng tập con vào tài liệu như PDF.' }, ' ',
        { en: 'Changing them, building other fonts or works on them, and copying or passing them on need the written permission of qatt.org.', vi: 'Sửa đổi, dùng làm cơ sở cho phông khác, sao chép lại hay phân phối cần có sự cho phép bằng văn bản của qatt.org.' }, ' ',
        el('a', { href: 'https://qatt.org/fonts/LICENSE.txt', 'data-vi': 'Toàn văn giấy phép' }, 'Full licence text')),
      el('p.mb-2', {}, el('b', {}, { en: 'All other characters', vi: 'Các ký tự khác' }), ' (', { en: 'Han, Chữ Nôm, kana, Latin …', vi: 'chữ Hán, chữ Nôm, kana, Latin…' }, '): ',
        { en: 'the outlines are drawn from the stroke data of', vi: 'nét chữ được vẽ từ dữ liệu nét của' }, ' ', el('a', { href: 'https://glyphwiki.org/', target: '_blank', rel: 'noopener', text: 'GlyphWiki' }),
        { en: ', made by the GlyphWiki contributors, with the KAGE engine (GPL-3.0), and are used under the terms of GlyphWiki.', vi: ', do những người đóng góp GlyphWiki tạo ra, bằng bộ máy KAGE (GPL-3.0), và được dùng theo điều khoản của GlyphWiki.' }),
      el('p.note.mb-0', {}, { en: 'The fonts are not free software or open source and are provided as is, without warranty. The full text is inside every font file.', vi: 'Các phông này không phải phần mềm tự do hay mã nguồn mở, và được cung cấp nguyên trạng, không bảo hành. Toàn văn nằm trong mỗi tệp phông.' }));
  }

  // the other fonts of the catalogue (not on the catalogue itself) and fonts of other sites
  function otherFonts(data, font) {
    const ours = font ? data.fonts.filter(f => f !== font) : [];
    return el('div.card-box.links', {},
      ours.length ? el('h2', {}, { en: 'More fonts', vi: 'Các phông khác' }) : null,
      ours.length ? el('ul', {}, ours.map(f => el('li', {}, el('a', { href: new URL(f.id + '/', BASE).pathname, text: f.name }), ' – ', f.tagline))) : null,
      el('h2', { class: ours.length ? 'mt-3' : '' }, { en: 'More Chữ Nôm fonts', vi: 'Các phông chữ Nôm khác' }),
      el('ul', {}, data.external.map(x => el('li', {}, el('a', { href: x.url, target: '_blank', rel: 'noopener', text: x.name }), ' – ', { en: x.en, vi: x.vi }))));
  }

  fetch(new URL('fonts.json', BASE)).then(r => r.json()).then(async data => {
    const root = $('#fonts');
    faces(data, (await fetch(data.assets + 'web/slices.json').then(r => r.json())).slices);
    if (root.dataset.page === 'catalog') catalog(root, data); else page(root, data, root.dataset.font);
  }).catch(e => { $('#fonts').append(el('p', { text: 'The font list could not be loaded.' })); console.error(e); });
})();
