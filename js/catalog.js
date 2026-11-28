// The catalogue of Hán-Nôm scans (catalog/): list of the works with search and filters.
// The data is /chunom/catalog/catalog.json, built in the repository qtng/chunom-library (scripts/build.py).
// Texts of the interface: data-vi in the page, Lang.t() for texts made here; the data of the catalogue is shown as it is.
(function () {
  "use strict";
  const DATA = "/chunom/catalog/catalog.json";
  const $ = id => document.getElementById(id);
  const t = (en, vi) => (window.Lang ? Lang.t(en, vi) : en);

  // the script of the text (catalog/script.yaml of qtng/chunom-library); "unknown" until decided
  const SCRIPTS = {
    "nom": ["Chữ Nôm", "Chữ Nôm"],
    "han-nom": ["Hán with Nôm", "Chữ Hán kèm chữ Nôm"],
    "han": ["Chữ Hán", "Chữ Hán"],
  };
  const scriptOf = w => w.script || "unknown";
  const matchesScript = (w, s) => !s || (s === "with-nom" ? ["nom", "han-nom"].includes(scriptOf(w)) : scriptOf(w) === s);

  // admins (app_metadata.is_admin in the Supabase session of this browser, as navigation.js reads it) also see the
  // withheld copies (item.withheld: personal data, copyright, permission needed); for everyone else they are hidden
  // here – hidden only, catalog.json contains them
  const isAdmin = () => { try { return (JSON.parse(localStorage.getItem("sb-kfgqhhmdzboszpwsqkxt-auth-token")) || {}).user?.app_metadata?.is_admin === true; } catch { return false; } };

  // short name of a library for the cards and the filter
  const libraryName = inst => String(inst || "").split(",")[0].trim();

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v; else e.setAttribute(k, v);
    }
    for (const c of children) if (c != null && c !== "") e.append(c);
    return e;
  }

  function titles(work) {
    const main = (work.titles || []).filter(x => (x.type || "main") === "main");
    const qn = main.find(x => x.script === "quoc-ngu") || main.find(x => x.script === "latin-other") || main[0] || {};
    const han = main.find(x => x.script === "han-nom");
    return { qn: qn.text || work.id, han: han ? han.text : "" };
  }

  function authorLine(work) {
    return (work.authors || []).map(a => {
      const life = a.born || a.died ? ` (${a.born || "?"}–${a.died || "?"})` : "";
      return a.name + (a.name_han_nom ? ` ${a.name_han_nom}` : "") + life;
    }).join("; ");
  }

  function years(work) {
    const ys = work.items.map(i => i.physical.date_earliest).filter(Boolean);
    if (!ys.length) return "";
    const lo = Math.min(...ys), hi = Math.max(...ys);
    return lo === hi ? String(lo) : `${lo}–${hi}`;
  }

  // everything a search may match: titles, authors, shelfmarks, libraries, the title as written on the copy
  function haystack(work) {
    const parts = [work.id, ...(work.titles || []).map(x => x.text), authorLine(work)];
    for (const i of work.items) parts.push(i.holding.shelfmark, i.holding.institution, i.title_on_item);
    return fold(parts.join(" "));
  }
  // compare without diacritics and case, so "kim van kieu" finds "Kim Vân Kiều"
  const fold = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

  function card(work) {
    const { qn, han } = titles(work);
    const n = work.items.length;
    const libs = [...new Set(work.items.map(i => libraryName(i.holding.institution)))].join(", ");
    const types = new Set(work.items.map(i => i.physical.type));
    const typeText = types.has("woodblock-print") ? t("woodblock print", "in khắc gỗ")
      : types.has("manuscript") ? t("manuscript", "viết tay") : "";
    const info = [
      n === 1 ? t("1 copy", "1 bản") : t(`${n} copies or volumes`, `${n} bản hoặc tập`),
      libs, years(work), typeText,
    ].filter(Boolean).join(" · ");
    const nc = work.items.some(i => !i.withheld && i.license && i.license.commercial_use === false);
    const held = work.items.filter(i => i.withheld).length;
    const sc = SCRIPTS[scriptOf(work)];
    return el("a", { class: "card-box work d-block text-decoration-none", href: `view.html?work=${encodeURIComponent(work.id)}` },
      sc ? el("span", { class: `badge-script script-${scriptOf(work)}` }, t(sc[0], sc[1])) : null,
      han ? el("span", { class: "nom", lang: "vi-Hani" }, han) : null,
      el("span", { class: "qn" }, qn),
      authorLine(work) ? el("span", { class: "card-sum text-secondary" }, authorLine(work)) : null,
      el("small", { class: "d-block text-secondary" }, info,
        nc ? el("span", { class: "badge-nc ms-1", title: t("Free for non-commercial use", "Dùng tự do cho mục đích phi thương mại") }, "NC") : null,
        held ? el("span", { class: "badge-withheld ms-1", title: t("Not published: shown to admins only", "Chưa công bố: chỉ quản trị viên thấy") },
          held === n ? t("Withheld", "Chưa công bố") : t(`${held} withheld`, `${held} chưa công bố`)) : null),
    );
  }

  let works = [];

  function render() {
    const q = fold($("q").value.trim());
    const lib = $("library").value, type = $("type").value, script = $("script").value;
    const shown = works.filter(w =>
      (!q || q.split(/\s+/).every(word => w._hay.includes(word))) &&
      matchesScript(w, script) &&
      (!lib || w.items.some(i => libraryName(i.holding.institution) === lib)) &&
      (!type || w.items.some(i => i.physical.type === type)));
    $("works").replaceChildren(...shown.map(card));
    $("count").textContent = t(`${shown.length} of ${works.length} works`, `${shown.length} trên ${works.length} tác phẩm`);
    // keep the search in the address, so it can be shared and survives going back
    const params = new URLSearchParams(location.search);
    for (const [k, v] of [["q", $("q").value.trim()], ["script", script], ["library", lib], ["type", type]]) v ? params.set(k, v) : params.delete(k);
    const qs = params.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  async function init() {
    let data;
    try {
      const res = await fetch(DATA);
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch (e) {
      $("works").replaceChildren(el("p", { class: "text-danger" }, t("The catalogue could not be loaded.", "Không tải được thư mục.")));
      return;
    }
    const admin = isAdmin();
    for (const w of data.works) if (!admin) w.items = w.items.filter(i => !i.withheld);
    works = data.works.filter(w => w.items.length);
    for (const w of works) { w._hay = haystack(w); w._sort = fold(titles(w).qn); }
    works.sort((a, b) => a._sort.localeCompare(b._sort));

    const libs = [...new Set(works.flatMap(w => w.items.map(i => libraryName(i.holding.institution))))].sort();
    $("library").append(...libs.map(l => el("option", { value: l }, l)));

    const params = new URLSearchParams(location.search);
    $("q").value = params.get("q") || "";
    if (libs.includes(params.get("library"))) $("library").value = params.get("library");
    $("type").value = params.get("type") || "";
    $("script").value = params.get("script") || "";

    $("q").addEventListener("input", render);
    $("library").addEventListener("change", render);
    $("type").addEventListener("change", render);
    $("script").addEventListener("change", render);
    document.addEventListener("langchange", render);
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
