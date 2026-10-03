/*
	VietIme – Telex input and Chữ Nôm candidates for text fields, no dependencies.

	Usage:
		<script src="https://qatt.org/chunom/js/ime.js"></script>
		const ime = new VietIme(document.querySelector('input'), { defer: true });

	Options:
		telex [true]           Telex input; 'compound' only converts tones and đ (no aa, ee, oo, w)
		candidates [true]      Chữ Nôm candidate list for the word before the caret
		defer [false]          true: load dictionaries on first focus; 'wait': also read-only while loading
		dictionaries           JSON dictionaries ({dict: "|reading:glyph,glyph|…", defs: {readingGlyph: definition}})
		fontList [[]]          fonts for Nôm glyphs, also applied to the field while candidates are on
		returnSelect [false]   Enter selects the first candidate
		spaceSelect [false]    Space selects the first candidate
		showDefinitions [true]

	Keys: 1–9, 0 select a candidate, ↑/↓ move, Enter selects the marked one, PageUp/PageDown page, Esc closes.
	Every change to the field fires a regular input event and can be undone.

	Methods:
		ime.update({ telex: false, candidates: false })
		VietIme.load()               loads the default dictionaries, returns a promise
		VietIme.lookup('chữ nôm')    [{glyph, reading, definition}], exact matches first
		VietIme.lookupGlyph('越')    entries whose glyphs contain the characters
		VietIme.telex('vieetj')      'việt'

	Styling via CSS variables on .vietime: --vietime-bg, --vietime-color, --vietime-border,
	--vietime-grid, --vietime-active, --vietime-remainder

	The Telex engine is ported from VietUni.
*/
(() => {
	'use strict';

	// ---------- Telex engine (VietUni) ----------

	// 12 vowels (a â ă e ê i o ô ơ u ư y), lower and upper case, in 6 tone sets
	// (none, sắc, huyền, nặng, hỏi, ngã), then d đ D Đ. Index 0 is unused.
	const VIET_CODES = [0].concat([
		97, 226, 259, 101, 234, 105, 111, 244, 417, 117, 432, 121, 65, 194, 258, 69, 202, 73, 79, 212, 416, 85, 431, 89,
		225, 7845, 7855, 233, 7871, 237, 243, 7889, 7899, 250, 7913, 253, 193, 7844, 7854, 201, 7870, 205, 211, 7888, 7898, 218, 7912, 221,
		224, 7847, 7857, 232, 7873, 236, 242, 7891, 7901, 249, 7915, 7923, 192, 7846, 7856, 200, 7872, 204, 210, 7890, 7900, 217, 7914, 7922,
		7841, 7853, 7863, 7865, 7879, 7883, 7885, 7897, 7907, 7909, 7921, 7925, 7840, 7852, 7862, 7864, 7878, 7882, 7884, 7896, 7906, 7908, 7920, 7924,
		7843, 7849, 7859, 7867, 7875, 7881, 7887, 7893, 7903, 7911, 7917, 7927, 7842, 7848, 7858, 7866, 7874, 7880, 7886, 7892, 7902, 7910, 7916, 7926,
		227, 7851, 7861, 7869, 7877, 297, 245, 7895, 7905, 361, 7919, 7929, 195, 7850, 7860, 7868, 7876, 296, 213, 7894, 7904, 360, 7918, 7928,
		100, 273, 68, 272
	]);
	const LAST_VOWEL = 144, LENGTH = 149;
	const vietChar = i => VIET_CODES[i] ? String.fromCharCode(VIET_CODES[i]) : null;
	const VIET_LETTERS = new Set(VIET_CODES.slice(1).map(c => String.fromCharCode(c)));

	const MODES = {
		telex: { keys: 'sfjrxzaeowd', actions: [1, 2, 3, 4, 5, 6, 9, 10, 11, 8, 15] },
		compound: { keys: 'sfjrxzd', actions: [1, 2, 3, 4, 5, 6, 15] }
	};
	const LOOKBACK = 30;
	// [typ, from, to] vowel changes: â ă ê ô ơ ư đ
	const VMAP = [[7, 7, 7, 8, 8, 8, 9, 10, 11, 15], [0, 3, 6, 0, 6, 9, 0, 3, 6, 0], [1, 4, 7, 2, 8, 10, 1, 4, 7, 1]];

	function isVowel(chr) {
		let i = LAST_VOWEL;
		while (chr != vietChar(i) && i) i--;
		return i;
	}

	function isVD(chr) {
		let i = LAST_VOWEL;
		while (chr != vietChar(i) && i < LENGTH) i++;
		return i < LENGTH ? i : 0;
	}

	// base vowel 0–11 (case and tone removed), -1 for other characters
	const base = i => (i - 1) % 12;

	function vowelPair(c1, c2, pairs) {
		if (!c1 || !c2) return 0;
		const i1 = isVowel(c1), i2 = isVowel(c2);
		return pairs.some(([a, b]) => base(i1) == a && base(i2) == b) ? [i1, i2] : 0;
	}
	const isAyhAuhUuhUahUihOih = (c1, c2) => vowelPair(c1, c2, [[0, 9], [0, 11], [9, 9], [9, 0], [9, 5], [6, 5]]);
	const isAeEiOu = (c1, c2) => vowelPair(c1, c2, [[0, 3], [3, 5], [6, 9]]);
	const isUO = (c1, c2) => vowelPair(c1, c2, [[9, 6], [9, 7], [9, 8], [10, 6], [10, 7], [10, 8]]);

	// tone: [changed, new char, keep key]
	function getDau(ind, typ) {
		const accented = ind >= 25, indI = (ind - 1) % 24 + 1;
		if (typ == 6 && !accented) return [0];
		let newInd = (typ == 6 ? 0 : typ) * 24 + indI;
		if (newInd == ind) newInd = indI;
		return [1, vietChar(newInd), newInd > 24 || typ == 6];
	}

	// â ă ê ô ơ ư đ, also uô / ươ: [changed, new chars, keep key]
	function getAEOWD(ind, typ, isuo) {
		const i1 = isuo ? ind[0] : ind;
		const vc1 = typ == 15 ? (i1 - 1) % 2 : (i1 - 1) % 12;
		if (isuo) {
			const b = ind[1] - (ind[1] - 1) % 12;
			let c = 0;
			if (typ == 7 || typ == 11) c = vietChar(i1 - vc1 + 9) + vietChar(b + 7);
			else if (typ == 8) c = vietChar(i1 - vc1 + 10) + vietChar(b + 8);
			return [c != 0, c, 1];
		}
		let shif = 0, del;
		for (let i = 0; shif == 0 && i < VMAP[0].length; i++) {
			if (VMAP[0][i] != typ) continue;
			if (VMAP[1][i] == vc1) shif = VMAP[2][i] - vc1;
			else if (VMAP[2][i] == vc1) shif = VMAP[1][i] - vc1;
		}
		if (shif == 0) {
			if (typ == 7 && (vc1 == 2 || vc1 == 8)) shif = -1;
			else if ((typ == 9 && vc1 == 2) || (typ == 11 && vc1 == 8)) shif = -1;
			else if (typ == 8 && (vc1 == 1 || vc1 == 7)) shif = 1;
			del = 1;
		} else {
			del = shif > 0;
		}
		return [shif != 0, vietChar(i1 + shif), del];
	}

	// position of the vowel the key changes: [vowel index, position, length, uo pair]
	function findCharToChange(value, typ) {
		const last = [0, 1, 2, 3, 4].map(k => value.charAt(value.length - k - 1));
		let i = 0, c = last[0], chr = 0;
		if (c == '\\') return [c, value.length - 1, 1];

		if (typ == 15) {
			if (!(chr = isVD(c))) return null;
		} else {
			while ('cghmnptCGHMNPT'.indexOf(c) >= 0) {
				if (c < 'A' || i >= 3 || !(c = last[++i])) return null;
			}
		}
		c = last[0].toLowerCase();
		const pc = last[1].toLowerCase(), ppc = last[2].toLowerCase(), pppc = last[3].toLowerCase();

		if (i > 0 && typ > 8) return null;
		if (i > 0) {
			if (c == 'h' && isUO(pppc, ppc)) {
				i += 1;
			} else if (c == 'h' && isAyhAuhUuhUahUihOih(ppc, pc)) {
				i += 1;
				chr = isVowel(ppc);
			} else if (isAeEiOu(ppc, pc)) {
				i += 1;
				chr = isVowel(ppc);
			}
		} else if (typ != 15) {
			if (isAeEiOu(ppc, pc)) {
				i += 2;
				chr = isVowel(ppc);
			} else if (isAeEiOu(pc, c)) {
				i++;
			} else {
				chr = isVowel(last[1]);
				if (chr && 'uyoia'.indexOf(c) >= 0 && !isUO(pc, c) && !((pc == 'o' && c == 'a') || (pc == 'u' && c == 'y'))
					&& !((ppc == 'q' && pc == 'u') || (ppc == 'g' && pc == 'i'))) i++;
			}
			if (c == 'a' && (typ == 9 || typ == 7)) i = 0;
		}
		c = last[i];
		if ((i == 0 || chr == 0) && typ != 15) chr = isVowel(c);
		if (!chr) return null;

		let len = 1, isuo = 0;
		if (i > 0 && (typ == 7 || typ == 8 || typ == 11)) {
			if (i + 1 >= last.length) return null; // VietUni read past its 5-char window here and ignored the key
			isuo = isUO(last[i + 1], c);
			if (isuo) {
				chr = isuo;
				len++;
				i++;
				isuo = 1;
			}
		}
		return [chr, value.length - i - 1, len, isuo];
	}

	// Applies one key to the text before the caret; returns the new text or null if the key is typed as is.
	function telexKey(value, key, mode = MODES.telex) {
		if (key.length != 1 || key.charCodeAt(0) < 49 || !value || /\s$/.test(value)) return null;
		let changed = 0;
		const action = mode.actions[mode.keys.indexOf(key.toLowerCase())];
		if (action) {
			const info = findCharToChange(value, action);
			if (info && info[0]) {
				const t = info[0] == '\\' ? [1, key, 1] : action > 6 ? getAEOWD(info[0], action, info[3]) : getDau(info[0], action);
				if ((changed = t[0])) value = value.substr(0, info[1]) + t[1] + value.substr(info[1] + info[2]) + (t[2] ? '' : key);
			}
		}
		// "gn" after a Vietnamese vowel becomes "ng"
		const val = 'nNcC'.indexOf(key) >= 0 ? value + key : value;
		const er = /[^\x01-\x7f](gn)$/i.exec(val);
		if (er) return val.substr(0, val.length - 2) + er[1].charAt(1) + er[1].charAt(0);
		return changed ? value : null;
	}

	// Converts a whole word typed in Telex, e.g. "nguwowif" → "người"
	function telexWord(raw, mode) {
		let out = '';
		for (const ch of raw) out = telexKey(out, ch, mode) ?? out + ch;
		return out;
	}

	// ---------- Dictionaries ----------

	const DICTIONARIES = ['https://qatt.org/chunom/js/generated_chars.json', 'https://qatt.org/chunom/js/base_chars.json'];
	// typed punctuation → ideographic forms, plus a few symbols
	const BUILTIN = "|-_ideographicHyphen:－|&_ideographicAmpersand:＆|\"_ideographicQuoteEnd:」|\"_ideographicQuoteStart:「|\"_ideographicDoubleQuote:＂|<_ideographicBracket:〈|>_ideographicBracket:〉|<_ideographicBracket:《|>_ideographicBracket:》|[_ideographicBracket:【|]_ideographicBracket:】|(_ideographicBracket:（|)_ideographicBracket:）|__ideographicSpace:　|._ideographicDot:。|,_ideographicList:、|?_ideographicQuestionMark:？|!_ideographicExclamationMark:！|=_unknownCharacterSymbol:〓|;_ideographicSemicolon:；|*_ideographicAsterisk:＊|/_ideographicSlash:／|:_ideographicColon:：|__backslash:\\|__iterationMark:ヌ,ㇶ,〻,ゝ,々|__unknownSymbol:〓|__nhayMark:𡿨|\\_plus:+|\\_iterationMark:ヌ,ㇶ,〻,ゝ,々|\\_unknownSymbol:〓|\\_nhayMark:𡿨|\\_idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲|__idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲|%_idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲|idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲|nháy:𡿨,口,亇,厶|nhayMark:𡿨,口,亇,厶|geta:〓|iteration:ヌ,ㇶ,〻,ゝ,々|nôm:喃";

	// "chữNôm" → "chữ nôm"
	const readingOf = key => key.replace(/(\p{Lu})/gu, ' $1').trim().toLowerCase();
	const isLetter = ch => /[a-zA-Z0-9]/.test(ch) || VIET_LETTERS.has(ch);

	class Dictionary {
		constructor(urls) {
			this.urls = urls;
			this.entries = new Map(); // lower-case reading → [[reading, glyph], …]
			this.byChar = new Map();  // character → [[reading, glyph], …]
			this.defs = new Map();    // reading + glyph → definition
			this.pairs = new Set();
			this.keys = null;         // sorted readings, built on demand
			this.add(BUILTIN);
		}

		// Loads the JSON dictionaries once; failures are logged and skipped
		load() {
			return this.ready ??= Promise.all(this.urls.map(url => fetch(url)
				.then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${url}`)))
				.catch(e => console.warn('VietIme: dictionary not loaded', e))))
				.then(data => {
					for (const d of data) if (d) this.add(d.dict || '', d.defs);
					return this;
				});
		}

		add(dict, defs = {}) {
			for (const entry of dict.replace(/[\r\n]/g, '').split('|')) {
				const sep = entry.indexOf(':', 1);
				if (sep < 0) continue;
				const key = entry.slice(0, sep), lc = key.toLowerCase();
				for (const glyph of entry.slice(sep + 1).split(',')) {
					if (!glyph || this.pairs.has(key + ':' + glyph)) continue;
					this.pairs.add(key + ':' + glyph);
					if (!this.entries.has(lc)) this.entries.set(lc, []);
					this.entries.get(lc).push([key, glyph]);
					for (const ch of new Set(glyph)) {
						if (!this.byChar.has(ch)) this.byChar.set(ch, []);
						this.byChar.get(ch).push([key, glyph]);
					}
				}
			}
			for (const [k, v] of Object.entries(defs)) this.defs.set(k, v);
			this.keys = null;
		}

		// Entries whose reading starts with the (lower-case) prefix: short remainders first, then used and defined ones
		candidates(prefix) {
			const keys = this.keys ??= [...this.entries.keys()].sort();
			let lo = 0, hi = keys.length;
			while (lo < hi) {
				const mid = (lo + hi) >> 1;
				if (keys[mid] < prefix) lo = mid + 1; else hi = mid;
			}
			const list = [], seen = new Set(), usage = getUsage();
			for (let i = lo; i < keys.length && keys[i].startsWith(prefix); i++) {
				for (const [key, glyph] of this.entries.get(keys[i])) {
					if (seen.has(glyph)) continue;
					seen.add(glyph);
					const definition = this.defs.get(key + glyph) || '';
					const used = usage[glyph] || 0;
					list.push({ glyph, key, head: key.slice(0, prefix.length), remainder: key.slice(prefix.length), definition,
						score: definition ? (used + 1) * 2 : used, order: list.length });
				}
			}
			return list.sort((a, b) => a.remainder.length - b.remainder.length || b.score - a.score || a.order - b.order).slice(0, 100);
		}

		lookup(word) {
			word = (word || '').toLowerCase().replace(/[\s\-']/g, '');
			if (!word) return [];
			return this.candidates(word).map(c => ({ glyph: c.glyph, reading: readingOf(c.key), definition: c.definition.trim() }));
		}

		lookupGlyph(text) {
			if (!text) return [];
			return (this.byChar.get(String.fromCodePoint(text.codePointAt(0))) || [])
				// skip symbol entries such as "-_ideographicHyphen"
				.filter(([key, glyph]) => glyph.includes(text) && isLetter(key[0]))
				.map(([key, glyph]) => ({ glyph, reading: readingOf(key), definition: (this.defs.get(key + glyph) || '').trim() }));
		}
	}

	const dictionaries = new Map();
	function dictionaryFor(urls) {
		const id = urls.join(' ');
		if (!dictionaries.has(id)) dictionaries.set(id, new Dictionary(urls));
		return dictionaries.get(id);
	}

	// Selection counts, one localStorage key
	const USAGE_KEY = 'vietime-usage';
	let usage = null;
	function getUsage() {
		if (!usage) {
			try { usage = JSON.parse(localStorage.getItem(USAGE_KEY)) || {}; } catch { usage = {}; }
		}
		return usage;
	}
	function countUsage(glyph) {
		const u = getUsage();
		u[glyph] = (u[glyph] || 0) + 1;
		try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch { /* storage unavailable */ }
	}

	// ---------- Input field ----------

	const PUNCTUATION = ' \\`^°-_.,:;?!/+*#=<>(){}[]\'"&~%|';
	const DEFAULT_FONTS = ['sans-serif', 'han-nom gothic', 'han-nom gothic supplement', 'Heiti TC', 'Heiti SC', 'nom na tong',
		'nom na tong supplement', 'hanaminb', 'hanamina', 'MingLiU-ExtB', 'PMingLiU-ExtB', 'SimSun-ExtB'];
	const fontFamily = list => list.map(f => /^(serif|sans-serif|monospace|system-ui)$/.test(f) ? f : `"${f}"`).join(', ');
	const TYPING_ATTRIBUTES = { autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' };

	const STYLE = `
.vietime { position: absolute; z-index: 1070; min-width: 14em; max-width: 28em; font-family: sans-serif;
	background: var(--vietime-bg, #eee); color: var(--vietime-color, #000); border: var(--vietime-border, 2px solid #000) }
.vietime[hidden] { display: none }
.vietime-option { display: flex; align-items: center; gap: .5em; padding: 2px .5em 2px 10px; line-height: 30px;
	border-top: 1px solid var(--vietime-grid, #333); white-space: nowrap; cursor: pointer }
.vietime-option:first-child { border-top: none }
.vietime-option:hover, .vietime-option[aria-selected="true"] { background: var(--vietime-active, rgba(10, 120, 255, .4)) }
.vietime-glyph { font-size: 1.5em; padding: 0 .1em; font-family: var(--vietime-font, sans-serif) }
.vietime-reading { flex: 1 }
.vietime-remainder { font-weight: bold; color: var(--vietime-remainder, #00f) }
.vietime-hyphen { opacity: .5 }
.vietime-definition { max-width: 8em; overflow: hidden; text-overflow: ellipsis; font-size: .7em; opacity: .8 }`;

	let count = 0;

	class VietIme {
		static DICTIONARIES = DICTIONARIES;
		static load = (urls = DICTIONARIES) => dictionaryFor(urls).load();
		static lookup = word => dictionaryFor(DICTIONARIES).lookup(word);
		static lookupGlyph = text => dictionaryFor(DICTIONARIES).lookupGlyph(text);
		static telex = (raw, mode = 'telex') => telexWord(raw, MODES[mode]);

		constructor(input, options = {}) {
			this.input = input;
			this.options = { telex: true, candidates: true, defer: false, dictionaries: DICTIONARIES, fontList: [],
				returnSelect: false, spaceSelect: false, showDefinitions: true, ...options };
			this.dict = dictionaryFor(this.options.dictionaries);
			this.items = [];
			this.page = 0;
			this.active = -1;
			this.saved = Object.fromEntries(Object.keys(TYPING_ATTRIBUTES).map(a => [a, input.getAttribute(a)]));

			if (!document.getElementById('vietime-style')) {
				const style = document.createElement('style');
				style.id = 'vietime-style';
				style.textContent = STYLE;
				document.head.prepend(style);
			}
			this.list = document.createElement('div');
			this.list.id = `vietime-${++count}`;
			this.list.className = 'vietime';
			this.list.setAttribute('role', 'listbox');
			this.list.hidden = true;
			document.body.append(this.list);

			input.addEventListener('beforeinput', e => this.onBeforeInput(e));
			input.addEventListener('input', () => this.refresh());
			input.addEventListener('compositionstart', () => this.composing = true);
			input.addEventListener('compositionend', e => this.onCompositionEnd(e));
			input.addEventListener('keydown', e => this.onKeyDown(e));
			input.addEventListener('click', () => this.refresh());
			input.addEventListener('blur', () => this.hide());
			this.update();
		}

		update(options = {}) {
			Object.assign(this.options, options);
			const { telex, candidates, defer, fontList } = this.options, input = this.input;
			for (const [a, v] of Object.entries(TYPING_ATTRIBUTES)) {
				const value = telex ? v : this.saved[a];
				if (value == null) input.removeAttribute(a); else input.setAttribute(a, value);
			}
			const fonts = fontFamily([...fontList, ...DEFAULT_FONTS]);
			this.list.style.setProperty('--vietime-font', fonts);
			input.style.fontFamily = candidates ? fonts : '';
			if (candidates) {
				input.setAttribute('role', 'combobox');
				input.setAttribute('aria-autocomplete', 'list');
				input.setAttribute('aria-controls', this.list.id);
				input.setAttribute('aria-expanded', 'false');
				if (!defer) this.load();
				else if (!this.dict.ready) input.addEventListener('focus', () => this.load(), { once: true });
			} else {
				for (const a of ['role', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-activedescendant']) input.removeAttribute(a);
				this.hide();
			}
		}

		load() {
			const wait = this.options.defer == 'wait' && !this.dict.ready;
			if (wait) this.input.readOnly = true;
			return this.dict.load().then(() => {
				if (wait) this.input.readOnly = false;
				this.refresh();
			});
		}

		get mode() {
			return this.options.telex == 'compound' ? MODES.compound : MODES.telex;
		}

		onBeforeInput(e) {
			if (this.busy || e.isComposing || !e.cancelable || e.inputType != 'insertText' || !e.data || e.data.length != 1) return;
			const { selectionStart: start, selectionEnd: end, value } = this.input;
			if (start != end) return;
			if (this.visible && /[0-9]/.test(e.data)) {
				e.preventDefault();
				return this.select(10 * this.page + (+e.data + 9) % 10);
			}
			if (this.visible && e.data == ' ' && this.options.spaceSelect) {
				e.preventDefault();
				return this.select(this.active >= 0 ? this.active : 10 * this.page);
			}
			if (!this.options.telex) return;
			const from = Math.max(0, start - LOOKBACK);
			const result = telexKey(value.slice(from, start), e.data, this.mode);
			if (result == null) return;
			e.preventDefault();
			this.replace(from, start, result);
		}

		// Mobile keyboards compose whole words; convert the word once it is committed
		onCompositionEnd(e) {
			this.composing = false;
			const end = this.input.selectionStart, start = end - (e.data || '').length;
			if (this.options.telex && e.data && this.input.value.slice(start, end) == e.data) {
				const word = telexWord(e.data, this.mode);
				if (word != e.data) this.replace(start, end, word);
			}
			this.refresh();
		}

		onKeyDown(e) {
			if (!this.visible || e.isComposing) return;
			if (e.key == 'Escape') {
				this.hide();
			} else if (e.key == 'PageDown' || e.key == 'PageUp') {
				e.preventDefault();
				this.showPage(this.page + (e.key == 'PageDown' ? 1 : -1));
			} else if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
				e.preventDefault();
				this.setActive(this.active + (e.key == 'ArrowDown' ? 1 : -1));
			} else if (e.key == 'Enter' && !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) && (this.active >= 0 || this.options.returnSelect)) {
				e.preventDefault();
				this.select(this.active >= 0 ? this.active : 10 * this.page);
			}
		}

		// Replaces value[from, to) with text, keeping undo and firing input (only the changed tail is replaced)
		replace(from, to, text) {
			const old = this.input.value.slice(from, to);
			let p = 0;
			while (p < old.length && p < text.length && old[p] == text[p]) p++;
			if (p && /[\uD800-\uDBFF]/.test(old[p - 1])) p--;
			const insert = text.slice(p);
			this.busy = true;
			this.input.setSelectionRange(from + p, to);
			if (!document.execCommand(insert ? 'insertText' : 'delete', false, insert)) {
				this.input.setRangeText(insert, from + p, to, 'end');
				this.input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: insert }));
			}
			this.busy = false;
		}

		// Word before the caret (one trailing space allowed), or a punctuation character
		currentWord() {
			const { selectionStart: caret, selectionEnd, value } = this.input;
			if (caret != selectionEnd) return null;
			let start = value[caret - 1] == ' ' ? caret - 1 : caret;
			while (start > 0 && caret - start < LOOKBACK && isLetter(value[start - 1])) start--;
			let word = value.slice(start, caret).trim();
			if (!word && caret > 0 && value[caret - 1] != ' ' && PUNCTUATION.includes(value[caret - 1])) {
				start = caret - 1;
				word = value[start];
			}
			return word ? { start, end: caret, word } : null;
		}

		refresh() {
			if (!this.options.candidates || document.activeElement != this.input) return this.hide();
			const current = this.currentWord();
			// while a mobile keyboard composes, the word is still raw Telex
			const word = current && (this.composing && this.options.telex ? telexWord(current.word, this.mode) : current.word);
			this.items = word ? this.dict.candidates(word.toLowerCase()) : [];
			this.active = -1;
			this.showPage(0);
		}

		get visible() {
			return !this.list.hidden;
		}

		showPage(page) {
			const pages = Math.ceil(this.items.length / 10);
			if (!pages) return this.hide();
			this.page = Math.max(0, Math.min(page, pages - 1));
			this.list.replaceChildren(...this.items.slice(this.page * 10, this.page * 10 + 10).map((item, i) => this.option(item, this.page * 10 + i)));
			const r = this.input.getBoundingClientRect();
			this.list.style.left = `${r.left + scrollX}px`;
			this.list.style.top = `${r.bottom + scrollY}px`;
			this.list.hidden = false;
			this.input.setAttribute('aria-expanded', 'true');
			if (this.active >= 0) this.input.setAttribute('aria-activedescendant', `${this.list.id}-${this.active}`);
			else this.input.removeAttribute('aria-activedescendant');
		}

		setActive(index) {
			this.active = Math.max(0, Math.min(index, this.items.length - 1));
			this.showPage(Math.floor(this.active / 10));
		}

		option(item, index) {
			const span = (className, text) => {
				const s = document.createElement('span');
				s.className = className;
				// compound readings: "việtNam" → "việt-nam"
				for (const ch of text) {
					if (/\p{Lu}/u.test(ch)) s.append(Object.assign(document.createElement('span'), { className: 'vietime-hyphen', textContent: '-' }));
					s.append(ch.toLowerCase());
				}
				return s;
			};
			const symbol = item.remainder.startsWith('_'); // "-_ideographicHyphen": show the name
			const el = document.createElement('div');
			el.className = 'vietime-option';
			el.id = `${this.list.id}-${index}`;
			el.setAttribute('role', 'option');
			el.setAttribute('aria-selected', index == this.active);
			const reading = document.createElement('span');
			reading.className = 'vietime-reading';
			reading.append(span('vietime-head', symbol ? item.remainder.slice(1) : item.head), span('vietime-remainder', symbol ? '' : item.remainder));
			el.append(Object.assign(document.createElement('span'), { className: 'vietime-number', textContent: `${(index % 10 + 1) % 10}.` }),
				Object.assign(document.createElement('span'), { className: 'vietime-glyph', textContent: item.glyph }), reading);
			if (this.options.showDefinitions && item.definition) {
				el.append(Object.assign(document.createElement('span'), { className: 'vietime-definition', textContent: `→ ${item.definition.trim()}`, title: item.definition.trim() }));
			}
			el.addEventListener('mousedown', e => e.preventDefault()); // keep the focus in the field
			el.addEventListener('click', () => this.select(index));
			return el;
		}

		select(index) {
			const item = this.items[Math.min(index, this.items.length - 1)], current = this.currentWord();
			if (!item || !current) return;
			this.hide();
			countUsage(item.glyph);
			this.replace(current.start, current.end, item.glyph);
		}

		hide() {
			this.items = [];
			this.active = -1;
			this.list.hidden = true;
			if (this.input.hasAttribute('aria-expanded')) this.input.setAttribute('aria-expanded', 'false');
			this.input.removeAttribute('aria-activedescendant');
		}
	}

	window.VietIme = VietIme;
})();
