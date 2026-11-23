/*
	ChunomReview – the popup in which signed-in users judge places of a review project: correct, wrong, don't know (one place at a time).

	Usage (any page of the Chunom site or of qatt.org):
		<script src="https://chunom.org/chunom/js/review.js"></script>          (on the Chunom site: /chunom/js/review.js)
		<button onclick="ChunomReview.open({ batch: 10 })">Help</button>
		ChunomReview.open({ project, batch })   project: the id of a project (else one is chosen at random); batch: the number of places after which
		                                        the thanks come (else until "Finish"). The popup closes after the thanks.
		ChunomReview.open({ overview: true })   the list of the projects in the popup
		await ChunomReview.projects()           the active projects (for a page that lists them): [{ id, title_en, title_vi, items, judged, mine, … }]

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
.crv-in { display: flex; flex-direction: column; max-height: calc(100dvh - 2rem) }
.crv-head { display: flex; align-items: center; gap: .6rem; padding: .7rem 1rem; border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent) }
.crv-head h2 { flex: 1; margin: 0; font: 600 1rem/1.3 inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.crv-count { font-size: .85rem; opacity: .7; white-space: nowrap }
.crv-x { border: 0; background: none; color: inherit; font-size: 1.6rem; line-height: 1; padding: 0 .2rem; cursor: pointer; opacity: .7 }
.crv-x:hover { opacity: 1 }
.crv-body { padding: 1rem; overflow-y: auto }
.crv-q { margin: 0 0 .7rem; font-size: 1.05rem; line-height: 1.4 }
.crv-claim { font-weight: 700; color: var(--accent, #a8362a) }
.crv-claim.cjk { font-family: var(--font-cjk, "Pen"), serif; font-weight: 400; font-size: 1.8em; vertical-align: -.15em }
.crv-win { position: relative; overflow: hidden; background: #fff; border-radius: .5rem; box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 15%, transparent) }
.crv-win img { position: absolute; left: 0; top: 0; max-width: none; pointer-events: none; user-select: none }
.crv-win .crv-frame { position: absolute; outline: 2px solid var(--accent, #a8362a); outline-offset: 3px; border-radius: 1px; pointer-events: none }
.crv-win .crv-wait { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #777; font-size: .9rem }
.crv-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .5rem; margin-top: 1rem }
.crv-b { border: 1px solid transparent; border-radius: 2rem; padding: .75rem .5rem; font: 600 1rem/1.2 inherit; cursor: pointer; color: #fff; touch-action: manipulation }
.crv-b:disabled { opacity: .5; cursor: default }
.crv-b.wrong { background: #c92a2a } .crv-b.wrong:hover { background: #a61e1e }
.crv-b.ok { background: #2b8a3e } .crv-b.ok:hover { background: #237032 }
.crv-b.unsure, .crv-b.quiet { background: none; color: inherit; border-color: color-mix(in srgb, currentColor 30%, transparent) }
.crv-b.unsure:hover, .crv-b.quiet:hover { background: color-mix(in srgb, currentColor 8%, transparent) }
.crv-b.main { background: var(--accent, #a8362a) }
.crv-b kbd { display: block; font: 400 .7rem/1 inherit; opacity: .7; margin-top: .25rem; background: none; color: inherit; padding: 0 }
.crv-fix { margin-top: 1rem; padding: .8rem; border-radius: .7rem; background: color-mix(in srgb, #c92a2a 8%, transparent) }
.crv-fix label { display: block; font-size: .9rem; margin-bottom: .4rem }
.crv-fix input { width: 100%; box-sizing: border-box; font-size: 1.4rem; padding: .35rem .6rem; border-radius: .5rem; border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
	background: var(--paper, Canvas); color: inherit }
.crv-fix input.cjk { font-family: var(--font-cjk, "Pen"), serif }
.crv-fix .crv-row { display: flex; gap: .5rem; margin-top: .6rem; justify-content: flex-end }
.crv-fix .crv-b { padding: .5rem 1.2rem }
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
	let dlg = null, body = null, title = null, count = null;
	function dialog() {
		if (dlg) return dlg;
		if (!document.getElementById('crv-style')) document.head.append(el('style', { id: 'crv-style', textContent: STYLE }));
		title = el('h2'); count = el('span', { className: 'crv-count' });
		const x = el('button', { type: 'button', className: 'crv-x', textContent: '×', ariaLabel: T('Close', 'Đóng'), onclick: () => close() });
		body = el('div', { className: 'crv-body' });
		dlg = el('dialog', { className: 'crv' }, el('div', { className: 'crv-in' }, el('div', { className: 'crv-head' }, title, count, x), body));
		dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
		document.body.append(dlg);
		return dlg;
	}
	function close() { if (dlg && dlg.open) dlg.close(); state = null; }
	const head = (t, c = '') => { title.textContent = t; count.textContent = c; };
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

	// the next item (fetched ahead while the current one is shown)
	async function fetchItem(avoid) {
		for (let i = 0; i < 3; i++) {
			const it = await rpc('review_next', { p_project: state.project.id });
			if (!it || it.item !== avoid) return it;
		}
		return null;
	}
	async function nextItem() {
		const s = state;
		if (s.batch && s.n >= s.batch) { thanks(); return; }
		head(titleOf(s.project), progress());
		let it = s.next; s.next = null;
		if (!it || it.item === s.item?.item) {
			body.replaceChildren(el('p', { textContent: T('Loading…', 'Đang tải…') }));
			try { it = await fetchItem(s.item?.item); } catch (e) { body.replaceChildren(msg(e.message)); return; }
		}
		if (state !== s) return;
		if (!it) { thanks(true); return; }
		s.item = it; s.fixing = false;
		card();
		fetchItem(it.item).then(n => { if (state === s && s.item === it) { s.next = n; if (n) new Image().src = n.data.image; } }).catch(() => {});
	}
	const progress = () => state.batch ? `${Math.min(state.n + 1, state.batch)} / ${state.batch}` : (state.n ? `${state.n} ✓` : '');

	function windowOf(d) {
		const win = el('div', { className: 'crv-win' });
		const place = () => {
			const width = win.clientWidth || Math.min(innerWidth - 32, 600);
			const [x0, y0, x1, y1] = d.view, s = Math.min(2.4, width / (x1 - x0));
			win.style.height = `${Math.round((y1 - y0) * s)}px`;
			const left = (width - (x1 - x0) * s) / 2;
			img.style.width = `${d.w * s}px`;
			img.style.transform = `translate(${left - x0 * s}px, ${-y0 * s}px)`;
			Object.assign(frame.style, { left: `${left + (d.box[0] - x0) * s}px`, top: `${(d.box[1] - y0) * s}px`, width: `${(d.box[2] - d.box[0]) * s}px`, height: `${(d.box[3] - d.box[1]) * s}px` });
		};
		const img = el('img', { alt: '', draggable: false }), frame = el('div', { className: 'crv-frame' });
		const wait = el('div', { className: 'crv-wait', textContent: T('Loading the scan…', 'Đang tải bản quét…') });
		img.onload = () => wait.remove();
		img.onerror = () => { wait.textContent = T('The scan could not be loaded.', 'Không tải được bản quét.'); };
		img.src = d.image;
		win.append(img, frame, wait);
		requestAnimationFrame(place);
		win.place = place;
		return win;
	}

	function question(p, claim) {
		const q = T(p.question_en, p.question_vi), [a, b] = q.split('{claim}');
		return el('p', { className: 'crv-q' }, a, el('span', { className: `crv-claim${p.claim_kind === 'cjk' ? ' cjk' : ''}`, textContent: claim }), b ?? '');
	}

	function card() {
		const s = state, p = s.project, d = s.item.data;
		const win = windowOf(d);
		const b = (cls, en, vi, key, v) => {
			const btn = el('button', { type: 'button', className: `crv-b ${cls}` }, T(en, vi), el('kbd', { textContent: key }));
			btn.addEventListener('click', () => answer(v));
			return btn;
		};
		s.btns = el('div', { className: 'crv-btns' }, b('wrong', 'Wrong', 'Sai', '←', -1), b('unsure', "Don't know", 'Không biết', '↓', 0), b('ok', 'Correct', 'Đúng', '→', 1));
		s.msg = msg();
		const finish = el('button', { type: 'button', className: 'crv-link', textContent: T('Finish', 'Kết thúc') });
		finish.addEventListener('click', () => thanks());
		const projects_ = el('button', { type: 'button', className: 'crv-link', textContent: T('Other projects', 'Dự án khác') });
		projects_.addEventListener('click', () => overview());
		body.replaceChildren(question(p, d.claim), win, s.btns, s.msg, el('div', { className: 'crv-foot' }, projects_, finish));
		s.win = win;
	}

	async function answer(v, correction) {
		const s = state;
		if (!s || s.busy || !s.item) return;
		if (v === -1 && s.project.correction && correction == null) { askFix(); return; }
		s.busy = true;
		s.btns.querySelectorAll('button').forEach(b => b.disabled = true);
		try {
			const r = await rpc('review_vote', { p_project: s.project.id, p_item: s.item.item, p_verdict: v, p_correction: correction ?? null });
			s.project.mine = r.mine;
		} catch (e) {
			s.busy = false;
			s.btns.querySelectorAll('button').forEach(b => b.disabled = false);
			s.msg.textContent = T('Not saved: ', 'Chưa lưu: ') + (e.code === '42501' ? T('please sign in again.', 'vui lòng đăng nhập lại.') : e.message);
			return;
		}
		s.busy = false;
		s.n++; s[v === 1 ? 'ok' : v === -1 ? 'wrong' : 'unsure']++;
		nextItem();
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
			s.n ? el('div', { className: 'sum' }, n(s.n, 'this time', 'lần này'), n(s.ok, 'correct', 'đúng'), n(s.wrong, 'wrong', 'sai'), n(s.unsure, "don't know", 'không biết'),
				n(s.project.mine, 'in all', 'tổng cộng')) : null,
			el('div', { className: 'crv-row' }, empty ? null : more, other, done)));
		s.item = null; s.next = null;
	}

	function onKey(e) {
		const s = state;
		if (!s || !s.item || s.fixing || s.busy || e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
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
