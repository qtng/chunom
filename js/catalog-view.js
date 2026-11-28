// One work of the catalogue (the scan viewer) (catalog/view.html?work=…&item=…#p=…): title, the copies or volumes, the viewer,
// and the source with its licence. Data: /chunom/catalog/catalog.json (built in qtng/chunom-library).
(function () {
  "use strict";
  const DATA = "/chunom/catalog/catalog.json";
  const $ = id => document.getElementById(id);
  const t = (en, vi) => (window.Lang ? Lang.t(en, vi) : en);

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else e.setAttribute(k, v);
    }
    for (const c of children) if (c != null && c !== "") e.append(c);
    return e;
  }
  const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener" }, text);

  const TYPES = {
    "woodblock-print": ["Woodblock print", "Bản in khắc gỗ"],
    "manuscript": ["Manuscript", "Bản viết tay"],
    "lithograph": ["Lithograph", "Bản in thạch bản"],
    "movable-type": ["Movable type", "Bản in chữ rời"],
    "rubbing": ["Rubbing", "Bản dập"],
    "other": ["Not determined yet", "Chưa xác định"],
  };

  const SCRIPTS = {
    "nom": ["Chữ Nôm", "Chữ Nôm"],
    "han-nom": ["Chữ Hán with Nôm parts", "Chữ Hán kèm chữ Nôm"],
    "han": ["Chữ Hán only", "Chỉ chữ Hán"],
    "unknown": ["Not determined yet", "Chưa xác định"],
  };
  const BASIS = {
    "source": ["stated by the source", "theo mô tả của nguồn"],
    "known-work": ["known work", "tác phẩm đã biết"],
    "scan": ["checked on the scan", "đã kiểm tra trên bản quét"],
  };

  // admins (app_metadata.is_admin, as navigation.js reads it) also see the withheld copies; hidden for everyone else
  const isAdmin = () => { try { return (JSON.parse(localStorage.getItem("sb-kfgqhhmdzboszpwsqkxt-auth-token")) || {}).user?.app_metadata?.is_admin === true; } catch { return false; } };
  const WITHHELD = {
    "personal-data": ["Personal data", "Dữ liệu cá nhân"],
    "copyright": ["Copyright", "Bản quyền"],
    "permission-needed": ["Permission needed", "Cần xin phép"],
    "other": ["Rights not clear", "Quyền chưa rõ"],
  };

  let work, viewer, item, texts = [];   // texts: the transcriptions of the work (/chunom/reader/texts.json), read in reader/

  // the link to the reader of the transcription: for a copy with the same scan on the same page (the same query, only the path differs),
  // else, when another copy of the work has one, to that transcription
  function textLink(page) {
    const own = texts.find(x => x.copies[item.id] != null), other = own ? null : texts[0];
    let p = $("to-text");
    if (!own && !other) { if (p) p.hidden = true; return; }
    if (!p) {
      p = el("p", { id: "to-text", class: "mt-3 mb-0" });
      $("work-authors").after(p);
    }
    p.hidden = false;
    const a = own
      ? el("a", { class: "btn btn-sm btn-pill btn-accent", href: `/chunom/reader/?work=${encodeURIComponent(work.id)}&item=${encodeURIComponent(item.id)}#p=${page}` },
          el("i", { class: "bi bi-book" }), " ", el("span", { "data-vi": "Đọc kèm quốc ngữ" }, "Read with Quốc ngữ"))
      : el("a", { class: "btn btn-sm btn-pill btn-quiet", href: `/chunom/reader/?work=${encodeURIComponent(work.id)}&item=${encodeURIComponent(other.item)}` },
          el("i", { class: "bi bi-book" }), " ", el("span", { "data-vi": "Có bản phiên âm của một bản khác" }, "Transcription of another copy"));
    const tx = own || other;
    p.replaceChildren(a, tx.released ? "" : el("span", { class: "badge-withheld ms-2" }, t("Not released", "Chưa công bố")));
  }

  function titles(w) {
    const main = (w.titles || []).filter(x => (x.type || "main") === "main");
    const qn = main.find(x => x.script === "quoc-ngu") || main.find(x => x.script === "latin-other") || main[0] || {};
    const han = main.find(x => x.script === "han-nom");
    return { qn: qn.text || w.id, han: han ? han.text : "" };
  }

  // what a copy contains (item.content of the catalogue); "original" is the text itself
  const CONTENT = {
    "original": ["Original", "Bản gốc"],
    "edition-with-translation": ["Edition with translation", "Bản in kèm bản dịch"],
    "translation": ["Translation", "Bản dịch"],
    "transcription": ["Quốc ngữ transcription", "Bản phiên âm quốc ngữ"],
    "modern-edition": ["Modern edition", "Bản in hiện đại"],
    "dictionary": ["Dictionary", "Từ điển"],
    "map": ["Map", "Bản đồ"],
  };
  const contentText = i => { const c = CONTENT[i.content || "original"] || CONTENT.original; return t(c[0], c[1]); };

  const hasText = i => texts.some(x => x.copies[i.id] != null);

  function itemLabel(i) {
    const parts = [i.holding.shelfmark !== "not stated" ? i.holding.shelfmark : "", i.physical.date].filter(Boolean);
    // without shelfmark and date, the title as the library states it tells the copies apart
    const tail = parts.length ? parts.join(", ") : String(i.title_on_item || "").slice(0, 70);
    return `${i.withheld ? `[${t("Withheld", "Chưa công bố")}] ` : ""}${contentText(i)}: ${String(i.holding.institution).split(",")[0]}${tail ? " – " + tail : ""}`
      + (hasText(i) ? ` · ${t("with Quốc ngữ", "kèm quốc ngữ")}` : "");
  }

  function row(dt, ...dd) {
    return [el("dt", { class: "col-sm-3" }, dt), el("dd", { class: "col-sm-9" }, ...dd)];
  }

  function renderSource() {
    const i = item, lic = i.license || {};
    const typ = TYPES[i.physical.type] || [i.physical.type, i.physical.type];
    const sc = SCRIPTS[work.script || "unknown"] || SCRIPTS.unknown;
    const basis = BASIS[work.script_basis];
    const wr = i.withheld ? (WITHHELD[i.withheld.reason] || WITHHELD.other) : null;
    const dl = el("dl", { class: "row meta mb-0" },
      ...(wr ? row(t("Not published", "Chưa công bố"),
        el("span", { class: "badge-withheld" }, t(wr[0], wr[1])),
        el("span", { class: "d-block text-secondary" }, t("Shown to admins only.", "Chỉ quản trị viên thấy.")),
        el("span", { class: "d-block text-secondary source-text" }, i.withheld.note)) : []),
      ...row(t("Script of the text", "Loại chữ của văn bản"),
        el("span", { class: `badge-script script-${work.script || "unknown"}` }, t(sc[0], sc[1])),
        basis ? el("span", { class: "text-secondary" }, ` (${t(basis[0], basis[1])})`) : null,
        work.script_evidence ? el("span", { class: "d-block text-secondary source-text" }, work.script_evidence) : null),
      ...row(t("Library", "Thư viện"), i.holding.institution + (i.holding.city ? `, ${i.holding.city}` : "")),
      ...row(t("Shelfmark", "Ký hiệu"), i.holding.shelfmark),
      ...(i.physical.date ? row(t("Date of the copy", "Niên đại của bản"), i.physical.date) : []),
      ...row(t("Content of this copy", "Nội dung của bản này"), contentText(i)),
      ...row(t("Type", "Loại bản"), t(typ[0], typ[1])),
      ...row(t("Title on the copy", "Tên trên bản"), el("span", { lang: "und" }, i.title_on_item)),
      ...(i.physical.source_description
        ? row(t("Library's description", "Mô tả của thư viện"), el("span", { lang: i.digital.source === "gallica" ? "fr" : null, class: "source-text" }, i.physical.source_description))
        : []),
      ...row(t("Source", "Nguồn"), link(i.digital.source_url, i.digital.source_name || i.digital.source_url)),
      ...row(t("Licence", "Giấy phép"),
        lic.url ? link(lic.url, lic.label || lic.id) : (lic.label || lic.id), " ",
        lic.statement_url ? link(lic.statement_url, t("(terms of the source)", "(điều kiện của nguồn)")) : null,
        lic.commercial_use === false
          ? el("span", { class: "d-block text-secondary" }, t("Free for non-commercial use, with the credit line.", "Dùng tự do cho mục đích phi thương mại, kèm ghi nguồn."))
          : null),
      ...(lic.attribution ? row(t("Credit line", "Ghi nguồn"), el("span", { class: "credit" }, lic.attribution)) : []),
      ...row("IIIF", link(i.digital.iiif_manifest, t("Manifest", "Manifest"))),
    );
    $("source").replaceChildren(el("h2", { class: "h6 mb-3" }, t("Source and licence", "Nguồn và giấy phép")), dl);
  }

  function state(page) {
    const p = new URLSearchParams(location.search);
    p.set("work", work.id);
    if (work.items.length > 1) p.set("item", item.id); else p.delete("item");
    history.replaceState(null, "", `?${p}${page > 1 ? `#p=${page}` : ""}`);
    textLink(page);
  }

  async function showItem(id, page = 1) {
    item = work.items.find(i => i.id === id) || work.items[0];
    $("item-select").value = item.id;
    renderSource();
    state(page);
    await viewer.load(item.digital.iiif_manifest, page);
  }

  function renderWork() {
    const { qn, han } = titles(work);
    document.title = `${qn} – ${t("Hán-Nôm scans", "Bản quét Hán Nôm")}`;
    const h1 = $("work-title");
    h1.removeAttribute("data-vi");
    if (han) { h1.textContent = han; h1.setAttribute("lang", "vi-Hani"); $("work-qn").textContent = qn; }
    else { h1.textContent = qn; h1.removeAttribute("lang"); $("work-qn").textContent = ""; }
    $("work-authors").textContent = (work.authors || []).map(a => {
      const life = a.born || a.died ? ` (${a.born || "?"}–${a.died || "?"})` : "";
      return a.name + (a.name_han_nom ? ` ${a.name_han_nom}` : "") + life;
    }).join("; ");
    const sel = $("item-select");
    sel.replaceChildren(...work.items.map(i => el("option", { value: i.id }, itemLabel(i))));
    $("items").hidden = work.items.length < 2;
  }

  async function init() {
    viewer = new IIIFViewer($("viewer"), { onPage: n => state(n) });
    const params = new URLSearchParams(location.search);
    let data;
    try {
      const res = await fetch(DATA);
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch (e) {
      $("work-title").textContent = t("The catalogue could not be loaded.", "Không tải được thư mục.");
      return;
    }
    work = data.works.find(w => w.id === params.get("work"));
    if (work && !isAdmin()) work.items = work.items.filter(i => !i.withheld);
    if (!work || !work.items.length) {
      $("work-title").textContent = t("This work is not in the catalogue.", "Tác phẩm này không có trong thư mục.");
      $("viewer").hidden = true;
      return;
    }
    // a transcription not released yet: its button only for admins (the reader itself opens with a direct link)
    try { texts = (await (await fetch("/chunom/reader/texts.json")).json()).texts.filter(x => x.work === work.id && (x.released || isAdmin())); } catch { texts = []; }
    // copies with a transcription (readable in the reader) first, so that the first one is shown when no copy is asked for;
    // then originals, editions, translations …; within each, by date
    const rank = Object.keys(CONTENT);
    work.items.sort((a, b) => (hasText(b) - hasText(a)) || (rank.indexOf(a.content || "original") - rank.indexOf(b.content || "original"))
      || ((a.physical.date_earliest || 9999) - (b.physical.date_earliest || 9999)) || a.id.localeCompare(b.id));
    renderWork();
    const page = parseInt((location.hash.match(/p=(\d+)/) || [])[1] || "1", 10);
    $("item-select").addEventListener("change", e => showItem(e.target.value));
    document.addEventListener("langchange", () => { renderWork(); $("item-select").value = item.id; renderSource(); });
    await showItem(params.get("item"), page);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
