// A small IIIF viewer without libraries: reads a IIIF Presentation manifest (version 2 or 3) and shows
// one page at a time, with thumbnails, page number, zoom and panning. The images come from the IIIF Image API
// of the library in the size that is needed (sharper when zooming in).
//   const v = new IIIFViewer(sectionElement, { onPage: n => … });
//   await v.load(manifestUrl, startPage);   // pages count from 1
// The markup is in catalog/view.html (data-act buttons, data-role parts).
(function () {
  "use strict";
  const t = (en, vi) => (window.Lang ? Lang.t(en, vi) : en);
  const ZOOMS = [1, 1.5, 2, 3, 4, 6];

  function first(x) { return Array.isArray(x) ? x[0] : x; }
  function label(l) {
    if (!l) return "";
    if (typeof l === "string") return l;
    if (Array.isArray(l)) return label(l[0]);
    if (l["@value"]) return l["@value"];
    for (const v of Object.values(l)) if (Array.isArray(v) && v.length) return String(v[0]);
    return "";
  }

  // the pages of a manifest: label, image service (or a plain image), width, height
  function canvases(manifest) {
    const out = [];
    if (manifest.sequences) {   // IIIF 2
      for (const c of (manifest.sequences[0] || {}).canvases || []) {
        const res = (first(c.images) || {}).resource;
        if (!res) continue;
        const svc = first(res.service);
        out.push({ label: label(c.label), service: svc && (svc["@id"] || svc.id), image: res["@id"],
          original: (first(c.rendering) || {})["@id"],
          width: res.width || c.width, height: res.height || c.height });
      }
    } else {                    // IIIF 3
      for (const c of manifest.items || []) {
        const anno = (((c.items || [])[0] || {}).items || [])[0];
        const body = anno && first(anno.body);
        if (!body) continue;
        const svc = first(body.service);
        out.push({ label: label(c.label), service: svc && (svc.id || svc["@id"]), image: body.id,
          original: (first(c.rendering) || {}).id,   // e.g. the original file on Wikimedia Commons
          width: body.width || c.width, height: body.height || c.height });
      }
    }
    return out;
  }

  // Wikimedia Commons has no IIIF image server, but thumbnails in standard widths:
  // …/thumb/a/ab/Name.jpg/960px-Name.jpg, for a page of a PDF …/thumb/a/ab/Name.pdf/page3-960px-Name.pdf.jpg
  const COMMONS_THUMB = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/)((?:page\d+-|lossy-page\d+-)?)(\d+)px-(.+)$/;
  const COMMONS_WIDTHS = [120, 250, 330, 500, 960, 1280, 1920, 3840];
  function commonsUrl(url, width, max) {
    const m = url && url.match(COMMONS_THUMB);
    if (!m) return null;
    // a thumbnail wider than the original image is refused: stay at or below its width
    // (pages of a PDF/DjVu are rendered at any standard width, so no limit there)
    const allowed = max && !m[2] ? COMMONS_WIDTHS.filter(x => x <= max) : COMMONS_WIDTHS;
    const widths = allowed.length ? allowed : [COMMONS_WIDTHS[0]];
    const w = widths.find(x => x >= width) || widths[widths.length - 1];
    return `${m[1]}${m[2]}${w}px-${m[4]}`;
  }

  function imageUrl(page, width) {
    if (!page.service) return commonsUrl(page.image, width, page.width) || page.image;
    const w = page.width ? Math.min(width, page.width) : width;
    return `${page.service.replace(/\/$/, "")}/full/${w},/0/default.jpg`;
  }
  function fullUrl(page) {
    if (page.service) return `${page.service.replace(/\/$/, "")}/full/full/0/default.jpg`;
    return page.original || page.image;
  }

  class IIIFViewer {
    constructor(root, opts = {}) {
      this.root = root;
      this.onPage = opts.onPage || (() => {});
      this.part = r => root.querySelector(`[data-role="${r}"]`);
      this.stage = this.part("stage");
      this.img = this.part("image");
      this.input = root.querySelector(".iiif-pageno input");
      this.pages = [];
      this.index = 0;
      this.zoom = 0;   // index into ZOOMS; 1 = the page fits the width of the stage
      this.bind();
    }

    bind() {
      this.root.addEventListener("click", e => {
        const b = e.target.closest("[data-act]");
        if (!b) return;
        ({ prev: () => this.go(this.index - 1), next: () => this.go(this.index + 1),
           "zoom-in": () => this.setZoom(this.zoom + 1), "zoom-out": () => this.setZoom(this.zoom - 1),
           fit: () => this.setZoom(0) })[b.dataset.act]?.();
      });
      this.input.addEventListener("change", () => this.go(parseInt(this.input.value, 10) - 1));
      this.stage.addEventListener("keydown", e => {
        const k = { ArrowLeft: () => this.go(this.index - 1), ArrowRight: () => this.go(this.index + 1),
          "+": () => this.setZoom(this.zoom + 1), "=": () => this.setZoom(this.zoom + 1),
          "-": () => this.setZoom(this.zoom - 1), "0": () => this.setZoom(0) }[e.key];
        if (k) { e.preventDefault(); k(); }
      });
      // drag to move a zoomed page
      let drag = null;
      this.stage.addEventListener("pointerdown", e => {
        if (this.zoom === 0 || e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, left: this.stage.scrollLeft, top: this.stage.scrollTop };
        this.stage.setPointerCapture(e.pointerId);
        this.stage.classList.add("dragging");
      });
      this.stage.addEventListener("pointermove", e => {
        if (!drag) return;
        this.stage.scrollLeft = drag.left - (e.clientX - drag.x);
        this.stage.scrollTop = drag.top - (e.clientY - drag.y);
      });
      const end = () => { drag = null; this.stage.classList.remove("dragging"); };
      this.stage.addEventListener("pointerup", end);
      this.stage.addEventListener("pointercancel", end);
      // a double click zooms in at that place
      this.stage.addEventListener("dblclick", e => {
        const r = this.img.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        this.setZoom(this.zoom + 1, fx, fy);
      });
      let resizeTimer;
      window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => this.show(), 200); });
    }

    message(text) {
      const m = this.part("message");
      m.hidden = !text;
      m.textContent = text || "";
      this.img.hidden = !!text;
    }

    async load(manifestUrl, start = 1) {
      this.pages = [];
      this.part("thumbs").replaceChildren();
      this.part("total").textContent = "–";
      this.message(t("Loading the pages …", "Đang tải các trang …"));
      let manifest;
      try {
        const res = await fetch(manifestUrl);
        if (!res.ok) throw new Error(res.status);
        manifest = await res.json();
      } catch (e) {
        this.message(t("The library's server did not deliver the pages. Please open the scan at the library (link below).",
          "Máy chủ của thư viện không trả về các trang. Xin mở bản quét tại trang của thư viện (liên kết bên dưới)."));
        return false;
      }
      this.pages = canvases(manifest);
      if (!this.pages.length) {
        this.message(t("This manifest has no pages.", "Manifest này không có trang nào."));
        return false;
      }
      this.part("total").textContent = this.pages.length;
      this.input.max = this.pages.length;
      this.thumbs();
      this.zoom = 0;
      this.go(Math.min(Math.max(start, 1), this.pages.length) - 1, true);
      return true;
    }

    thumbs() {
      const box = this.part("thumbs");
      box.replaceChildren(...this.pages.map((p, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.title = p.label || String(i + 1);
        const im = document.createElement("img");
        im.loading = "lazy";
        im.alt = "";
        im.src = imageUrl(p, 90);
        b.append(im, Object.assign(document.createElement("span"), { textContent: i + 1 }));
        b.addEventListener("click", () => this.go(i));
        return b;
      }));
    }

    go(i, initial = false) {
      if (!this.pages.length) return;
      i = Math.min(Math.max(i, 0), this.pages.length - 1);
      if (i === this.index && !initial && this.img.src) return;
      this.index = i;
      this.input.value = i + 1;
      this.part("label").textContent = this.pages[i].label && this.pages[i].label !== String(i + 1) ? this.pages[i].label : "";
      this.part("full").href = fullUrl(this.pages[i]);
      this.root.querySelector('[data-act="prev"]').disabled = i === 0;
      this.root.querySelector('[data-act="next"]').disabled = i === this.pages.length - 1;
      const thumbs = this.part("thumbs").children;
      for (const [n, b] of [...thumbs].entries()) b.classList.toggle("active", n === i);
      // centre the thumbnail in its strip without scrolling the window
      const strip = this.part("thumbs"), tb = thumbs[i];
      if (tb) strip.scrollLeft = tb.offsetLeft - strip.offsetLeft - (strip.clientWidth - tb.offsetWidth) / 2;
      this.stage.scrollTo(0, 0);
      this.show();
      this.onPage(i + 1);
    }

    setZoom(z, fx = 0.5, fy = 0.3) {
      z = Math.min(Math.max(z, 0), ZOOMS.length - 1);
      if (z === this.zoom) return;
      const before = this.img.getBoundingClientRect();
      this.zoom = z;
      this.show();
      // keep the point that was looked at in the same place
      const after = this.img.getBoundingClientRect();
      this.stage.scrollLeft += (after.left + fx * after.width) - (before.left + fx * before.width);
      this.stage.scrollTop += (after.top + fy * after.height) - (before.top + fy * before.height);
      this.root.querySelector('[data-act="zoom-out"]').disabled = z === 0;
      this.root.querySelector('[data-act="zoom-in"]').disabled = z === ZOOMS.length - 1;
    }

    show() {
      const page = this.pages[this.index];
      if (!page) return;
      this.message("");
      const stageW = this.stage.clientWidth - 2;
      const stageH = Math.max(this.stage.clientHeight - 2, 300);
      const ratio = page.width && page.height ? page.width / page.height : 0.7;
      // fit: the whole page is visible; zooming makes it wider than the stage
      const fitW = Math.min(stageW, stageH * ratio);
      const w = Math.round(this.zoom === 0 ? fitW : stageW * ZOOMS[this.zoom]);
      this.img.style.width = `${w}px`;
      this.img.style.height = `${Math.round(w / ratio)}px`;
      this.stage.classList.toggle("zoomed", this.zoom > 0);
      // ask the server for the pixels the screen needs, in steps of 400 so the browser can reuse them
      const need = Math.ceil((w * (window.devicePixelRatio || 1)) / 400) * 400;
      const src = imageUrl(page, need);
      if (this.img.dataset.src === src) return;
      this.img.dataset.src = src;
      this.img.alt = t(`Page ${this.index + 1}`, `Trang ${this.index + 1}`);
      const pre = new Image();
      pre.onload = () => { if (this.img.dataset.src === src) this.img.src = src; };
      pre.onerror = () => {
        if (this.img.dataset.src !== src) return;
        if (page.service && page.image && src !== page.image) { this.img.dataset.src = page.image; this.img.src = page.image; }
        else this.message(t("This page could not be loaded.", "Không tải được trang này."));
      };
      pre.src = src;
    }
  }

  window.IIIFViewer = IIIFViewer;
})();
