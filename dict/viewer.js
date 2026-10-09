/*
	Viewer for scanned dictionaries: page images, headword search, contents, zoom.

	new DictionaryViewer(config, element)   config: see dictionaries.js
	URL hash = displayed page, e.g. #123 or #-3 (same as the old chunom.org pages)
*/

import { COLLATORS } from './collate.js';
import { DICTIONARIES } from './dictionaries.js';

const ZOOMS = [1, 1.5, 2, 3];
const SEARCH_DELAY = 350;
const SWIPE_COMMIT = 80; // px a swipe must travel to turn the page
const SWIPE_DAMPING = 0.6; // the page follows the finger at this fraction
const SWIPE_MAX_TILT = 15; // degrees, reached once the finger has travelled the full page width
const SWIPE_OUT_MS = 260; // old page slides out and fades
const SWIPE_IN_MS = 280; // new page slides in and fades in
const WIDE = '(min-width: 1200px)'; // sidebar instead of tabs; keep in sync with dict.css

const store = {
	get(key) { try { return localStorage.getItem(`dict:${key}`); } catch { return null; } },
	set(key, value) { try { localStorage.setItem(`dict:${key}`, value); } catch { /* storage unavailable */ } }
};

// aria* props become aria-* attributes (property reflection is missing in older browsers)
function el(tag, props = {}, ...children) {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(props)) {
		if (/^aria[A-Z]/.test(key)) node.setAttribute(key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), value);
		else node[key] = value;
	}
	node.append(...children);
	return node;
}

export class DictionaryViewer {
	constructor(config, root) {
		this.config = config;
		this.root = root;
		this.min = 1 - config.offset;
		this.max = config.lastImage - config.offset;
		this.page = null;
		this.zoom = Number(store.get('zoom')) || 1;
		this.night = store.get('night') == '1';
		this.words = [];
		this.keys = [];
		this.loadToken = 0;
		this.enter = 0; // direction of a page turn in progress: 1 = next (new page comes from the right)
		this.turning = false;
		this.pivotY = 0; // where the finger holds the page; it tilts around this point
		this.searchTimer = null;

		this.build();
		this.setZoom(this.zoom);
		this.setNight(this.night);
		this.setTelex(store.get('telex') != '0');
		this.bind();
		this.loadIndex();
		this.showTab('pages');
		this.go(this.startPage(), 'replace');
		window.addEventListener('load', () => this.attachIme());
		if (window.VietIme) this.attachIme();
	}

	// ---------- UI ----------

	build() {
		const { config: c, root } = this;
		const ui = this.ui = {};

		const switcher = el('ul', { className: 'nav nav-pills dict-switch mb-2' },
			...Object.values(DICTIONARIES).map(d => el('li', { className: 'nav-item' },
				el('a', { className: `nav-link py-1 px-2${d.id == c.id ? ' active' : ''}`, href: `${d.id}.html`, textContent: d.short }))));

		const header = el('header', { className: 'mb-2' }, switcher,
			el('h1', { className: 'h5 mb-0', lang: c.titleLang || c.lang, textContent: c.title }),
			el('p', { className: 'text-secondary small mb-0' },
				el('span', { lang: c.lang, textContent: c.subtitle }),
				c.note ? el('span', { lang: c.noteLang || c.lang, textContent: ` · ${c.note}` }) : ''));

		ui.search = el('input', {
			type: 'search', className: 'form-control', placeholder: 'Search', autocomplete: 'off', enterKeyHint: 'search',
			ariaLabel: 'Search headword', disabled: true
		});
		ui.telex = el('button', { type: 'button', className: 'btn btn-outline-secondary dict-telex', title: 'Type Vietnamese with Telex (aa → â, ow → ơ, s → sắc)' },
			ui.telexIcon = el('i', { className: 'bi me-1' }), 'Telex');
		ui.searchForm = el('form', { className: 'input-group dict-search', role: 'search' }, ui.search, ui.telex,
			el('button', { type: 'submit', className: 'btn btn-primary', ariaLabel: 'Go to headword' }, el('i', { className: 'bi bi-search' })));

		ui.prev = el('button', { type: 'button', className: 'btn btn-outline-secondary', title: 'Previous page (←)', ariaLabel: 'Previous page' }, el('i', { className: 'bi bi-chevron-left' }));
		ui.next = el('button', { type: 'button', className: 'btn btn-outline-secondary', title: 'Next page (→)', ariaLabel: 'Next page' }, el('i', { className: 'bi bi-chevron-right' }));
		ui.number = el('input', { type: 'text', inputMode: 'numeric', pattern: '-?[0-9]*', className: 'form-control text-center', size: 5, ariaLabel: 'Page number', autocomplete: 'off' });
		ui.pager = el('form', { className: 'input-group dict-pager' }, ui.prev, ui.number, ui.next);

		ui.zoomOut = el('button', { type: 'button', className: 'btn btn-outline-secondary', title: 'Zoom out (−)', ariaLabel: 'Zoom out' }, el('i', { className: 'bi bi-zoom-out' }));
		ui.zoomIn = el('button', { type: 'button', className: 'btn btn-outline-secondary', title: 'Zoom in (+)', ariaLabel: 'Zoom in' }, el('i', { className: 'bi bi-zoom-in' }));
		ui.zoomLabel = el('span', { className: 'btn btn-outline-secondary disabled dict-zoom-label' });
		ui.night = el('button', { type: 'button', className: 'btn btn-outline-secondary', title: 'Invert page colours (N)', ariaLabel: 'Invert page colours' }, el('i', { className: 'bi bi-moon-stars' }));
		ui.tools = el('div', { className: 'btn-group dict-tools' }, ui.zoomOut, ui.zoomLabel, ui.zoomIn, ui.night);

		const toolbar = el('div', { className: 'dict-toolbar' },
			el('div', { className: 'd-flex flex-wrap gap-2 align-items-center py-2' }, ui.searchForm, ui.pager, ui.tools));

		ui.hint = el('div', { className: 'dict-hint text-secondary small', role: 'status', ariaLive: 'polite' });

		ui.img = el('img', { className: 'dict-image', alt: '', draggable: false });
		ui.spinner = el('div', { className: 'dict-spinner spinner-border text-secondary', role: 'status' }, el('span', { className: 'visually-hidden', textContent: 'Loading…' }));
		ui.error = el('div', { className: 'dict-error alert alert-danger', hidden: true },
			el('div', { textContent: 'The page image could not be loaded.' }),
			ui.retry = el('button', { type: 'button', className: 'btn btn-sm btn-outline-light mt-2', textContent: 'Try again' }));
		ui.stage = el('div', { className: 'dict-stage' }, ui.img, ui.spinner, ui.error);
		ui.stageBottom = el('div', { className: 'dict-pager-bottom d-flex justify-content-between my-3' },
			ui.prev2 = el('button', { type: 'button', className: 'btn btn-outline-secondary' }, el('i', { className: 'bi bi-chevron-left' }), ' Previous'),
			ui.next2 = el('button', { type: 'button', className: 'btn btn-outline-secondary' }, 'Next ', el('i', { className: 'bi bi-chevron-right' })));

		const tab = (name, icon, label) => {
			const button = el('button', { type: 'button', className: 'nav-link', role: 'tab', id: `dict-tab-${name}`, ariaControls: `dict-pane-${name}` },
				el('i', { className: `bi ${icon} me-1` }), label);
			button.dataset.tab = name;
			return el('li', { className: 'nav-item', role: 'presentation' }, button);
		};
		ui.tabs = el('ul', { className: 'nav nav-tabs dict-tabs', role: 'tablist' },
			tab('pages', 'bi-book', 'Pages'), tab('contents', 'bi-list-ul', 'Contents'));

		ui.panePages = el('div', { className: 'dict-pane', id: 'dict-pane-pages', role: 'tabpanel', ariaLabelledby: 'dict-tab-pages' },
			toolbar, ui.hint, ui.stage, ui.stageBottom);
		ui.paneContents = el('div', { className: 'dict-pane', id: 'dict-pane-contents', role: 'tabpanel', ariaLabelledby: 'dict-tab-contents' },
			this.buildContents());

		// Wide screens show the contents as a sidebar next to the pages (see dict.css), narrow ones use the tabs
		// Edge hints while swiping: arrow plus the page the swipe leads to
		const swipeHint = (side, icon) => {
			const label = el('span', { className: 'dict-swipe-label' });
			const hint = el('div', { className: `dict-swipe dict-swipe-${side}`, ariaHidden: 'true' }, el('i', { className: `bi ${icon}` }), label);
			hint.label = label;
			return hint;
		};
		ui.hintPrev = swipeHint('prev', 'bi-chevron-left');
		ui.hintNext = swipeHint('next', 'bi-chevron-right');

		root.replaceChildren(el('div', { className: 'dict-wrap pt-3' }, header, ui.tabs,
			el('div', { className: 'dict-layout' }, ui.paneContents, ui.panePages)), ui.hintPrev, ui.hintNext);
	}

	buildContents() {
		const { config: c } = this;
		const ui = this.ui;
		ui.tocLinks = c.toc.map(([page, label, note, lang]) => {
			const a = el('a', { className: 'list-group-item list-group-item-action d-flex justify-content-between align-items-start gap-3', href: `#${page}` },
				el('span', {}, el('span', { lang: lang || c.lang, textContent: label }), note ? el('small', { className: 'text-secondary d-block', textContent: note }) : ''),
				el('span', { className: 'badge text-bg-secondary rounded-pill', textContent: `p. ${page}` }));
			a.dataset.page = page;
			return a;
		});
		const legend = el('dl', { className: 'row small mb-0' },
			...c.legend.flatMap(([symbol, text]) => [el('dt', { className: 'col-3 font-monospace', textContent: symbol }), el('dd', { className: 'col-9', textContent: text })]));
		const side = el('div', { className: 'col-md-5' },
			el('h2', { className: 'h6 text-uppercase text-secondary', textContent: 'Legend' }), legend);
		if (c.source) side.append(el('p', { className: 'small text-secondary mt-4 mb-0' }, 'Source: ', el('a', { href: c.source[1], textContent: c.source[0], target: '_blank', rel: 'noopener' })));
		return el('div', { className: 'row g-4 dict-contents' },
			el('div', { className: 'col-md-7' },
				el('h2', { className: 'h6 text-uppercase text-secondary', textContent: 'Contents' }),
				el('div', { className: 'list-group' }, ...ui.tocLinks)),
			side);
	}

	// ---------- Events ----------

	bind() {
		const ui = this.ui;
		ui.prev.onclick = ui.prev2.onclick = () => this.go(this.page - 1, 'replace');
		ui.next.onclick = ui.next2.onclick = () => this.go(this.page + 1, 'replace');
		ui.retry.onclick = () => this.loadImage();
		ui.zoomIn.onclick = () => this.setZoom(ZOOMS[Math.min(ZOOMS.indexOf(this.zoom) + 1, ZOOMS.length - 1)]);
		ui.zoomOut.onclick = () => this.setZoom(ZOOMS[Math.max(ZOOMS.indexOf(this.zoom) - 1, 0)]);
		ui.night.onclick = () => this.setNight(!this.night);
		ui.img.ondblclick = () => this.setZoom(this.zoom == 1 ? 2 : 1);

		ui.pager.onsubmit = e => {
			e.preventDefault();
			const n = parseInt(ui.number.value, 10);
			if (Number.isNaN(n)) ui.number.value = this.page;
			else this.go(n, 'push');
			ui.number.blur();
		};
		ui.number.onfocus = () => ui.number.select();

		ui.searchForm.onsubmit = e => {
			e.preventDefault();
			clearTimeout(this.searchTimer);
			this.search(ui.search.value, 'push');
			if (matchMedia('(pointer: coarse)').matches) ui.search.blur(); // hide the on-screen keyboard
		};
		ui.search.oninput = () => {
			clearTimeout(this.searchTimer);
			if (ui.search.value.trim()) this.searchTimer = setTimeout(() => this.search(ui.search.value, 'replace'), SEARCH_DELAY);
		};
		ui.telex.onclick = () => this.setTelex(store.get('telex') == '0');

		ui.tabs.addEventListener('click', e => {
			const tab = e.target.closest('[data-tab]');
			if (tab) this.showTab(tab.dataset.tab);
		});
		ui.paneContents.addEventListener('click', e => {
			const link = e.target.closest('a[data-page]');
			if (!link) return;
			e.preventDefault();
			this.go(Number(link.dataset.page), 'push');
			this.showTab('pages');
		});

		addEventListener('hashchange', () => {
			const n = this.hashPage();
			if (n != null && n != this.page) this.go(n, 'none');
			if (n != null) this.showTab('pages');
		});
		addEventListener('keydown', e => this.onKey(e));
		matchMedia(WIDE).addEventListener('change', () => this.applyTabs());
		this.bindSwipe();
	}

	onKey(e) {
		if ((!matchMedia(WIDE).matches && this.tab != 'pages') || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key == 'ArrowLeft') this.go(this.page - 1, 'replace');
		else if (e.key == 'ArrowRight') this.go(this.page + 1, 'replace');
		else if (e.key == '/') { e.preventDefault(); this.ui.search.focus(); }
		else if (e.key == '+' || e.key == '=') this.ui.zoomIn.click();
		else if (e.key == '-') this.ui.zoomOut.click();
		else if (e.key == 'n' || e.key == 'N') this.ui.night.click();
	}

	// A horizontal swipe turns the page: the page follows the finger and an edge hint shows the target page.
	// Only while the page is not zoomed or pinched, so panning and pinch-zoom keep working.
	bindSwipe() {
		const { stage } = this.ui;
		let drag = null;
		const usable = () => !this.turning && this.zoom == 1 && (window.visualViewport?.scale || 1) <= 1.05;

		stage.addEventListener('touchstart', e => {
			drag = e.touches.length == 1 && usable() ? { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, horizontal: null } : null;
			if (drag) this.pivotY = drag.y - this.ui.img.getBoundingClientRect().top;
		}, { passive: true });
		stage.addEventListener('touchmove', e => {
			if (!drag) return;
			if (e.touches.length != 1 || !usable()) { this.swipeEnd(drag.dx, false); drag = null; return; }
			const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
			if (drag.horizontal == null && Math.hypot(dx, dy) > 10) drag.horizontal = Math.abs(dx) > Math.abs(dy) * 1.5; // else it is a scroll
			if (!drag.horizontal) return;
			drag.dx = dx;
			this.swipeMove(dx);
		}, { passive: true });
		const finish = cancelled => {
			if (!drag) return;
			const { dx, horizontal } = drag;
			drag = null;
			if (!horizontal) return;
			const target = this.page + (dx < 0 ? 1 : -1);
			this.swipeEnd(dx, !cancelled && Math.abs(dx) >= SWIPE_COMMIT && target >= this.min && target <= this.max);
		};
		stage.addEventListener('touchend', () => finish(false), { passive: true });
		stage.addEventListener('touchcancel', () => finish(true), { passive: true });
	}

	swipeMove(dx) {
		const { ui } = this;
		const target = this.page + (dx < 0 ? 1 : -1);
		const valid = target >= this.min && target <= this.max;
		const damping = valid ? SWIPE_DAMPING : 0.2; // resists at the first and last page
		const tilt = this.reducedMotion() ? 0 : Math.max(-SWIPE_MAX_TILT, Math.min(SWIPE_MAX_TILT, dx / ui.stage.clientWidth * SWIPE_MAX_TILT * (valid ? 1 : 0.3)));
		ui.img.style.transition = 'none';
		ui.img.style.transformOrigin = `50% ${this.pivotY}px`;
		ui.img.style.transform = `translateX(${dx * damping}px) rotate(${tilt}deg)`;
		for (const [hint, side] of [[ui.hintPrev, 1], [ui.hintNext, -1]]) {
			const active = valid && dx * side > 0;
			hint.style.opacity = active ? Math.min(1, Math.abs(dx) / SWIPE_COMMIT) : 0;
			hint.classList.toggle('is-ready', active && Math.abs(dx) >= SWIPE_COMMIT); // release now to turn
			if (active) hint.label.textContent = `p. ${target}`;
		}
	}

	reducedMotion() {
		return matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/*
		Releasing a swipe: either spring back, or turn the page. Turning: the old page keeps moving in the
		swipe direction and fades out, stays invisible while the next image loads, and the new page then
		slides in from the opposite side. It never jumps back to the middle in between.
	*/
	swipeEnd(dx, commit) {
		const { ui } = this;
		for (const hint of [ui.hintPrev, ui.hintNext]) {
			hint.style.opacity = 0;
			hint.classList.remove('is-ready');
		}
		ui.img.style.transition = ''; // back to the stylesheet transition
		if (!commit) { ui.img.style.transform = ''; return; } // spring back
		const dir = dx < 0 ? 1 : -1;
		if (this.reducedMotion()) {
			ui.img.style.transform = '';
			this.go(this.page + dir, 'replace');
			return;
		}
		this.turning = true;
		ui.img.style.transition = `transform ${SWIPE_OUT_MS}ms ease-in, opacity ${SWIPE_OUT_MS}ms ease-in`;
		ui.img.style.transform = `translateX(${-dir * ui.stage.clientWidth * 0.6}px) rotate(${-dir * SWIPE_MAX_TILT}deg)`;
		ui.img.style.opacity = '0';
		setTimeout(() => {
			this.enter = dir;
			this.go(this.page + dir, 'replace');
		}, SWIPE_OUT_MS);
	}

	/** Called when the next image is ready after a swipe: place it on the far side, then glide to the middle */
	slideIn(dir) {
		const { ui } = this;
		ui.img.style.transition = 'none';
		ui.img.style.transform = `translateX(${dir * ui.stage.clientWidth * 0.35}px) rotate(${dir * SWIPE_MAX_TILT / 2}deg)`;
		ui.img.style.opacity = '0';
		return () => { // call after the new src is set
			ui.img.offsetWidth; // commit the start position
			ui.img.style.transition = `transform ${SWIPE_IN_MS}ms ease-out, opacity ${SWIPE_IN_MS}ms ease-out`;
			ui.img.style.transform = '';
			ui.img.style.opacity = '';
			setTimeout(() => { ui.img.style.transition = ''; this.turning = false; }, SWIPE_IN_MS);
		};
	}

	showTab(name) {
		const { ui } = this;
		this.tab = name;
		this.applyTabs();
		for (const button of ui.tabs.querySelectorAll('[data-tab]')) {
			const on = button.dataset.tab == name;
			button.classList.toggle('active', on);
			button.setAttribute('aria-selected', String(on));
		}
		scrollTo(0, 0);
	}

	// Panes are hidden with the hidden attribute from here, not with CSS classes: a stylesheet that is
	// cached from an older deployment (GitHub Pages caches for hours) must not leave both panes visible.
	applyTabs() {
		const { ui } = this;
		const wide = matchMedia(WIDE).matches;
		ui.tabs.hidden = wide;
		ui.panePages.hidden = !wide && this.tab != 'pages';
		ui.paneContents.hidden = !wide && this.tab != 'contents';
	}

	// ---------- Navigation ----------

	hashPage() {
		const m = location.hash.match(/^#(-?\d+)$/);
		return m ? Number(m[1]) : null;
	}

	startPage() {
		const saved = parseInt(store.get(`${this.config.id}:page`), 10);
		return this.hashPage() ?? (Number.isNaN(saved) ? 1 : saved);
	}

	/** mode: 'push' adds a history entry, 'replace' rewrites it, 'none' leaves the URL alone */
	go(page, mode) {
		page = Math.max(this.min, Math.min(this.max, Math.round(page)));
		const changed = page != this.page;
		this.page = page;
		const { ui, config: c } = this;

		ui.number.value = page;
		ui.prev.disabled = ui.prev2.disabled = page <= this.min;
		ui.next.disabled = ui.next2.disabled = page >= this.max;
		document.title = `${c.short} · p. ${page} | Chunom.org`;
		this.updateHint();
		let current = null;
		for (const a of ui.tocLinks) {
			if (Number(a.dataset.page) <= page) current = a;
			a.classList.remove('active');
		}
		current?.classList.add('active');

		store.set(`${c.id}:page`, page);
		if (mode != 'none' && this.hashPage() != page) history[mode == 'push' ? 'pushState' : 'replaceState'](null, '', `#${page}`);
		if (changed || !ui.img.src) {
			this.loadImage();
			scrollTo(0, 0);
		}
	}

	updateHint(extra = '') {
		const i = this.page - 1;
		const range = i >= 0 && i < this.words.length
			? `${i ? `${this.words[i - 1]} → ` : ''}${this.words[i]}`
			: '';
		this.ui.hint.textContent = [extra, range && `Index: ${range}`].filter(Boolean).join(' · ') || ' ';
	}

	loadImage() {
		const { ui, config: c } = this;
		const file = this.page + c.offset;
		const url = c.pageUrl(file);
		const token = ++this.loadToken;
		ui.stage.classList.add('is-loading');
		ui.error.hidden = true;
		const probe = new Image();
		probe.onload = () => {
			if (token != this.loadToken) return;
			const dir = this.enter;
			this.enter = 0;
			const glide = dir ? this.slideIn(dir) : null; // after a swipe: new page slides in from the far side
			ui.img.src = url;
			ui.img.alt = `${c.short}, page ${this.page}`;
			ui.stage.classList.remove('is-loading');
			glide?.();
			for (const n of [this.page + 1, this.page - 1]) if (n >= this.min && n <= this.max) new Image().src = c.pageUrl(n + c.offset);
		};
		probe.onerror = () => {
			if (token != this.loadToken) return;
			ui.stage.classList.remove('is-loading');
			ui.error.hidden = false;
			// leave nothing half-animated behind
			this.enter = 0;
			this.turning = false;
			ui.img.style.transition = ui.img.style.transform = ui.img.style.opacity = '';
		};
		probe.src = url;
	}

	// ---------- Search ----------

	async loadIndex() {
		const { config: c, ui } = this;
		try {
			const r = await fetch(new URL(`data/${c.id}.json`, import.meta.url));
			if (!r.ok) throw new Error(r.status);
			this.words = await r.json();
			const collate = COLLATORS[c.id];
			this.keys = this.words.map(collate);
			this.collate = collate;
			ui.search.disabled = false;
			this.updateHint();
		} catch {
			ui.search.placeholder = 'Search unavailable';
		}
	}

	/** First page whose last headword is not before the query (same rule as the old site) */
	search(query, mode) {
		query = query.trim();
		if (!query || !this.keys.length) return;
		const q = this.collate(query);
		let n = this.keys.findIndex(key => q <= key);
		if (n < 0) return this.updateHint(`“${query}” is after the last headword`);
		if (n == this.keys.length - 1) n--;
		this.go(n + 1, mode);
		this.updateHint(`“${query}”`);
	}

	attachIme() {
		if (this.ime || !window.VietIme) return;
		this.ime = new VietIme(this.ui.search, { candidates: false, telex: store.get('telex') != '0' });
		this.setTelex(store.get('telex') != '0');
	}

	setTelex(on) {
		store.set('telex', on ? '1' : '0');
		this.ui.telex.classList.toggle('active', on);
		this.ui.telex.setAttribute('aria-pressed', String(on));
		this.ui.telexIcon.className = `bi me-1 ${on ? 'bi-check-square-fill' : 'bi-square'}`;
		this.ime?.update({ telex: on });
	}

	// ---------- View settings ----------

	setZoom(zoom) {
		this.zoom = zoom;
		store.set('zoom', zoom);
		this.ui.stage.style.setProperty('--zoom', zoom);
		this.ui.stage.classList.toggle('is-zoomed', zoom > 1);
		this.ui.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
		this.ui.zoomOut.disabled = zoom == ZOOMS[0];
		this.ui.zoomIn.disabled = zoom == ZOOMS.at(-1);
	}

	setNight(on) {
		this.night = on;
		store.set('night', on ? '1' : '0');
		this.ui.stage.classList.toggle('is-inverted', on);
		this.ui.night.classList.toggle('active', on);
		this.ui.night.setAttribute('aria-pressed', String(on));
	}
}
