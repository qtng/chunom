// One work of the catalogue (catalog/view.html?work=…&item=…#p=…): title, the copies or volumes, the viewer,
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

  let work, viewer, item;

  function titles(w) {
    const main = (w.titles || []).filter(x => (x.type || "main") === "main");
    const qn = main.find(x => x.script === "quoc-ngu") || main.find(x => x.script === "latin-other") || main[0] || {};
    const han = main.find(x => x.script === "han-nom");
    return { qn: qn.text || w.id, han: han ? han.text : "" };
  }

  function itemLabel(i) {
    const parts = [i.holding.shelfmark, i.physical.date].filter(Boolean);
    return `${String(i.holding.institution).split(",")[0]} – ${parts.join(", ")}`;
  }

  function row(dt, ...dd) {
    return [el("dt", { class: "col-sm-3" }, dt), el("dd", { class: "col-sm-9" }, ...dd)];
  }

  function renderSource() {
    const i = item, lic = i.license || {};
    const typ = TYPES[i.physical.type] || [i.physical.type, i.physical.type];
    const dl = el("dl", { class: "row meta mb-0" },
      ...row(t("Library", "Thư viện"), i.holding.institution + (i.holding.city ? `, ${i.holding.city}` : "")),
      ...row(t("Shelfmark", "Ký hiệu"), i.holding.shelfmark),
      ...(i.physical.date ? row(t("Date of the copy", "Niên đại của bản"), i.physical.date) : []),
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
    if (!work || !work.items.length) {
      $("work-title").textContent = t("This work is not in the catalogue.", "Tác phẩm này không có trong thư mục.");
      $("viewer").hidden = true;
      return;
    }
    renderWork();
    const page = parseInt((location.hash.match(/p=(\d+)/) || [])[1] || "1", 10);
    $("item-select").addEventListener("change", e => showItem(e.target.value));
    document.addEventListener("langchange", () => { renderWork(); $("item-select").value = item.id; renderSource(); });
    await showItem(params.get("item"), page);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
