// The reader: a transcribed manuscript (reader/?work=…&item=…#p=…, the same query as catalog/scan.html: a link between the two only swaps the path): every character is cut from the scan of the library
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
    $("to-catalog").href = `/chunom/catalog/scan.html?work=${encodeURIComponent(entry.work)}${cat ? `&item=${encodeURIComponent(cat)}` : ""}#p=${cp}`;
  }

  function sizes(lines) {
    const hs = [], ws = [];
    for (const l of lines) for (const [, b] of l.cells) if (b) { hs.push(b[3] - b[1]); ws.push(b[2] - b[0]); }
    hs.sort((a, b) => a - b);
    const med = hs[hs.length >> 1] || 500;
    const wide = Math.max(...lines.map(l => l.cells.length), 1);
    const avail = $("text").clientWidth || 320;
    const h = Math.max(22, Math.min(58, Math.floor(avail / wide / 1.12)));
    return { h, med };
  }

  function note(text) { const m = $("note"); m.textContent = text; m.hidden = !text; }
  function message(text) { const m = $("message"); m.textContent = text; m.hidden = !text; }

  async function render() {
    const cv = canvases[p - 1];
    $("reader").querySelector("input").value = urlPage();
    $("reader").querySelector('[data-act="prev"]').disabled = p <= 1;
    $("reader").querySelector('[data-act="next"]').disabled = p >= canvases.length;
    state();
    const n = textPage(), box = $("text"), mine = p;
    $("page-img").src = cv ? imageUrl(cv) : "";
    $("boxes").replaceChildren();
    if (!cv) return;
    if (n < 1 || n > entry.pages) {
      box.replaceChildren(); $("page").hidden = false; message(t("This page has no transcription.", "Trang này chưa có bản phiên âm."));
      return;
    }
    $("page").hidden = !showPage;
    message("");
    let lines;
    try { lines = await linesOf(n); } catch { message(t("The text could not be loaded.", "Không tải được văn bản.")); return; }
    if (mine !== p) return;
    let mask = null;
    if (ink === "clean") { try { mask = await cleanUrl(cv); } catch { mask = null; } if (mine !== p) return; }
    const ratio = cv.h / cv.w, { h, med } = sizes(lines);
    const H = h / (med / 10000), W = H / ratio;   // the page image in px so that a character of median height is h px high
    const px = (v, s) => v / 10000 * s;
    let cw = 0;
    for (const l of lines) for (const [, b] of l.cells) if (b) cw = Math.max(cw, px(b[2] - b[0], W));
    cw = Math.ceil(Math.min(Math.max(cw, h * 0.9), h * 1.08));
    const ch = Math.ceil(h * 1.12);
    box.style.setProperty("--cw", cw + "px"); box.style.setProperty("--ch", ch + "px");
    const src = mask || imageUrl(cv);
    const frag = [];
    lines.forEach((l, li) => {
      const row = document.createElement("div"); row.className = "tx-verse";
      l.cells.forEach(([qn, b], ci) => {
        const cell = document.createElement("button"); cell.type = "button"; cell.className = "tx-cell"; cell.dataset.k = `${li}.${ci}`;
        const sp = document.createElement("span"); sp.className = "tx-sp" + (mask ? " ink" : "");
        if (b) {
          const cx = px((b[0] + b[2]) / 2, W), cy = px((b[1] + b[3]) / 2, H);
          const size = `${W}px ${H}px`, pos = `${-(cx - cw / 2)}px ${-(cy - ch / 2)}px`;
          if (mask) Object.assign(sp.style, { webkitMaskImage: `url("${src}")`, maskImage: `url("${src}")`, webkitMaskSize: size, maskSize: size, webkitMaskPosition: pos, maskPosition: pos });
          else Object.assign(sp.style, { backgroundImage: `url("${src}")`, backgroundSize: size, backgroundPosition: pos });
          const ov = document.createElement("span"); ov.className = "tx-box"; ov.dataset.k = cell.dataset.k;
          Object.assign(ov.style, { left: b[0] / 100 + "%", top: b[1] / 100 + "%", width: (b[2] - b[0]) / 100 + "%", height: (b[3] - b[1]) / 100 + "%" });
          $("boxes").append(ov);
        }
        const r = document.createElement("span"); r.className = "tx-qn";
        if (window.Readings && qn) Readings.fill(r, qn); else r.textContent = qn || "·";
        cell.append(sp, r); row.append(cell);
      });
      frag.push(row);
    });
    box.replaceChildren(...frag);
    // the next page in advance
    if (n < entry.pages) { linesOf(n + 1).catch(() => {}); if (ink === "clean" && canvases[p]) cleanUrl(canvases[p]).catch(() => {}); }
  }

  function mark(k, on) {
    document.querySelectorAll(`[data-k="${k}"]`).forEach(e => e.classList.toggle("on", on));
  }

  function go(np) { np = Math.max(1, Math.min(canvases.length, np)); if (np !== p) { p = np; render(); } }

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
      if (wk) $("to-catalog").href = `/chunom/catalog/scan.html?work=${encodeURIComponent(wk)}${asked ? `&item=${encodeURIComponent(asked)}` : ""}${location.hash}`;
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
    try { canvases = readCanvases(await fetch(entry.manifest).then(r => r.json())); }
    catch { message(t("The scan could not be loaded.", "Không tải được bản quét.")); return; }
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
      const c = e.target.closest(".tx-cell"); if (!c) return;
      const was = c.classList.contains("pinned");
      document.querySelectorAll(".pinned").forEach(x => x.classList.remove("pinned"));
      if (!was) document.querySelectorAll(`[data-k="${c.dataset.k}"]`).forEach(x => x.classList.add("pinned"));
    });
    document.addEventListener("keydown", e => {
      if (e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") go(p - 1); else if (e.key === "ArrowRight") go(p + 1);
    });
    window.addEventListener("hashchange", () => { const m = location.hash.match(/p=(\d+)/); if (m) go(parseInt(m[1], 10) - urlOffset + ownOffset); });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
    document.addEventListener("readingschange", render);
    document.addEventListener("langchange", render);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
