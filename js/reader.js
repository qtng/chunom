// The reader: a transcribed manuscript (reader/?work=…&item=…#p=…, the same query as catalog/view.html: a link between the two only swaps the path): every character is cut from the scan of the library
// (one page image, a CSS sprite per character), its reading below it. The Nôm text itself is never sent to the page, only the
// reading and the boxes (Supabase function text_page). A transcription belongs to a copy (item); #p is the canvas number of the copy as in
// the catalogue, so that both pages link to each other on the same page; reader/texts.json says which copies show the same scan and how the writing is freed
// from the paper ("Writing": the ink alone, as a mask in the colour of the theme; "Scan": as on the scan).
(function () {
  "use strict";
  const SB = "https://kfgqhhmdzboszpwsqkxt.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_99iUsu3_BQ6mp1TbZUEWlw_iVhDJhPi";
  const IMG_W = 1200;
  const $ = id => document.getElementById(id);
  const t = (en, vi) => (window.Lang ? Lang.t(en, vi) : en);
  const store = { get() { try { return JSON.parse(localStorage.getItem("texts1")) || {}; } catch { return {}; } },
                  set(o) { try { localStorage.setItem("texts1", JSON.stringify({ ...store.get(), ...o })); } catch {} } };

  let entry, urlItem, urlOffset, ownOffset, canvases = [], catalogItems = [], workTexts = [], p = 1;
  let ink = store.get().ink || "clean", showPage = !!store.get().page;
  const pages = new Map();   // text page -> lines
  // the owner (app_metadata.is_owner, checked by the database): the Nôm of every token (text_page_owner), editing (text_token_update)
  const QATT = "https://qatt.org/";
  let owner = false, unsureOn = !!store.get().unsure, cur = null, pop = null;
  const ownPages = new Map(); // text page -> [{line, cells: [[id, glyph, unsure, note, checked]]}]
  const maybeOwner = () => { try { return JSON.parse(localStorage.getItem("sb-kfgqhhmdzboszpwsqkxt-auth-token"))?.user?.app_metadata?.is_owner === true; } catch { return false; } };
  const loadScript = src => new Promise((ok, no) => {
    if ([...document.scripts].some(x => x.src === src)) return ok();
    const e = document.createElement("script"); e.src = src; e.onload = ok; e.onerror = () => no(new Error("could not load " + src)); document.head.append(e);
  });
  let sp = null, spReady = null;
  function connect() {
    spReady ||= (async () => {
      if (typeof supabase === "undefined") await loadScript(QATT + "vendor/supabase/supabase.min.js");
      if (typeof SupabaseService === "undefined") await loadScript(QATT + "js/supabase.js");
      sp = new SupabaseService(); await sp.initQuiet(); return sp;
    })();
    return spReady;
  }
  async function srpc(name, args) {
    await connect();
    const { data, error } = await sp.client.rpc(name, args);
    if (error) throw Object.assign(new Error(error.message || String(error)), { code: error.code });
    return data;
  }
  function ownOf(n) {
    if (!ownPages.has(n)) ownPages.set(n, srpc("text_page_owner", { p_item: entry.item, p_page: n }).catch(e => { ownPages.delete(n); throw e; }));
    return ownPages.get(n);
  }
  const isIds = g => !!g && (/[\u2FF0-\u2FFF\u{16FF1}]/u.test(g) || [...g].length > 1);
  async function drawGlyph(elm, g) {
    elm.textContent = "";
    if (!g) { elm.textContent = "?"; return; }
    if (!isIds(g)) { elm.textContent = g; return; }
    elm.title = g;
    try { if (typeof IdsRender === "undefined") await loadScript(QATT + "js/ids-render.js"); const r = await IdsRender.draw(g); elm.innerHTML = r.svg; }
    catch { elm.textContent = g; }
  }
  const cleaned = new Map(); // canvas -> blob URL of the writing alone

  function first(x) { return Array.isArray(x) ? x[0] : x; }
  function readCanvases(m) {
    const out = [];
    if (m.sequences) for (const c of (m.sequences[0] || {}).canvases || []) {
      const res = (first(c.images) || {}).resource || {}; const svc = first(res.service) || {};
      out.push({ service: svc["@id"] || svc.id, image: res["@id"], w: res.width || c.width, h: res.height || c.height });
    } else for (const c of m.items || []) {
      const body = first((((c.items || [])[0] || {}).items || [])[0]?.body) || {}; const svc = first(body.service) || {};
      out.push({ service: svc.id || svc["@id"], image: body.id, w: body.width || c.width, h: body.height || c.height });
    }
    return out;
  }
  const imageUrl = c => c.service ? `${c.service.replace(/\/$/, "")}/full/${IMG_W},/0/default.jpg` : c.image;

  async function rpc(name, args) {
    const r = await fetch(SB + name, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  async function linesOf(n) {
    if (!pages.has(n)) pages.set(n, rpc("text_page", { p_item: entry.item, p_page: n }).catch(e => { pages.delete(n); throw e; }));
    return pages.get(n);
  }

  // the writing alone: transparent paper, the ink as alpha (a mask, drawn in the colour of the theme); Durand's red readings dropped
  function loadImage(src) {
    return new Promise((ok, no) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = no; im.src = src; });
  }
  async function cleanUrl(cv) {
    const key = imageUrl(cv);
    if (!cleaned.has(key)) cleaned.set(key, (async () => {
      const im = await loadImage(key);
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
      const o = entry.ink || {}, paper = o.paper ?? 190, inkv = o.ink ?? 110, dropRed = o.red === "drop", span = Math.max(1, paper - inkv);
      for (let i = 0; i < a.length; i += 4) {
        const r = a[i], gr = a[i + 1], b = a[i + 2];
        let al;
        if (dropRed && r - gr > 22 && r - b > 12) al = 0;
        else { const y = 0.299 * r + 0.587 * gr + 0.114 * b; al = Math.max(0, Math.min(1, (paper - y) / span)); }
        a[i] = a[i + 1] = a[i + 2] = 0; a[i + 3] = Math.round(al * 255);
      }
      g.putImageData(d, 0, 0);
      const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
      return URL.createObjectURL(blob);
    })().catch(e => { cleaned.delete(key); throw e; }));
    return cleaned.get(key);
  }

  const textPage = () => p - ownOffset;   // p: canvas of the own copy
  const urlPage = () => p - ownOffset + urlOffset;

  function state() {
    const q = new URLSearchParams(location.search);
    q.set("work", entry.work); q.set("item", urlItem);
    history.replaceState(null, "", `?${q}#p=${urlPage()}`);
    // the same page in the catalogue: the copy asked for, else the first matching copy the catalogue has
    const cat = catalogItems.includes(urlItem) ? urlItem : (Object.keys(entry.copies).find(i => catalogItems.includes(i)) || "");
    const cp = p - ownOffset + (entry.copies[cat] ?? ownOffset);
    $("to-catalog").href = `/chunom/catalog/view.html?work=${encodeURIComponent(entry.work)}${cat ? `&item=${encodeURIComponent(cat)}` : ""}#p=${cp}`;
  }

  function sizes(lines) {
    const hs = [], ws = [];
    for (const l of lines) for (const [, b] of l.cells) if (b) { hs.push(b[3] - b[1]); ws.push(b[2] - b[0]); }
    hs.sort((a, b) => a - b);
    const med = hs[hs.length >> 1] || 500;
    const wide = Math.max(...lines.map(l => l.cells.length), 1);
    const avail = $("text").clientWidth || 320;
    const h = Math.max(22, Math.min(58, Math.floor(avail / wide / 1.12)));
    return { h, med, avail };
  }

  // a reading with the punctuation of the edition (punct_before / punct_after of the token; not on the scan)
  // the text gives the modern spelling where the token has one (qn_modern, e.g. giời → trời); the reading as written is then a footnote
  // (fn: its number on the page, the notes are listed under the text)
  function writeQn(r, cell, fn) {
    const [qn0, , , pb, pa, qm] = cell;
    const qn = qm || qn0;
    r.textContent = "";
    if (window.Readings && qn) Readings.fill(r, qn); else r.textContent = qn || "·";
    if (qm && fn) r.append(Object.assign(document.createElement("sup"), { className: "tx-fn", textContent: fn }));
    if (pb) r.prepend(Object.assign(document.createElement("span"), { className: "tx-punct", textContent: pb }));
    if (pa) r.append(Object.assign(document.createElement("span"), { className: "tx-punct", textContent: pa }));
  }
  function note(text) { const m = $("note"); m.textContent = text; m.hidden = !text; }
  function message(text) { const m = $("message"); m.textContent = text; m.hidden = !text; }

  // the waiting picture while a page is prepared: verses of ink blots that are written one after the other (6 and 8 as a lục bát),
  // the step below it; only after 150 ms, so that a page from the cache does not flicker
  let loadStep = null, loadTimer = 0;
  function loaderEl(step) {
    const wrap = document.createElement("div"); wrap.className = "tx-loading"; wrap.setAttribute("role", "status");
    let i = 0;
    for (const n of [6, 8, 6, 8]) {
      const row = document.createElement("div"); row.className = "tx-loading-verse";
      for (let k = 0; k < n; k++) {
        const c = document.createElement("span"); c.className = "tx-loading-cell"; c.style.setProperty("--i", i++);
        c.append(document.createElement("i"), document.createElement("b"));
        row.append(c);
      }
      wrap.append(row);
    }
    const cap = document.createElement("p"); cap.className = "tx-loading-cap";
    const st = document.createElement("span"); st.className = "tx-loading-step"; st.textContent = step;
    const hint = document.createElement("span"); hint.className = "tx-loading-hint";
    hint.textContent = t("The scans come from the library: the first page can take a few seconds.", "Bản quét được tải từ thư viện: trang đầu có thể mất vài giây.");
    cap.append(Object.assign(document.createElement("i"), { className: "bi bi-brush" }), " ", st, hint);
    wrap.append(cap);
    return wrap;
  }
  function loading(step) {
    loadStep = step; const box = $("text");
    if (step == null) { clearTimeout(loadTimer); loadTimer = 0; box.removeAttribute("aria-busy"); box.querySelector(".tx-loading")?.remove(); return; }
    const l = box.querySelector(".tx-loading");
    if (l) { l.querySelector(".tx-loading-step").textContent = step; return; }
    if (!loadTimer) loadTimer = setTimeout(() => { loadTimer = 0; if (loadStep != null) { box.replaceChildren(loaderEl(loadStep)); box.setAttribute("aria-busy", "true"); } }, 150);
  }

  async function render() {
    const cv = canvases[p - 1];
    $("reader").querySelector("input").value = urlPage();
    $("reader").querySelector('[data-act="prev"]').disabled = p <= 1;
    $("reader").querySelector('[data-act="next"]').disabled = p >= canvases.length;
    state();
    const n = textPage(), box = $("text"), mine = p;
    $("page-img").src = cv ? imageUrl(cv) : "";
    $("boxes").replaceChildren();
    if (!cv) { loading(null); return; }
    if (n < 1 || n > entry.pages) {
      loading(null); box.replaceChildren(); $("page").hidden = false; message(t("This page has no transcription.", "Trang này chưa có bản phiên âm."));
      return;
    }
    $("page").hidden = !showPage;
    message("");
    loading(t("Loading the text …", "Đang tải văn bản …"));
    let lines;
    try { lines = await linesOf(n); } catch { loading(null); message(t("The text could not be loaded.", "Không tải được văn bản.")); return; }
    if (mine !== p) return;
    let own = null;
    if (owner || maybeOwner()) {
      try { own = await ownOf(n); if (!owner) { owner = true; ownerUi(); } } catch (e) { if (e.code === "42501") { owner = false; ownerUi(); } }
      if (mine !== p) return;
    }
    closePop();
    cur = { n, lines, own, cv };
    let mask = null;
    loading(t("Loading the scan …", "Đang tải bản quét …"));
    if (ink === "clean") { try { mask = await cleanUrl(cv); } catch { mask = null; } if (mine !== p) return; }
    if (!mask) { try { await loadImage(imageUrl(cv)); } catch { /* the cells stay empty, the readings are there */ } if (mine !== p) return; }
    const ratio = cv.h / cv.w, sz = sizes(lines), med = sz.med;
    // the widths in units of h: the usual cell (cf) and each wider character; h shrinks until the longest verse fits the column
    const bwOf = b => (b[2] - b[0]) / (med * ratio);
    let cf = 0;
    for (const l of lines) for (const [, b] of l.cells) if (b) cf = Math.max(cf, bwOf(b));
    cf = Math.min(Math.max(cf, 0.9), 1.08);
    let h = sz.h;
    for (const l of lines) {
      const k = l.cells.reduce((s, [, b]) => s + Math.max(cf, b ? bwOf(b) * 1.04 : 0), 0), gaps = 2 * (l.cells.length - 1) + l.cells.length;
      if (k * h + gaps > sz.avail) h = Math.max(18, Math.floor((sz.avail - gaps) / k));
    }
    const H = h / (med / 10000), W = H / ratio;   // the page image in px so that a character of median height is h px high
    const px = (v, s) => v / 10000 * s;
    const cw = Math.ceil(cf * h);   // the usual width; a wider character gets a wider cell (below)
    let bh = 0;
    for (const l of lines) for (const [, b] of l.cells) if (b) bh = Math.max(bh, px(b[3] - b[1], H));
    const ch = Math.ceil(Math.max(h * 1.12, bh * 1.04));   // the whole box of the tallest character fits
    box.style.setProperty("--cw", cw + "px"); box.style.setProperty("--ch", ch + "px");
    const src = mask || imageUrl(cv);
    const frag = [], notes = [];
    lines.forEach((l, li) => {
      const row = document.createElement("div"); row.className = "tx-verse";
      l.cells.forEach((cellData, ci) => {
        const b = cellData[1];
        const cell = document.createElement("button"); cell.type = "button"; cell.className = "tx-cell"; cell.dataset.k = `${li}.${ci}`;
        const oc = own && own[li] && own[li].cells[ci];
        if (oc && oc[2]) cell.classList.add("unsure");
        const sp = document.createElement("span"); sp.className = "tx-sp" + (mask ? " ink" : "");
        if (b) {
          const cx = px((b[0] + b[2]) / 2, W), cy = px((b[1] + b[3]) / 2, H);
          const w = Math.max(cw, Math.ceil(px(b[2] - b[0], W) * 1.04));   // never narrower than the box (the red frame of the popover)
          if (w > cw) { cell.style.width = w + "px"; sp.style.width = w + "px"; }
          const size = `${W}px ${H}px`, pos = `${-(cx - w / 2)}px ${-(cy - ch / 2)}px`;
          if (mask) Object.assign(sp.style, { webkitMaskImage: `url("${src}")`, maskImage: `url("${src}")`, webkitMaskSize: size, maskSize: size, webkitMaskPosition: pos, maskPosition: pos });
          else Object.assign(sp.style, { backgroundImage: `url("${src}")`, backgroundSize: size, backgroundPosition: pos });
          const ov = document.createElement("span"); ov.className = "tx-box"; ov.dataset.k = cell.dataset.k;
          Object.assign(ov.style, { left: b[0] / 100 + "%", top: b[1] / 100 + "%", width: (b[2] - b[0]) / 100 + "%", height: (b[3] - b[1]) / 100 + "%" });
          $("boxes").append(ov);
        }
        const r = document.createElement("span"); r.className = "tx-qn";
        if (cellData[5]) notes.push({ k: `${li}.${ci}`, qn: cellData[0], qm: cellData[5] });
        writeQn(r, cellData, cellData[5] ? notes.length : 0);
        cell.append(sp, r); row.append(cell);
      });
      frag.push(row);
    });
    if (notes.length) frag.push(el("ol", { class: "tx-notes small", "aria-label": t("Readings as written", "Âm đọc nguyên văn") },
      ...notes.map(x => el("li", { "data-k": x.k }, el("span", { lang: "vi" }, x.qn), " ", el("span", { class: "text-body-secondary" }, t(`(as written; today ${x.qm})`, `(nguyên văn; ngày nay ${x.qm})`))))));
    loading(null);
    box.replaceChildren(...frag);
    updateCount();
    // the next page in advance
    if (n < entry.pages) { linesOf(n + 1).catch(() => {}); if (ink === "clean" && canvases[p]) cleanUrl(canvases[p]).catch(() => {}); }
  }

  // ---------- the popover of a token: the place with its context (everybody); for the owner the Nôm, the notes and the editor ----------
  function closePop() { if (pop) { pop.remove(); pop = null; document.querySelectorAll(".tx-cell.pinned, .tx-box.pinned").forEach(x => x.classList.remove("pinned")); } }
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids) if (c != null && c !== "") e.append(c);
    return e;
  }
  function context(b, qb) {   // the character, its neighbours and the reading written under it, as on the scan
    const w = b[2] - b[0], h = b[3] - b[1], ratio = cur.cv.h / cur.cv.w;
    const x0 = Math.max(0, b[0] - 1.15 * w), x1 = Math.min(10000, b[2] + 1.15 * w);
    const y0 = Math.max(0, b[1] - 0.3 * h), y1 = Math.min(10000, Math.max(b[3], qb ? qb[3] : b[3]) + 0.25 * h);
    let W = 150 * 10000 / ((y1 - y0) * ratio);
    const wide = (x1 - x0) / 10000 * W; if (wide > 300) W *= 300 / wide;
    const H = W * ratio, cw = (x1 - x0) / 10000 * W, chh = (y1 - y0) / 10000 * H;
    const box = el("div", { class: "tx-ctx", title: t("Drag to move; double-click to reset", "Kéo để di chuyển; nhấp đúp để đặt lại") });
    Object.assign(box.style, { width: cw + "px", height: chh + "px", backgroundImage: `url("${imageUrl(cur.cv)}")`, backgroundSize: `${W}px ${H}px` });
    const m = el("span", { class: "tx-ctx-mark" });
    Object.assign(m.style, { width: w / 10000 * W + 4 + "px", height: h / 10000 * H + 4 + "px" });
    box.append(m);
    // the window can be dragged over the page (mouse or finger), within the page; a double click goes back
    const ox0 = -x0 / 10000 * W, oy0 = -y0 / 10000 * H, bx = b[0] / 10000 * W, by = b[1] / 10000 * H;
    let ox = ox0, oy = oy0;
    const set = (x, y) => {
      ox = Math.min(0, Math.max(cw - W, x)); oy = Math.min(0, Math.max(chh - H, y));
      box.style.backgroundPosition = `${ox}px ${oy}px`;
      m.style.left = ox + bx - 2 + "px"; m.style.top = oy + by - 2 + "px";
    };
    set(ox0, oy0);
    let drag = null;
    box.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; box.setPointerCapture(e.pointerId); box.classList.add("dragging"); e.preventDefault(); });
    box.addEventListener("pointermove", e => { if (drag) set(drag.ox + e.clientX - drag.x, drag.oy + e.clientY - drag.y); });
    const end = () => { drag = null; box.classList.remove("dragging"); };
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    box.addEventListener("dblclick", () => set(ox0, oy0));
    return box;
  }
  function place(cell) {
    const r = cell.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let top = r.bottom + 6;
    if (top + ph > innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
    const left = Math.max(8, Math.min(document.documentElement.clientWidth - pw - 8, r.left + r.width / 2 - pw / 2));
    Object.assign(pop.style, { top: top + scrollY + "px", left: left + scrollX + "px" });
  }
  function openPop(cell, edit = false) {
    closePop();
    const [li, ci] = cell.dataset.k.split(".").map(Number);
    const [qn, b, qb, pb, pa] = cur.lines[li].cells[ci];
    const oc = cur.own && cur.own[li] && cur.own[li].cells[ci];
    document.querySelectorAll(`[data-k="${cell.dataset.k}"]`).forEach(x => x.classList.add("pinned"));
    pop = el("div", { class: "tx-pop card-box", role: "dialog", "aria-label": t("Character", "Chữ") });
    pop.dataset.k = cell.dataset.k;
    const head = el("div", { class: "tx-pop-head" }, b ? context(b, qb) : null);
    const qEl = el("div", { class: "tx-pop-qn", lang: "vi" }); writeQn(qEl, cur.lines[li].cells[ci]);
    const info = el("div", { class: "tx-pop-info" }, qEl);
    const qm0 = cur.lines[li].cells[ci][5];
    if (qm0) info.append(el("div", { class: "tx-pop-modern small" }, t(`As written: ${qn}`, `Nguyên văn: ${qn}`)));
    head.append(info);
    pop.append(head);
    if (owner && oc) {
      const g = el("div", { class: "tx-pop-glyph", lang: "vi-Hani" }); drawGlyph(g, oc[1]);
      info.prepend(g);
      if (oc[2]) info.append(el("div", { class: "badge-unsure" }, t("Unsure", "Chưa chắc")));
      if (oc[3]) info.append(el("div", { class: "tx-pop-note small" }, oc[3]));
      if (oc[4]) info.append(el("div", { class: "tx-pop-checked small" }, t(`Checked: ${oc[4]}`, `Đã kiểm: ${oc[4]}`)));
      if (!edit) pop.append(el("div", { class: "tx-pop-actions" },
        el("button", { type: "button", class: "btn btn-sm btn-quiet", onclick: () => openPop(cell, true), title: t("Edit (E)", "Sửa (E)") }, el("i", { class: "bi bi-pencil" }), " ", t("Edit", "Sửa"))));
      else pop.append(editor(cell, li, ci, qn, oc, pb, pa));
    }
    document.body.append(pop);
    place(cell);
    if (edit) pop.querySelector("input")?.focus();
  }
  function editor(cell, li, ci, qn, oc, pb0, pa0) {
    const gIn = el("input", { class: "form-control form-control-sm tx-in-glyph", lang: "vi-Hani", autocomplete: "off", spellcheck: "false", placeholder: t("Character or IDS", "Chữ hoặc IDS") });
    gIn.value = oc[1] || "";
    const prev = el("span", { class: "tx-prev", lang: "vi-Hani" });
    const qIn = el("input", { class: "form-control form-control-sm", lang: "vi", autocomplete: "off", spellcheck: "false", placeholder: t("Reading", "Âm đọc") });
    qIn.value = qn || "";
    const mIn = el("input", { class: "form-control form-control-sm", lang: "vi", autocomplete: "off", spellcheck: "false", placeholder: t("Same as the reading", "Giống âm đọc") });
    mIn.value = cur.lines[li].cells[ci][5] || "";
    const uIn = el("input", { type: "checkbox", class: "form-check-input", id: "tx-unsure-in" }); uIn.checked = !!oc[2];
    const nIn = el("input", { class: "form-control form-control-sm", autocomplete: "off", placeholder: t("Note", "Ghi chú") }); nIn.value = oc[3] || "";
    // the punctuation of the edition before and after the reading: two lists (a value not in them is kept as an extra option)
    const PB = ["", "“", "(", "‘", "[", "«"], PA = ["", ",", ".", "?", "!", ":", ";", "…", "”", ")", "’", "]", "»", ",”", ".”", "?”", "!”", ".)", ",)"];
    const sel = (list, v, label) => {
      const e = el("select", { class: "form-select form-select-sm tx-in-punct", "aria-label": label });
      for (const c of (v && !list.includes(v) ? [...list, v] : list)) e.append(el("option", { value: c }, c || "–"));
      e.value = v || ""; return e;
    };
    const pbIn = sel(PB, pb0, t("Before", "Trước")), paIn = sel(PA, pa0, t("After", "Sau"));
    const forms = el("div", { class: "tx-forms" });
    const err = el("div", { class: "tx-err small", hidden: true });
    let pt; const preview = () => { clearTimeout(pt); pt = setTimeout(() => (isIds(gIn.value.trim()) ? drawGlyph(prev, gIn.value.trim()) : (prev.textContent = "")), 200); };
    gIn.addEventListener("input", preview); preview();
    // the forms this reading has elsewhere in the work: one click takes one
    let ft; const loadForms = () => { clearTimeout(ft); ft = setTimeout(async () => {
      forms.replaceChildren(); const q = qIn.value.trim(); if (!q) return;
      try {
        const rows = await srpc("text_forms", { p_item: entry.item, p_qn: q });
        for (const r of rows) { const bt = el("button", { type: "button", class: "btn btn-sm btn-quiet tx-form", lang: "vi-Hani", title: `${r.glyph} ×${r.n}` }); const gg = el("span"); drawGlyph(gg, r.glyph); bt.append(gg, el("small", {}, ` ${r.n}`)); bt.addEventListener("click", () => { gIn.value = r.glyph; preview(); gIn.focus(); }); forms.append(bt); }
      } catch {}
    }, 250); };
    qIn.addEventListener("input", loadForms); loadForms();
    loadScript("/chunom/js/ime.js").then(() => { if (typeof VietIme !== "undefined") new VietIme(gIn, { defer: true }); }).catch(() => {});
    const save = async () => {
      err.hidden = true;
      try {
        const r = await srpc("text_token_update", { p_id: oc[0], p_glyph: gIn.value, p_qn: qIn.value, p_unsure: uIn.checked, p_note: nIn.value, p_punct_before: pbIn.value, p_punct_after: paIn.value, p_qn_modern: mIn.value });
        const [id, g, uns, nt, chk, q, pb, pa, qm] = r;
        cur.own[li].cells[ci] = [id, g, uns, nt, chk];
        const lc = cur.lines[li].cells[ci]; lc[0] = q; lc[3] = pb; lc[4] = pa; lc[5] = qm;
        const k = cell.dataset.k;
        await render();   // the footnotes are numbered on the page
        const c = document.querySelector(`.tx-cell[data-k="${k}"]`); if (c) openPop(c);
      } catch (e) { err.textContent = t("Not saved: ", "Chưa lưu: ") + e.message; err.hidden = false; }
    };
    const form = el("form", { class: "tx-edit" },
      el("label", { class: "small" }, t("Character", "Chữ")), el("div", { class: "tx-row" }, gIn, prev),
      forms,
      el("label", { class: "small" }, t("Reading (as written)", "Âm đọc (nguyên văn)")), qIn,
      el("label", { class: "small" }, t("Modern spelling (if different)", "Chính tả ngày nay (nếu khác)")), mIn,
      el("label", { class: "small" }, t("Punctuation (before / after)", "Dấu câu (trước / sau)")), el("div", { class: "tx-row" }, pbIn, el("span", { class: "small text-body-secondary" }, t("reading", "âm đọc")), paIn),
      el("div", { class: "form-check mt-1" }, uIn, el("label", { class: "form-check-label small", for: "tx-unsure-in" }, t("Unsure", "Chưa chắc"))),
      nIn, err,
      el("div", { class: "tx-pop-actions" },
        el("button", { type: "submit", class: "btn btn-sm btn-accent" }, t("Save", "Lưu")),
        el("button", { type: "button", class: "btn btn-sm btn-quiet", onclick: () => openPop(cell) }, t("Cancel", "Hủy"))));
    form.addEventListener("submit", e => { e.preventDefault(); save(); });
    form.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
      else if (e.key === "Enter" && e.target !== gIn && e.target.type !== "checkbox") { e.preventDefault(); save(); }
      else if (e.key === "Enter" && e.target === gIn) { /* left to ime.js (choose a candidate) */ }
    });
    return form;
  }
  function step(d) {   // the popover on the previous / next token, across pages
    if (!pop) return;
    const cells = [...document.querySelectorAll("#text .tx-cell")], i = cells.findIndex(c => c.dataset.k === pop.dataset.k);
    const nx = cells[i + d];
    if (nx) { openPop(nx); nx.scrollIntoView({ block: "nearest" }); }
  }
  // the owner: the unsure tokens framed, their number, and a jump to the next one (on later pages too)
  function updateCount() {
    const b = $("reader").querySelector('[data-act="unsure"]'); if (!b) return;
    b.querySelector(".n").textContent = document.querySelectorAll("#text .tx-cell.unsure").length;
  }
  async function nextUnsure() {
    const cells = [...document.querySelectorAll("#text .tx-cell")];
    const from = pop ? cells.findIndex(c => c.dataset.k === pop.dataset.k) : -1;
    const here = cells.slice(from + 1).find(c => c.classList.contains("unsure"));
    if (here) { openPop(here); here.scrollIntoView({ block: "center" }); return; }
    for (let n = cur.n + 1; n <= entry.pages; n++) {
      let own; try { own = await ownOf(n); } catch { return; }
      if (own.some(l => l.cells.some(c => c[2]))) { await go(n + ownOffset); const c = document.querySelector("#text .tx-cell.unsure"); if (c) { openPop(c); c.scrollIntoView({ block: "center" }); } return; }
    }
  }
  function ownerUi() {
    const r = $("reader");
    r.querySelectorAll(".owner-only").forEach(x => { x.hidden = !owner; });
    $("text").classList.toggle("show-unsure", owner && unsureOn);
    const b = r.querySelector('[data-act="unsure"]'); if (b) { b.classList.toggle("active", unsureOn); b.setAttribute("aria-pressed", unsureOn); }
  }

  function mark(k, on) {
    document.querySelectorAll(`[data-k="${k}"]`).forEach(e => e.classList.toggle("on", on));
  }

  function go(np) { np = Math.max(1, Math.min(canvases.length, np)); if (np !== p) { p = np; return render(); } }

  async function init() {
    const q = new URLSearchParams(location.search);
    let index, catalog;   // reader/texts.json, catalog/catalog.json
    try { [index, catalog] = await Promise.all([fetch("/chunom/reader/texts.json").then(r => r.json()), fetch("/chunom/catalog/catalog.json").then(r => r.json()).catch(() => null)]); }
    catch { $("work-title").textContent = t("The list of texts could not be loaded.", "Không tải được danh sách văn bản."); return; }
    // the transcription: of the copy asked for (or a copy with the same scan), else of the work (the first, a choice when there are several)
    const asked = q.get("item");
    entry = index.texts.find(x => asked && x.copies[asked] != null);
    const wk = entry ? entry.work : q.get("work");
    workTexts = index.texts.filter(x => x.work === wk);
    if (!entry) entry = workTexts[0];
    const work = catalog && catalog.works.find(w => w.id === wk);
    catalogItems = work ? work.items.filter(i => !i.withheld).map(i => i.id) : [];   // withheld copies (admins only in the catalogue) are not linked
    if (!entry) {
      const h = $("work-title"); h.removeAttribute("data-vi");
      h.textContent = t("This copy has no transcription yet.", "Bản này chưa có bản phiên âm."); $("reader").hidden = true;
      if (wk) $("to-catalog").href = `/chunom/catalog/view.html?work=${encodeURIComponent(wk)}${asked ? `&item=${encodeURIComponent(asked)}` : ""}${location.hash}`;
      return;
    }
    if (!entry.released) note(t("Not released yet: this transcription is still being checked and is not shown in the catalogue.", "Chưa công bố: bản phiên âm này đang được kiểm tra và chưa hiện trong thư mục."));
    if (asked && entry.copies[asked] == null) note(t("The copy asked for has no transcription; this is the transcription of another copy.", "Bản được chọn chưa có bản phiên âm; đây là bản phiên âm của một bản khác."));
    if (workTexts.length > 1) {   // several copies of the work have a transcription: choose one (as the copies in the catalogue)
      const sel = $("copy-select");
      const label = x => { const it = work && work.items.find(i => x.copies[i.id] != null && !i.withheld);
        return it ? `${String(it.holding.institution).split(",")[0]}${it.holding.shelfmark && it.holding.shelfmark !== "not stated" ? " – " + it.holding.shelfmark : ""}` : x.item; };
      sel.replaceChildren(...workTexts.map(x => { const o = document.createElement("option"); o.value = x.item; o.textContent = label(x); return o; }));
      sel.value = entry.item; $("copies").hidden = false;
      sel.addEventListener("change", () => { location.search = `?work=${encodeURIComponent(wk)}&item=${encodeURIComponent(sel.value)}`; });
    }
    const main = work ? (work.titles || []).filter(x => (x.type || "main") === "main") : [];
    const qn = (main.find(x => x.script === "quoc-ngu") || {}).text || entry.work, han = (main.find(x => x.script === "han-nom") || {}).text;
    const h1 = $("work-title"); h1.removeAttribute("data-vi");
    if (han) { h1.textContent = han; h1.setAttribute("lang", "vi-Hani"); $("work-qn").textContent = qn; } else h1.textContent = qn;
    $("work-writer").textContent = entry.writer ? t(`Copied by ${entry.writer}`, `${entry.writer} chép`) : "";
    document.title = `${qn} – ${t("Read", "Đọc")}`;
    // the copy in the address: the one asked for, else the first with the same scan that the catalogue shows, else the own one
    urlItem = entry.copies[asked] != null ? asked : (Object.keys(entry.copies).find(i => catalogItems.includes(i)) || entry.item);
    urlOffset = entry.copies[urlItem]; ownOffset = entry.copies[entry.item];
    loading(t("Opening the manuscript …", "Đang mở bản chép tay …"));
    try { canvases = readCanvases(await fetch(entry.manifest).then(r => r.json())); }
    catch { loading(null); message(t("The scan could not be loaded.", "Không tải được bản quét.")); return; }
    $("total").textContent = canvases.length;
    const hp = parseInt((location.hash.match(/p=(\d+)/) || [])[1] || "", 10);
    p = Math.max(1, Math.min(canvases.length, Number.isFinite(hp) ? hp - urlOffset + ownOffset : ownOffset + 1));

    const reader = $("reader");
    reader.querySelector('[data-act="prev"]').addEventListener("click", () => go(p - 1));
    reader.querySelector('[data-act="next"]').addEventListener("click", () => go(p + 1));
    reader.querySelector("input").addEventListener("change", e => go(parseInt(e.target.value, 10) - urlOffset + ownOffset || p));
    const inkBtns = reader.querySelectorAll("[data-ink]");
    const setInk = () => inkBtns.forEach(b => b.classList.toggle("active", b.dataset.ink === ink));
    inkBtns.forEach(b => b.addEventListener("click", () => { ink = b.dataset.ink; store.set({ ink }); setInk(); render(); }));
    setInk();
    const pb = reader.querySelector('[data-act="page"]');
    const setPage = () => { pb.setAttribute("aria-pressed", showPage); pb.classList.toggle("active", showPage); reader.classList.toggle("with-page", showPage); };
    pb.addEventListener("click", () => { showPage = !showPage; store.set({ page: showPage }); setPage(); render(); });
    setPage();
    const text = $("text");
    text.addEventListener("mouseover", e => { const c = e.target.closest(".tx-cell"); if (c) mark(c.dataset.k, true); });
    text.addEventListener("mouseout", e => { const c = e.target.closest(".tx-cell"); if (c) mark(c.dataset.k, false); });
    text.addEventListener("click", e => {
      const c = e.target.closest(".tx-cell"); if (!c || !cur) return;
      if (pop && pop.dataset.k === c.dataset.k) closePop(); else openPop(c);
    });
    document.addEventListener("click", e => { if (pop && !pop.contains(e.target) && !e.target.closest(".tx-cell") && document.contains(e.target)) closePop(); });
    reader.querySelector('[data-act="unsure"]').addEventListener("click", () => { unsureOn = !unsureOn; store.set({ unsure: unsureOn }); ownerUi(); });
    reader.querySelector('[data-act="next-unsure"]').addEventListener("click", e => { e.stopPropagation(); nextUnsure(); });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && pop) { const k = pop.dataset.k; closePop(); document.querySelector(`.tx-cell[data-k="${k}"]`)?.focus(); return; }
      if (e.target.closest("input, textarea, select")) return;
      if (pop) {
        if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
        else if ((e.key === "e" || e.key === "E") && owner) { e.preventDefault(); const c = document.querySelector(`.tx-cell[data-k="${pop.dataset.k}"]`); if (c) openPop(c, true); }
        return;
      }
      if (e.key === "ArrowLeft") go(p - 1); else if (e.key === "ArrowRight") go(p + 1);
    });
    addEventListener("resize", () => { if (pop) closePop(); });
    window.addEventListener("hashchange", () => { const m = location.hash.match(/p=(\d+)/); if (m) go(parseInt(m[1], 10) - urlOffset + ownOffset); });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
    ownerUi();
    document.addEventListener("readingschange", render);
    document.addEventListener("langchange", render);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
