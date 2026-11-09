/* The font catalogue of the Chunom site (/chunom/fonts/, fonts/index.html): the bands with the specimens are in the page; this script adds the popup of a font (downloads, a
   field to try it, the sizes), the boxes about the characters and the licence and the list of the other Chữ Nôm fonts, all from fonts.json.
   The popup of a font has an address of its own, /chunom/fonts#<id> (the old font pages fonts/<id>/ forward there): a link to #<id> opens it, the back button and Esc close it.
   It takes the colours, the number and the watermark of the band it was opened from (opened from an address: the first band that links to it).
   fonts.json: assets (the folder of the .ttf files: https://cdn.qatt.org/fonts/, the R2 bucket; its TTFs carry Content-Disposition: attachment, so the download attribute works across origins), characters (how many every file has), sizes (the size ladder), sample (line: the CJK sample, qatt: the QATT sample),
   fonts [{id, name, family (the name in the font menus), styles [{name, css (the family of js/fonts.js of qatt.org: CJK slices, "<css> Latin"), file, mb}]}],
   external (other fonts), charset (the Unicode table).
   The fonts are those of js/fonts.js of qatt.org (written by navigation.js), so the popup loads only the slices of the characters it shows.
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
  const regular = f => f.styles.find(s => s.name === 'Regular') || f.styles[0];

  // ---- the popup of a font: built once (the field keeps its Telex input), filled for every font
  function popup(data) {
    const own = el('input.form-control.fp-try', { type: 'text', lang: 'vi', autocomplete: 'off', spellcheck: 'false', placeholder: 'chữ nôm', 'data-vi-placeholder': 'chữ nôm',
      'aria-label': 'Your own text', 'data-vi-aria-label': 'Văn bản của bạn' });
    const close = el('button.fp-x', { type: 'button', 'aria-label': 'Close', 'data-vi-aria-label': 'Đóng' }, el('i.bi.bi-x-lg'));
    const no = el('div.fp-no'), wm = el('div.fp-wm', { 'aria-hidden': 'true' }), title = el('h2.fp-name#fp-name');
    const dl = el('div'), note = el('p.fp-note'), sizes = el('div.fp-lad'), qatt = el('div.fp-lad.fp-qatt');
    // for websites: the script qatt.org/cdn/v1/webfonts.js, Google-Fonts style: the font and the weights in its query
    const WGHT = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500 }, SRC = 'https://qatt.org/cdn/v1/webfonts.js';
    const web = el('div.fp-web'), code = el('pre.fp-code'), codeCss = el('pre.fp-code');
    const copy = el('button.btn.btn-quiet.btn-pill.btn-sm', { type: 'button' }, el('i.bi.bi-clipboard'), ' ', { en: 'Copy', vi: 'Sao chép' });
    const sec = (h, ...kids) => el('section.fp-sec', {}, el('h3', {}, h), ...kids);
    const box = el('div.fp', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fp-name', tabindex: '-1' },
      el('div.fp-grip', { 'aria-hidden': 'true' }), close,
      el('header.fp-hd', {}, wm, no, title),
      sec({ en: 'Download', vi: 'Tải về' }, dl, note),
      sec({ en: 'For websites', vi: 'Cho trang web' }, web),
      sec({ en: 'Try it', vi: 'Gõ thử' }, own),
      sec({ en: 'Sizes', vi: 'Cỡ chữ' }, sizes),
      sec({ en: 'QATT', vi: 'QATT' }, qatt));
    const back = el('div.fp-back', { hidden: '' }, box);
    document.body.append(back);

    let font = null, pushed = false, before = null, ime = null;
    // the field in the font (its Latin first, for Telex): ime.js sets the font of the field itself (fontList), so it is given there once it runs
    const fontList = () => font ? [regular(font).css + ' Latin', regular(font).css] : [];
    const setFont = () => { if (ime) { ime.options.fontList = fontList(); ime.update(); } else own.style.fontFamily = fontList().map(f => `"${f}"`).join(', '); };
    const ladder = (into, text, family) => into.replaceChildren(...data.sizes.map(px =>   // with the Latin of the font: a typed text may still be Quốc Ngữ
      el('div', {}, el('small', { text: px }), el('span.fp-sc', { style: `font-family: "${family}", "${family} Latin"; font-size: ${px}px`, text }))));
    const drawSizes = () => font && ladder(sizes, own.value.trim() || data.sample.line, regular(font).css);

    const webOpts = { wght: null };
    function drawWeb() {
      const styles = font.styles.filter(s => WGHT[s.name]), name = regular(font).css;
      if (!webOpts.wght) webOpts.wght = new Set([400]);
      const w = styles.map(s => WGHT[s.name]).filter(x => webOpts.wght.has(x)).sort((a, b) => a - b);
      const q = `family=${name.toLowerCase().replace(/ /g, '+')}${styles.length > 1 ? ':weight@' + (w.length ? w : [400]).join(';') : ''}`;
      const opt = (label, on, fn) => el('label.fp-opt', {}, el('input', { type: 'checkbox', ...(on ? { checked: '' } : {}) }), ' ', label);
      const ctl = [];
      for (const s of styles.length > 1 ? styles : []) {
        const l = opt(s.name, webOpts.wght.has(WGHT[s.name])); l.firstChild.onchange = e => { e.target.checked ? webOpts.wght.add(WGHT[s.name]) : webOpts.wght.delete(WGHT[s.name]); drawWeb(); }; ctl.push(l);
      }
      web.replaceChildren(...(ctl.length ? [el('div.fp-ctl', {}, ...ctl)] : []), code, codeCss, el('div.fp-cp', {}, copy));
      code.textContent = `<script src="${SRC}?${q}"></script>`;
      codeCss.textContent = `font-family: "${name}", serif;`;
    }
    copy.onclick = () => navigator.clipboard.writeText(code.textContent + '\n' + codeCss.textContent).then(() => { const o = copy.lastChild; const t = o.textContent; copy.lastChild.textContent = ' ✓'; setTimeout(() => (copy.lastChild.textContent = t), 1200); }, () => {});

    function show(id, band) {
      font = data.fonts.find(f => f.id === id);
      if (!font) return false;
      band = band || $(`.band a[href="#${id}"]`)?.closest('.band');
      box.className = 'fp ' + ([...(band?.classList || [])].find(c => c.startsWith('b-')) || '');
      no.textContent = band ? $('.no', band)?.textContent || '' : '';
      wm.textContent = band ? $('.wm', band)?.textContent || '' : '';
      wm.style.fontFamily = `"${regular(font).css}"`;
      title.textContent = font.name;
      title.style.fontFamily = `"${regular(font).css} Latin", "${regular(font).css}"`;
      dl.replaceChildren(...font.styles.map(s => el('a.fp-row', { href: data.assets + s.file + '.ttf', download: '' },
        el('span.fp-sample.fp-sc', { style: `font-family: "${s.css}"`, lang: 'vi-Hani', text: data.sample.line }),
        el('span.fp-meta', {}, el('b', { text: s.name }), el('small', { text: `${s.mb.toLocaleString('en')} MB` })),
        el('span.fp-dl', { 'aria-hidden': 'true' }, el('i.bi.bi-download')))));
      note.replaceChildren(...(font.styles.length > 1 ? [{ en: `One family: install them all and your apps show them as the styles of “${font.family}”.`,
        vi: `Một họ phông: cài tất cả, các ứng dụng sẽ hiện chúng là các kiểu của “${font.family}”.` }].map(tr) : []));
      webOpts.wght = null; drawWeb();
      setFont();
      drawSizes();
      ladder(qatt, data.sample.qatt, regular(font).css);
      if (back.hidden) {
        before = document.activeElement;
        back.hidden = false;
        document.documentElement.classList.add('fp-open');
        box.scrollTop = 0;
        box.focus({ preventScroll: true });
      }
      return true;
    }
    function hide() {
      if (back.hidden) return;
      back.hidden = true; font = null;
      document.documentElement.classList.remove('fp-open');
      before?.focus?.({ preventScroll: true });
    }
    // closed by the button, Esc or a click beside it: back in the history if the popup put its address there, else the address without #<id>
    const shut = () => {
      if (pushed) { pushed = false; history.back(); }
      else { history.replaceState(null, '', location.pathname + location.search); hide(); }
    };
    close.addEventListener('click', shut);
    back.addEventListener('click', e => { if (e.target === back) shut(); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || back.hidden || document.querySelector('.vietime:not([hidden])')) return;   // Esc closes the candidates of the field first
      e.preventDefault(); shut();
    });
    // a link to #<id> of a font (the bands, the covers) opens its popup and puts the address in the history
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const id = a.getAttribute('href').slice(1);
      if (!data.fonts.some(f => f.id === id)) return;
      e.preventDefault();
      if (show(id, a.closest('.band')) && location.hash !== '#' + id) { history.pushState(null, '', '#' + id); pushed = true; }
    });
    const follow = () => { const id = decodeURIComponent(location.hash.slice(1)); if (!show(id)) { pushed = false; hide(); } };
    window.addEventListener('popstate', follow);
    window.addEventListener('hashchange', follow);
    follow();

    // the field: Telex and the Chữ Nôm candidates of ime.js (deferred: it may arrive before or after fonts.json); the typed text goes into the sizes
    own.addEventListener('input', drawSizes);
    const start = () => { if (window.VietIme) ime = new VietIme(own, { candidates: true, telex: true, returnSelect: true, fontList: fontList() }); };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  }

  // ---- below the bands: the characters, the licence (both folded), the other Chữ Nôm fonts
  function charset(data) {
    return el('details.card-box.fold', {}, el('summary', {}, { en: 'Characters', vi: 'Ký tự' }),
      el('p.mb-2', {}, { en: `Every font file has the same ${data.characters.toLocaleString('en')} characters: Han characters and Chữ Nôm, the QATT letters and Latin with Quốc Ngữ.`,
        vi: `Mỗi tệp phông có cùng ${data.characters.toLocaleString('vi')} ký tự: chữ Hán và chữ Nôm, chữ QATT và chữ Latin với Quốc Ngữ.` }),
      el('div.table-responsive', {}, el('table.ranges', {},
        el('thead', {}, el('tr', {}, el('th', { text: 'Group' }), el('th', { text: 'Blocks' }), el('th', { text: 'Range' }), el('th.n', { text: 'Characters' }))),
        el('tbody', {}, data.charset.map(([g, b, r, n]) => el('tr', {}, el('th', { scope: 'row', text: g }), el('td', { text: b }), el('td.r', { text: r }), el('td.n', { text: n.toLocaleString('en') })))))),
      el('p.note.mb-0', {}, { en: 'A character missing in the source data is missing in the font.', vi: 'Ký tự nào thiếu trong bộ chữ nguồn thì không có trong phông.' }));
  }

  function licence() {
    return el('details.card-box.fold#licence', {}, el('summary', {}, { en: 'Licence', vi: 'Giấy phép' }),
      el('p.mb-2', {}, el('b', {}, { en: 'QATT letters', vi: 'Chữ QATT' }), ' (U+F0000–F00A3): © 2026 qatt.org, ', { en: 'all rights reserved.', vi: 'bảo lưu mọi quyền.' }, ' ',
        { en: 'You may use them to read, write and print QATT text, for yourself and for others, embed subsets in documents such as PDF files, and use them on web pages by loading them from qatt.org or chunom.org (see “For websites”).', vi: 'Bạn được dùng để đọc, viết và in văn bản QATT, cho mình và cho người khác, nhúng tập con vào tài liệu như PDF, và dùng trên trang web bằng cách tải từ qatt.org hoặc chunom.org (xem “Cho trang web”).' }, ' ',
        { en: 'Changing them, building other fonts or works on them, and copying or passing them on need the written permission of qatt.org.', vi: 'Sửa đổi, dùng làm cơ sở cho phông khác, sao chép lại hay phân phối cần có sự cho phép bằng văn bản của qatt.org.' }, ' ',
        el('a', { href: 'https://qatt.org/fonts/LICENSE.txt', 'data-vi': 'Toàn văn giấy phép' }, 'Full licence text')),
      el('p.mb-2', {}, el('b', {}, { en: 'All other characters', vi: 'Các ký tự khác' }), ' (', { en: 'Han, Chữ Nôm, Latin …', vi: 'chữ Hán, chữ Nôm, Latin…' }, '): ',
        { en: 'the outlines are drawn by qatt.org with its own stroke designs (Pen, Migoi, Celluloid, Phong Thảo) on the stroke skeletons of', vi: 'nét chữ do qatt.org vẽ bằng các thiết kế nét riêng (Pen, Migoi, Celluloid, Phong Thảo) trên khung nét của' }, ' ', el('a', { href: 'https://glyphwiki.org/', target: '_blank', rel: 'noopener', text: 'GlyphWiki' }),
        { en: ', used under the terms of GlyphWiki.', vi: ', được dùng theo điều khoản của GlyphWiki.' }),
      el('p.note.mb-0', {}, { en: 'The fonts are not free software or open source and are provided as is, without warranty. The full text is inside every font file.', vi: 'Các phông này không phải phần mềm tự do hay mã nguồn mở, và được cung cấp nguyên trạng, không bảo hành. Toàn văn nằm trong mỗi tệp phông.' }));
  }

  function otherFonts(data) {
    return el('div.card-box.links', {},
      el('h2', {}, { en: 'More Chữ Nôm fonts', vi: 'Các phông chữ Nôm khác' }),
      el('ul', {}, data.external.map(x => el('li', {}, el('a', { href: x.url, target: '_blank', rel: 'noopener', text: x.name }), ' – ', { en: x.en, vi: x.vi }))));
  }

  fetch(new URL('fonts.json', BASE)).then(r => r.json()).then(data => {
    $('#fonts').append(charset(data), licence(), otherFonts(data));
    popup(data);
  }).catch(e => { $('#fonts').append(el('p', { text: 'The font list could not be loaded.' })); console.error(e); });
})();
