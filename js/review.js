/*
	ChunomReview – the popup in which signed-in users judge places of a review project: correct, wrong, unreadable (one place at a time); Skip goes on without an answer.

	Usage (any page of the Chunom site or of qatt.org):
		<script src="https://chunom.org/chunom/js/review.js"></script>          (on the Chunom site: /chunom/js/review.js)
		<button onclick="ChunomReview.open({ batch: 10 })">Help</button>
		ChunomReview.open({ project, batch })   project: the id of a project (else one is chosen at random); batch: the number of places after which
		                                        the thanks come (else until "Finish"). The popup closes after the thanks.
		ChunomReview.open({ overview: true })   the list of the projects in the popup
		await ChunomReview.projects()           the active projects (for a page that lists them): [{ id, title_en, title_vi, items, judged, mine, … }]
	A project with show_box off hides the box of the place under a blur (the character is not seen: a reading is judged by itself).

	The data is in the Supabase project ChunomApp (review_projects, review_items, review_votes; the functions review_projects(), review_next(), review_vote();
	private repository qtng/chunom-private). A project with corrections asks for the right value after "wrong"; without one nothing is stored.
	It loads what it needs when first opened: supabase.min.js, supabase.js and login.js of qatt.org, ime.js of the Chunom site (Telex in the field of
	a correction). The texts follow Lang of navigation.js (English, Vietnamese).
*/
(() => {
	'use strict';
	if (window.ChunomReview) return;
	const SCRIPT = document.currentScript && document.currentScript.src || 'https://chunom.org/chunom/js/review.js';
	const SITE = new URL('../../', SCRIPT).href;   // the root of the Chunom site
	const QATT = 'https://qatt.org/';
	const T = (en, vi) => (window.Lang && typeof Lang.t === 'function' ? Lang.t(en, vi) : en);
	const RESUME = 'chunomReviewResume';   // sessionStorage: the options of an open() that had to sign in first (the sign-in reloads the page)

	const STYLE = `
dialog.crv { border: 0; padding: 0; width: min(40rem, 100vw); max-width: 100vw; max-height: 100dvh; border-radius: 1rem; color: var(--ink, CanvasText);
	background: var(--paper, Canvas); box-shadow: 0 1.2rem 3.5rem rgba(0, 0, 0, .35); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; overflow: hidden }
dialog.crv::backdrop { background: rgba(20, 15, 10, .55) }
.crv-in { position: relative; display: flex; flex-direction: column; max-height: calc(100dvh - 2rem) }
/* the progress of a batch, below the head */
.crv-prog { height: .3rem; background: color-mix(in srgb, currentColor 10%, transparent) }
.crv-prog[hidden] { display: none }
.crv-prog i { display: block; height: 100%; width: 0; background: #2f9e44; transition: width .35s ease }
/* the counter jumps at every answer; a "+1" flies up from the button that was pressed */
.crv-count.bump { animation: crv-bump .45s ease }
@keyframes crv-bump { 0% { transform: scale(1) } 35% { transform: scale(1.45); color: #2f9e44 } 100% { transform: scale(1) } }
.crv-plus { position: absolute; z-index: 5; pointer-events: none; font-weight: 800; font-size: 1.3rem; line-height: 1; padding: .3rem .7rem; border-radius: 2rem;
	color: #fff; background: var(--c, #2f9e44); box-shadow: 0 .3rem .8rem rgba(0, 0, 0, .25);
	transform: translate(-50%, -50%); animation: crv-fly .8s ease-out forwards }
@keyframes crv-fly { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.7) } 20% { opacity: 1; transform: translate(-50%, -60%) scale(1.15) } 100% { opacity: 0; transform: translate(-50%, -260%) scale(1) } }
@media (prefers-reduced-motion: reduce) { .crv-plus, .crv-count.bump { animation-duration: .01s } }
.crv-head { display: flex; align-items: center; gap: .6rem; padding: .7rem 1rem; border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent) }
.crv-head h2 { flex: 1; margin: 0; font-weight: 600; font-size: 1rem; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.crv-count { font-size: .85rem; opacity: .7; white-space: nowrap }
.crv-x { border: 0; background: none; color: inherit; font-size: 1.6rem; line-height: 1; padding: 0 .2rem; cursor: pointer; opacity: .7 }
.crv-x:hover { opacity: 1 }
.crv-body { padding: 1rem; overflow-y: auto }
.crv-q { margin: 0 0 .8rem; text-align: center }
.crv-q p { margin: 0; font-size: 1rem; line-height: 1.4; opacity: .85 }
/* the claim large, on a line of its own: easy to read, hard to misread */
.crv-claim { display: block; margin-top: .15rem; font-weight: 600; font-size: 2.1rem; line-height: 1.2; letter-spacing: .01em; color: var(--accent, #a8362a) }
.crv-claim.cjk { font-family: var(--font-cjk, "Pen"), serif; font-weight: 400; font-size: 3rem; line-height: 1.1 }
.crv-win { position: relative; overflow: hidden; margin: 0 auto; max-width: 100%; background: #fff; border-radius: .5rem; box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 15%, transparent) }
.crv-win img, .crv-win .crv-frame { transition: opacity .15s }
.crv-win.veil img, .crv-win.veil .crv-frame { opacity: 0 }   /* the scan is shown half a second after the question and the buttons */
.crv-win img { position: absolute; left: 0; top: 0; max-width: none; pointer-events: none; user-select: none; filter: url(#crv-sharp) contrast(1.35) brightness(1.05) }   /* clearer strokes: a little sharpened, more contrast */
.crv-win .crv-frame { position: absolute; outline: 2px solid var(--accent, #a8362a); outline-offset: 3px; border-radius: 1px; pointer-events: none }
.crv-win .crv-frame.mask { outline: 0; border-radius: .6rem; background: rgba(255, 255, 255, .35); -webkit-backdrop-filter: blur(var(--crv-blur)); backdrop-filter: blur(var(--crv-blur)) }   /* the character hidden under a soft blur (the box and a margin) */
.crv-win .crv-wait { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #777; font-size: .9rem }
.crv-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .5rem; margin-top: 1rem }
.crv-b { border: 1px solid transparent; border-radius: 2rem; padding: .75rem .5rem; font-weight: 600; font-size: 1rem; line-height: 1.2; cursor: pointer; color: #fff; touch-action: manipulation }
.crv-b:disabled { opacity: .5; cursor: default }
.crv-b.wrong { background: #c92a2a } .crv-b.wrong:hover { background: #a61e1e }
.crv-b.ok { background: #2b8a3e } .crv-b.ok:hover { background: #237032 }
.crv-b.unsure, .crv-b.quiet { background: none; color: inherit; border-color: color-mix(in srgb, currentColor 30%, transparent) }
.crv-b.unsure:hover, .crv-b.quiet:hover { background: color-mix(in srgb, currentColor 8%, transparent) }
.crv-b.main { background: var(--accent, #a8362a) }
.crv-b kbd { display: block; font-weight: 400; font-size: .7rem; line-height: 1; opacity: .7; margin-top: .25rem; background: none; color: inherit; padding: 0 }
/* the three verdicts: tinted tiles in their colour, a large sign above the word */
.crv-v { --c: #868e96; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .15rem; min-height: 5rem;
	padding: .6rem .4rem; border-radius: 1rem; border: 2px solid color-mix(in srgb, var(--c) 45%, transparent); background: color-mix(in srgb, var(--c) 10%, transparent);
	color: inherit; font-weight: 600; font-size: .95rem; line-height: 1.2; cursor: pointer; touch-action: manipulation; transition: background .12s, border-color .12s, transform .08s }
.crv-v:hover { background: color-mix(in srgb, var(--c) 18%, transparent); border-color: var(--c) }
.crv-v:active { transform: scale(.97) }
.crv-v:focus-visible { outline: 3px solid color-mix(in srgb, var(--c) 50%, transparent); outline-offset: 2px }
.crv-v:disabled { opacity: .5; cursor: default; transform: none }
.crv-v .sign { font: 700 1.7rem/1 system-ui, sans-serif; color: var(--c) }
.crv-v.wrong { --c: #e03131 } .crv-v.ok { --c: #2f9e44 } .crv-v.unsure { --c: #868e96 }
/* wrong and correct in their full colour, white sign and word; unreadable stays a quiet tile */
.crv-v.wrong, .crv-v.ok { background: var(--c); border-color: var(--c); color: #fff; box-shadow: 0 .25rem .7rem color-mix(in srgb, var(--c) 35%, transparent) }
.crv-v.wrong .sign, .crv-v.ok .sign { color: #fff }
.crv-v.wrong:hover { background: #c92a2a; border-color: #c92a2a } .crv-v.ok:hover { background: #2b8a3e; border-color: #2b8a3e }
.crv-v.wrong kbd, .crv-v.ok kbd { opacity: .75 }
.crv-v kbd { position: absolute; top: .35rem; right: .5rem; font-weight: 400; font-size: .7rem; line-height: 1; opacity: .5; background: none; color: inherit; padding: 0 }
@media not (hover: hover) { .crv-v kbd { display: none } }
.crv-fix { margin-top: 1rem; padding: .8rem; border-radius: .7rem; background: color-mix(in srgb, #c92a2a 8%, transparent) }
.crv-fix label { display: block; font-size: .9rem; margin-bottom: .4rem }
.crv-fix input { width: 100%; box-sizing: border-box; font-size: 1.4rem; padding: .35rem .6rem; border-radius: .5rem; border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
	background: var(--paper, Canvas); color: inherit }
.crv-fix input.cjk { font-family: var(--font-cjk, "Pen"), serif }
.crv-fix .crv-row { display: flex; gap: .5rem; margin-top: .6rem; justify-content: flex-end }
.crv-fix .crv-b { padding: .5rem 1.2rem }
/* Skip: no answer, the next place (smaller, below the three answers) */
.crv-skip { display: block; margin: .6rem auto 0; padding: .3rem 1.1rem; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 2rem; background: none;
	color: inherit; font-size: .88rem; opacity: .8; cursor: pointer }
.crv-skip:hover { opacity: 1; background: color-mix(in srgb, currentColor 6%, transparent) }
.crv-skip kbd { font-size: .7rem; opacity: .6; margin-left: .35rem; background: none; color: inherit; padding: 0 }
@media not (hover: hover) { .crv-skip kbd { display: none } }
.crv-foot { display: flex; justify-content: space-between; align-items: center; gap: .5rem; margin-top: .9rem; font-size: .85rem }
.crv-link { border: 0; background: none; color: inherit; opacity: .75; text-decoration: underline; cursor: pointer; padding: 0; font: inherit }
.crv-link:hover { opacity: 1 }
.crv-msg { color: #c92a2a; font-size: .9rem; min-height: 1.2rem; margin-top: .4rem }
.crv-list { display: grid; gap: .5rem; margin: .6rem 0 0 }
.crv-p { display: flex; align-items: center; gap: .8rem; padding: .7rem .8rem; border-radius: .7rem; border: 1px solid color-mix(in srgb, currentColor 15%, transparent) }
.crv-p .t { flex: 1; min-width: 0 } .crv-p .t b { display: block } .crv-p .t small { opacity: .7 }
.crv-bar { height: .3rem; border-radius: 1rem; margin-top: .35rem; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden }
.crv-bar i { display: block; height: 100%; background: #2b8a3e }
.crv-p .crv-b { padding: .45rem 1rem; font-size: .9rem }
.crv-thanks { text-align: center; padding: .5rem 0 }
.crv-thanks h3 { font: 400 1.7rem Georgia, "Times New Roman", serif; margin: .2rem 0 .6rem }
.crv-thanks .sum { display: flex; justify-content: center; gap: 1.2rem; margin: .8rem 0 1rem; flex-wrap: wrap }
.crv-thanks .sum div { min-width: 4.5rem } .crv-thanks .sum b { display: block; font-size: 1.6rem }
.crv-thanks .crv-row { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center }
.crv-thanks .crv-b { padding: .55rem 1.2rem; font-size: .95rem }
@media (max-width: 575.98px) {
	dialog.crv { width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; margin: 0 }
	.crv-in { max-height: 100dvh; height: 100% }
	.crv-body { padding: .8rem }
	.crv-b { padding: .9rem .3rem }
	.crv-b kbd { display: none }
	.crv-v { min-height: 4.6rem }
	.crv-claim { font-size: 1.9rem } .crv-claim.cjk { font-size: 2.6rem }
}`;

	const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids.filter(k => k != null)); return n; };
	const load = src => new Promise((ok, fail) => {
		if ([...document.scripts].some(s => s.src === src)) { const wait = () => ok(); return setTimeout(wait, 0); }
		document.head.append(el('script', { src, onload: ok, onerror: () => fail(new Error('could not load ' + src)) }));
	});
	const until = async test => { for (let i = 0; i < 200 && !test(); i++) await new Promise(r => setTimeout(r, 25)); return test(); };

	// ---------- Supabase ----------
	let sp = null, ready = null;
	function connect() {
		ready ||= (async () => {
			if (typeof supabase === 'undefined') await load(QATT + 'vendor/supabase/supabase.min.js');
			if (typeof SupabaseService === 'undefined') await load(QATT + 'js/supabase.js');
			if (typeof QattLogin === 'undefined') await load(QATT + 'js/login.js');
			await until(() => typeof supabase !== 'undefined' && typeof SupabaseService !== 'undefined' && typeof QattLogin !== 'undefined');
			sp = new SupabaseService();
			await sp.init();
			return sp;
		})();
		return ready;
	}
	async function rpc(name, args) {
		const { data, error } = await sp.client.rpc(name, args);
		if (error) throw Object.assign(new Error(error.message || String(error)), { code: error.code });
		return data;
	}
	async function projects() { await connect(); return rpc('review_projects', {}); }

	// ---------- the dialog ----------
	let dlg = null, body = null, title = null, count = null, prog = null;
	function dialog() {
		if (dlg) return dlg;
		if (!document.getElementById('crv-style')) document.head.append(el('style', { id: 'crv-style', textContent: STYLE }));
		// the sharpening of the scan (an unsharp mask: the image plus 0.7 times its difference from a blurred copy)
		if (!document.getElementById('crv-sharp')) document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
			'<filter id="crv-sharp" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.5" result="b"/>' +
			'<feComposite in="SourceGraphic" in2="b" operator="arithmetic" k1="0" k2="1.7" k3="-0.7" k4="0"/></filter></svg>');
		title = el('h2'); count = el('span', { className: 'crv-count' });
		const x = el('button', { type: 'button', className: 'crv-x', textContent: '×', ariaLabel: T('Close', 'Đóng'), onclick: () => close() });
		body = el('div', { className: 'crv-body' });
		prog = el('div', { className: 'crv-prog', hidden: true }, el('i'));
		dlg = el('dialog', { className: 'crv' }, el('div', { className: 'crv-in' }, el('div', { className: 'crv-head' }, title, count, x), prog, body));
		dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
		document.body.append(dlg);
		return dlg;
	}
	function close() { if (dlg && dlg.open) dlg.close(); state = null; }
	const head = (t, c = '') => { title.textContent = t; count.textContent = c; if (!state || !state.batch || !state.item) prog.hidden = true; };
	function showProgress() {
		const s = state;
		prog.hidden = !s.batch;
		if (s.batch) prog.firstChild.style.width = `${Math.min(100, s.n / s.batch * 100)}%`;
	}
	const msg = text => el('div', { className: 'crv-msg', role: 'status', textContent: text || '' });

	// ---------- a session ----------
	// state: { project, batch, n, ok, wrong, unsure, item, next, busy, fixing }
	let state = null, list = [];
	const titleOf = p => T(p.title_en, p.title_vi);

	async function open(opts = {}) {
		dialog();
		if (!dlg.open) dlg.showModal();
		head(T('Help check the dictionaries', 'Giúp kiểm tra các từ điển'));
		body.replaceChildren(el('p', { textContent: T('Loading…', 'Đang tải…') }));
		try { await connect(); } catch (e) { body.replaceChildren(msg(T('Could not connect. Please try again later.', 'Không kết nối được. Vui lòng thử lại sau.'))); return; }
		if (!sp.user) { signIn(opts); return; }
		try { list = await rpc('review_projects', {}); } catch (e) { body.replaceChildren(msg(e.message)); return; }
		if (!list.length) { body.replaceChildren(el('p', { textContent: T('There is nothing to check at the moment.', 'Hiện không có gì để kiểm tra.') })); return; }
		if (opts.overview) { overview(); return; }
		let p = list.find(x => x.id === opts.project);
		if (!p) {   // at random, weighted by what is left to judge
			const open_ = list.filter(x => x.mine < x.items);
			const pool = open_.length ? open_ : list;
			let r = Math.random() * pool.reduce((s, x) => s + Math.max(1, x.items - x.judged), 0);
			p = pool.find(x => (r -= Math.max(1, x.items - x.judged)) < 0) || pool[0];
		}
		start(p, opts.batch);
	}

	function signIn(opts) {
		head(T('Help check the dictionaries', 'Giúp kiểm tra các từ điển'));
		const b = el('button', { type: 'button', className: 'crv-b main', textContent: T('Sign in', 'Đăng nhập') });
		b.addEventListener('click', () => {
			try { sessionStorage.setItem(RESUME, JSON.stringify(opts)); } catch {}
			close();
			QattLogin.open(sp, { en: 'Sign in to help check the dictionaries.', vi: 'Đăng nhập để giúp kiểm tra các từ điển.' });
		});
		body.replaceChildren(
			el('p', { textContent: T('You see one place of a scanned dictionary at a time and say whether the computer read it right. Every answer helps. Please sign in first, so that your answers can be counted.',
				'Mỗi lần bạn xem một chỗ trong từ điển đã quét và cho biết máy đọc có đúng không. Mỗi câu trả lời đều có ích. Vui lòng đăng nhập trước để câu trả lời của bạn được tính.') }),
			el('div', { className: 'crv-row', style: 'display:flex;justify-content:center' }, b));
	}

	function overview() {
		head(T('Projects', 'Dự án'));
		const rows = list.map(p => {
			const go = el('button', { type: 'button', className: 'crv-b main', textContent: T('Start', 'Bắt đầu') });
			go.addEventListener('click', () => start(p, state?.batch));
			const pct = p.items ? Math.round(p.judged / p.items * 100) : 0;
			return el('div', { className: 'crv-p' },
				el('div', { className: 't' }, el('b', { textContent: titleOf(p) }),
					el('small', { textContent: `${p.judged.toLocaleString()} / ${p.items.toLocaleString()} ${T('checked', 'đã kiểm tra')}${p.mine ? ` · ${T('by you', 'của bạn')}: ${p.mine}` : ''}` }),
					el('div', { className: 'crv-bar' }, el('i', { style: `width:${pct}%` }))),
				go);
		});
		const any = el('button', { type: 'button', className: 'crv-b quiet', textContent: T('Any project', 'Dự án bất kỳ') });
		any.addEventListener('click', () => open({ batch: state?.batch }));
		body.replaceChildren(el('div', { className: 'crv-list' }, ...rows), el('div', { className: 'crv-foot' }, el('span'), any));
	}

	function start(p, batch) {
		state = { project: p, batch: batch > 0 ? Math.floor(batch) : 0, n: 0, ok: 0, wrong: 0, unsure: 0, item: null, next: null, busy: false, fixing: false };
		nextItem();
	}

	// the page images, loaded in the background (one promise per address: true when loaded, false when it failed)
	const images = new Map();
	function preload(src) {
		if (!images.has(src)) images.set(src, new Promise(ok => { const i = new Image(); i.onload = () => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()).then(() => ok(true)); i.onerror = () => ok(false); i.src = src; }));
		if (images.size > 40) images.delete(images.keys().next().value);
		return images.get(src);
	}

	// the next item (fetched ahead while the current one is shown)
	// the places skipped in this session (per project): not given again while the popup is open
	const skipped = new Map();
	const isSkipped = it => !!it && (skipped.get(state.project.id) || new Set()).has(it.item);
	async function fetchItem(avoid) {
		let it = null;
		for (let i = 0; i < 6; i++) {
			it = await rpc('review_next', { p_project: state.project.id });
			if (!it || (it.item !== avoid && !isSkipped(it))) return it;
		}
		return it && it.item !== avoid ? it : null;   // only skipped places are left: one of them again
	}
	async function nextItem() {
		const s = state;
		if (s.batch && s.n >= s.batch) { thanks(); return; }
		head(titleOf(s.project), progress());
		let it = s.next; s.next = null;
		if (!it || it.item === s.item?.item || isSkipped(it)) {
			body.replaceChildren(el('p', { textContent: T('Loading…', 'Đang tải…') }));
			try { it = await fetchItem(s.item?.item); } catch (e) { body.replaceChildren(msg(e.message)); return; }
		}
		if (state !== s) return;
		if (!it) { thanks(true); return; }
		// the question and the buttons only once the scan is loaded (so that the scan can follow them at a fixed time)
		const slow = setTimeout(() => { if (state === s) body.replaceChildren(el('p', { textContent: T('Loading the scan…', 'Đang tải bản quét…') })); }, 250);
		const loaded = await preload(it.data.image);
		clearTimeout(slow);
		if (state !== s) return;
		s.item = it; s.fixing = false;
		card(loaded);
		fetchItem(it.item).then(n => { if (state === s && s.item === it) { s.next = n; if (n) preload(n.data.image); } }).catch(() => {});
	}
	const progress = () => state.batch ? `${state.n} / ${state.batch}` : (state.n ? String(state.n) : '');

	function windowOf(d, showBox) {
		const win = el('div', { className: 'crv-win' });
		const place = () => {
			const width = (win.parentElement && win.parentElement.clientWidth) || Math.min(innerWidth - 32, 600);
			// with the box shown: only the box and a narrow margin (the headword must not be seen, only the character), enlarged up to a part of the screen height;
			// with the box hidden: the view of the item (the headword and the box painted black)
			const m = (d.box[2] - d.box[0]) * .18;
			const [x0, y0, x1, y1] = showBox === false ? d.view : [d.box[0] - m, d.box[1] - m, d.box[2] + m, d.box[3] + m];
			const s = showBox === false ? Math.min(2.4, width / (x1 - x0)) : Math.min(4, width / (x1 - x0), Math.min(320, innerHeight * .4) / (y1 - y0));
			// the window as wide as the part shown, centred (nothing beside it: with the box shown not even the headword)
			win.style.height = `${Math.round((y1 - y0) * s)}px`;
			win.style.width = `${Math.round((x1 - x0) * s)}px`;
			const left = 0;
			img.style.width = `${d.w * s}px`;
			img.style.transform = `translate(${left - x0 * s}px, ${-y0 * s}px)`;
			// the box hidden: grown by a quarter of its width on every side (a box is often a little off the character), blurred
			const g = showBox === false ? (d.box[2] - d.box[0]) * .25 : 0;
			Object.assign(frame.style, { left: `${left + (d.box[0] - g - x0) * s}px`, top: `${(d.box[1] - g - y0) * s}px`, width: `${(d.box[2] - d.box[0] + 2 * g) * s}px`, height: `${(d.box[3] - d.box[1] + 2 * g) * s}px` });
			frame.style.setProperty('--crv-blur', `${Math.round((d.box[2] - d.box[0]) * s * .18)}px`);
		};
		const img = el('img', { alt: '', draggable: false }), frame = el('div', { className: showBox === false ? 'crv-frame mask' : 'crv-frame' });
		const wait = el('div', { className: 'crv-wait', textContent: T('Loading the scan…', 'Đang tải bản quét…') });
		img.onload = () => wait.remove();
		img.onerror = () => { wait.textContent = T('The scan could not be loaded.', 'Không tải được bản quét.'); };
		img.src = d.image;
		win.classList.add('veil');
		win.reveal = () => win.classList.remove('veil');
		win.append(img, frame, wait);
		requestAnimationFrame(place);
		win.place = place;
		return win;
	}

	function question(p, claim) {
		const q = T(p.question_en, p.question_vi), [a, b] = q.split('{claim}');
		// the sentence with "…" in the place of the claim, the claim itself large below it
		return el('div', { className: 'crv-q' }, el('p', { textContent: a + '…' + (b ?? '') }),
			el('span', { className: `crv-claim${p.claim_kind === 'cjk' ? ' cjk' : ''}`, textContent: claim, lang: p.claim_kind === 'cjk' ? 'zh-Hant' : 'vi' }));
	}

	const REVEAL = 500;   // ms between the question with its buttons and the scan
	function card(loaded) {
		const s = state, p = s.project, d = s.item.data, it = s.item;
		const win = windowOf(d, p.show_box);
		const b = (cls, sign, en, vi, key, v) => {
			const btn = el('button', { type: 'button', className: `crv-v ${cls}` }, el('span', { className: 'sign', textContent: sign, ariaHidden: 'true' }), el('span', { textContent: T(en, vi) }), el('kbd', { textContent: key }));
			btn.addEventListener('click', () => answer(v));
			return btn;
		};
		s.btns = el('div', { className: 'crv-btns' }, b('wrong', '✕', 'Wrong', 'Sai', '←', -1), b('unsure', '?', 'Unreadable', 'Không đọc được', '↓', 0), b('ok', '✓', 'Correct', 'Đúng', '→', 1));
		s.msg = msg();
		const finish = el('button', { type: 'button', className: 'crv-link', textContent: T('Finish', 'Kết thúc') });
		finish.addEventListener('click', () => thanks());
		const projects_ = el('button', { type: 'button', className: 'crv-link', textContent: T('Other projects', 'Dự án khác') });
		projects_.addEventListener('click', () => overview());
		const skip = el('button', { type: 'button', className: 'crv-skip' }, T('Skip', 'Bỏ qua'), el('kbd', { textContent: 'S' }));
		skip.addEventListener('click', () => skipItem());
		body.replaceChildren(question(p, d.claim), win, s.btns, skip, s.msg, el('div', { className: 'crv-foot' }, projects_, finish));
		s.win = win;
		showProgress();
		// the times of the answer: from the moment the scan is shown (negative: answered before it was there; null: the scan could not be loaded)
		s.cardAt = performance.now(); s.shownAt = null; s.clickAt = null;
		setTimeout(() => { if (state === s && s.item === it) { win.reveal(); if (loaded) s.shownAt = performance.now(); } }, REVEAL);
	}

	async function answer(v, correction) {
		const s = state;
		if (!s || s.busy || !s.item) return;
		if (correction == null) s.clickAt = performance.now();   // a correction keeps the time of its click on "wrong"
		if (v === -1 && s.project.correction && correction == null) { askFix(); return; }
		const at = s.clickAt ?? performance.now();
		const ms = s.shownAt != null && at >= s.shownAt ? Math.round(at - s.shownAt) : s.shownAt == null && s.item && at - s.cardAt < REVEAL ? -Math.max(1, Math.round(REVEAL - (at - s.cardAt))) : null;
		s.busy = true;
		fly(v);
		s.btns.querySelectorAll('button').forEach(b => b.disabled = true);
		try {
			const r = await rpc('review_vote', { p_project: s.project.id, p_item: s.item.item, p_verdict: v, p_correction: correction ?? null, p_ms: ms });
			s.project.mine = r.mine;
		} catch (e) {
			s.busy = false;
			s.btns.querySelectorAll('button').forEach(b => b.disabled = false);
			s.msg.textContent = T('Not saved: ', 'Chưa lưu: ') + (e.code === '42501' ? T('please sign in again.', 'vui lòng đăng nhập lại.') : e.message);
			return;
		}
		s.busy = false;
		s.n++; s[v === 1 ? 'ok' : v === -1 ? 'wrong' : 'unsure']++;
		count.textContent = progress(); count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
		showProgress();
		nextItem();
	}

	// a "+1" that flies up from the button of the answer (in its colour)
	function fly(v) {
		const s = state, btn = s && s.btns && s.btns.querySelector(v === 1 ? '.ok' : v === -1 ? '.wrong' : '.unsure');
		if (!btn || !dlg || !btn.offsetParent) return;   // hidden while a correction is typed
		const box = dlg.firstChild.getBoundingClientRect(), r = btn.getBoundingClientRect();
		const plus = el('span', { className: 'crv-plus', textContent: '+1', ariaHidden: 'true' });
		plus.style.left = `${r.left + r.width / 2 - box.left}px`; plus.style.top = `${r.top - box.top}px`;   // from the top edge of the button
		plus.style.setProperty('--c', v === 1 ? '#2f9e44' : v === -1 ? '#e03131' : '#868e96');
		dlg.firstChild.append(plus);
		setTimeout(() => plus.remove(), 900);
	}

	// "wrong" in a project with corrections: the right value; nothing is stored without it
	function askFix() {
		const s = state, p = s.project;
		if (s.fixing) return;
		s.fixing = true;
		const cjk = p.claim_kind === 'cjk';
		const input = el('input', { type: 'text', className: cjk ? 'cjk' : '', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', maxLength: 100, lang: cjk ? '' : 'vi' });
		const save = el('button', { type: 'button', className: 'crv-b wrong', textContent: T('Save', 'Lưu'), disabled: true });
		const cancel = el('button', { type: 'button', className: 'crv-b quiet', textContent: T('Cancel', 'Hủy') });
		const box = el('div', { className: 'crv-fix' },
			el('label', { textContent: cjk ? T('What is the right character?', 'Chữ đúng là chữ nào?') : T('How is the headword written? (Telex: aa → â, ow → ơ, s → sắc)', 'Đầu mục viết thế nào? (Telex: aa → â, ow → ơ, s → sắc)') }),
			input, el('div', { className: 'crv-row' }, cancel, save));
		input.addEventListener('input', () => { save.disabled = !input.value.trim(); });
		input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.value.trim() && !document.querySelector('.vietime:not([hidden])')) { e.preventDefault(); save.click(); } e.stopPropagation(); });
		save.addEventListener('click', () => { const v = input.value.trim(); if (v) answer(-1, cjk ? v : v.toLowerCase()); });
		cancel.addEventListener('click', () => { box.remove(); s.fixing = false; s.btns.hidden = false; });
		s.btns.hidden = true;
		s.btns.after(box);
		input.focus();
		// Telex (and, for a character, the candidates) of ime.js of the Chunom site
		(window.VietIme ? Promise.resolve() : load(SITE + 'chunom/js/ime.js')).then(() => until(() => window.VietIme))
			.then(ok => { if (ok && input.isConnected) new VietIme(input, { candidates: cjk, defer: true }); }).catch(() => {});
	}

	function thanks(empty) {
		const s = state;
		if (!s) { close(); return; }
		head(titleOf(s.project));
		const n = (v, en, vi) => el('div', {}, el('b', { textContent: v }), T(en, vi));
		const more = el('button', { type: 'button', className: 'crv-b main', textContent: T('Continue', 'Tiếp tục') });
		more.addEventListener('click', () => start(s.project, s.batch));
		const other = el('button', { type: 'button', className: 'crv-b quiet', textContent: T('Other projects', 'Dự án khác') });
		other.addEventListener('click', () => overview());
		const done = el('button', { type: 'button', className: 'crv-b quiet', textContent: T('Close', 'Đóng') });
		done.addEventListener('click', () => close());
		body.replaceChildren(el('div', { className: 'crv-thanks' },
			el('h3', { textContent: T('Thank you!', 'Cảm ơn bạn!') }),
			el('p', { textContent: empty ? T('You have checked every place of this project.', 'Bạn đã kiểm tra mọi chỗ của dự án này.')
				: s.n ? T('Your answers are saved. See you next time!', 'Câu trả lời của bạn đã được lưu. Hẹn gặp lại lần sau!') : T('See you next time!', 'Hẹn gặp lại lần sau!') }),
			s.n ? el('div', { className: 'sum' }, n(s.n, 'this time', 'lần này'), n(s.ok, 'correct', 'đúng'), n(s.wrong, 'wrong', 'sai'), n(s.unsure, 'unreadable', 'không đọc được'),
				n(s.project.mine, 'in all', 'tổng cộng')) : null,
			el('div', { className: 'crv-row' }, empty ? null : more, other, done)));
		s.item = null; s.next = null;
	}

	// Skip: no answer; the place is not given again in this session
	function skipItem() {
		const s = state;
		if (!s || !s.item || s.busy) return;
		const id = s.project.id;
		if (!skipped.has(id)) skipped.set(id, new Set());
		skipped.get(id).add(s.item.item);
		nextItem();
	}

	function onKey(e) {
		const s = state;
		if (!s || !s.item || s.fixing || s.busy || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
		if (e.key === 's' || e.key === 'S') { e.preventDefault(); skipItem(); return; }
		const v = { ArrowLeft: -1, ArrowDown: 0, ArrowRight: 1 }[e.key];
		if (v === undefined) return;
		e.preventDefault();
		answer(v);
	}
	document.addEventListener('keydown', e => { if (dlg && dlg.open) onKey(e); });
	addEventListener('resize', () => { if (state && state.win && state.win.isConnected) state.win.place(); });

	window.ChunomReview = { open, projects };

	// back from the sign-in (the page was reloaded): open again with the same options
	let resume = null;
	try { resume = JSON.parse(sessionStorage.getItem(RESUME) || 'null'); sessionStorage.removeItem(RESUME); } catch {}
	if (resume) {
		const go = () => connect().then(s => { if (s.user) open(resume); }).catch(() => {});
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
	}
})();
