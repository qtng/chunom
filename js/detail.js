/*
The detail popup of a character (readings, glyphs, related characters, the "Add to deck" button), shared by the pages of chunom.org.

  <script src="…/chunom/js/detail.js"></script>       the popup builds itself when it is first opened
  ChunomDetail.open('生日');                              opens it (loads the dictionary and Bootstrap on demand)
  ChunomDetail.get().configure({ urlFor, onQattClick, onClose })
      urlFor(nom)       address of the history entry of the open popup (default: the address of the page, unchanged)
      onQattClick(text) a click on a glyph in the popup (default: search for it in the dictionary, index.html)
      onClose()         the popup was closed by the back button
  document 'chunom:deckchange' ({ deckId, nom, added }) after a character was added to or removed from a deck
*/
(() => {
const BASE = new URL('./', document.currentScript?.src || location.href); // the folder js/ of chunom
const DICT_URL = 'https://qatt.org/chunom/dict.csv';
const BOOTSTRAP_JS = 'https://qatt.org/qatt/vendor/bootstrap/js/bootstrap.bundle.min.js';
const ICONS_CSS = 'https://qatt.org/qatt/vendor/bootstrap-icons/bootstrap-icons.min.css';

// Small DOM helper: el('div', { className: 'x', 'data-copy': '…' }, child, 'text', [more]).
// Texts become text nodes, never HTML; known properties directly, everything else (data-*, aria-*, role) with setAttribute.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.includes('-') || !(key in node)) node.setAttribute(key, value); else node[key] = value;
  }
  node.append(...children.flat(Infinity).filter(child => child != null && child !== false && child !== ''));
  return node;
}

const NOM_CHAR = /[一-鿿㐀-䶿\u{20000}-\u{323af}]/u;

const STYLE = `
#copy-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #2b2118; color: #fff; padding: 8px 16px;
  border-radius: 20px; font-size: .85rem; z-index: 9999; display: none; border: 1px solid #2b2118; }
#detailModal { --ink: #2b2118; --cinnabar: #a8362a; --line: #e4d9c0; --field: #cdbf9f; --muted: #7b6c58; }
#detailModal .modal-content { background: #fffdf8; color: var(--ink); border-radius: 1rem; border: 1px solid var(--line); }
#detailModal .modal-header, #detailModal .modal-footer { border-color: var(--line); }
#detailModal .modal-title { font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
#detailModal .modal-footer .btn-secondary { background: #fff; border: 1px solid var(--field); color: var(--ink); border-radius: 2rem; }
#detailModal .modal-footer .btn-secondary:hover { background: #f1e8d2; }
#detailModal .text-secondary { color: var(--muted) !important; }
#detailModal .font-serif { font-family: 'Nom Na Tong Supplement', 'NomKhai-Supplement', 'Han-Nom Gothic Supplement', serif; }
#detailModal .font-monospace { font-family: 'Nom Na Tong Supplement', 'NomKhai-Supplement', 'Han-Nom Gothic Supplement', monospace; }
#detailModal .lh-sm { line-height: 1.1; }
#detailModal .list-group { border-top: 1px solid var(--line) !important; }
#detailModal .list-group-item { background: #fffdf8 !important; border: 0 !important; border-bottom: 1px solid var(--line) !important; border-radius: 0 !important; margin: 0 !important; color: var(--ink); }
#detailModal .list-group-item:last-child { border-bottom: 0 !important; }
#detailModal .list-group-item-action:hover { background: #f6edd6 !important; }
#detailModal .glyph-box { min-width: 120px; height: 160px; flex-shrink: 0; cursor: pointer; }
#detailModal .badge-rank { font-weight: 400; border: 1px solid var(--field); color: var(--muted); font-size: .65rem; background: transparent; }
#detailModal .clickable-meta { cursor: pointer; transition: opacity .2s; }
#detailModal .clickable-meta:hover { opacity: 1 !important; text-decoration: underline; }
#detailModal .nom-char { cursor: pointer; }
#detailModal .nom-char, #detailModal .nom-char img { border-radius: .25rem; transition: background-color .15s, box-shadow .15s; }
#detailModal .nom-char:hover img, #detailModal .nom-char:not(:has(img)):hover { background-color: var(--bs-info-bg-subtle); box-shadow: 0 0 0 .2rem var(--bs-info-bg-subtle); }
#detailModal qatt-code { cursor: pointer; vertical-align: sub; transition: filter .2s; }
#detailModal qatt-code:hover { filter: brightness(1.3); }
#detailModal qatt-code svg { stroke: currentColor; stroke-linecap: round; fill: transparent; vertical-align: baseline; display: inline-block; height: 2em; position: relative; top: -.25em; }
#detailModal .deck-toggle { display: inline-flex; align-items: center; gap: .35rem; border-radius: 2rem; border: 1.5px solid var(--cinnabar); background: #fff; color: var(--cinnabar); font-size: .9rem; line-height: 1.2; padding: .3rem .8rem; white-space: nowrap; }
#detailModal .ipa-box { color: #4f9a5a; font-size: 1.05rem; line-height: 1.35; }
#detailModal .ipa-box sup { font-size: .65em; }
#detailModal .speak-btn, .speak-btn { border: 0; background: none; color: var(--cinnabar, #a8372b); padding: 0 .35rem; line-height: 1; font-size: 1.2rem; cursor: pointer; }
.speak-btn:hover, .speak-btn:focus-visible { opacity: .7; }
#detailModal .modal-footer .deck-toggle { padding: .375rem .9rem; font-size: 1rem; }
#detailModal .deck-toggle:hover, #detailModal .deck-toggle:focus-visible, #detailModal .deck-toggle.in-deck { background: var(--cinnabar); color: #fff; }
#deck-sheet { position: fixed; inset: 0; z-index: 5; display: flex; align-items: flex-end; justify-content: center; background: rgba(43, 33, 24, .45); opacity: 0; visibility: hidden; transition: opacity .2s, visibility .2s; }
#deck-sheet.open { opacity: 1; visibility: visible; }
#deck-sheet .sheet { width: min(100%, 32rem); max-height: 80vh; overflow-y: auto; background: #fffdf8; border-radius: 1.2rem 1.2rem 0 0; padding: .8rem 1.2rem 1.4rem; transform: translateY(100%); transition: transform .25s ease-out; }
#deck-sheet.open .sheet { transform: none; }
#deck-sheet .sheet-title { font: 400 1.15rem Georgia, "Times New Roman", serif; }
#deck-sheet .deck-line { display: flex; align-items: center; border-bottom: 1px solid var(--line); }
#deck-sheet .deck-line:hover { background: rgba(168, 54, 42, .06); }
#deck-sheet .deck-row { display: flex; align-items: center; gap: .8rem; flex: 1; min-width: 0; padding: .65rem .3rem; border: 0; background: none; color: var(--ink); text-align: left; }
#deck-sheet .deck-row .bi { font-size: 1.25rem; color: var(--cinnabar); }
#deck-sheet .deck-open { flex: none; padding: .65rem .8rem; color: var(--muted); text-decoration: none; }
#deck-sheet .deck-open:hover, #deck-sheet .deck-open:focus-visible { color: var(--cinnabar); }
#deck-sheet .btn-new { background: var(--cinnabar); border-color: var(--cinnabar); color: #fff; border-radius: 2rem; }
#deck-sheet .btn-new:hover { background: #8c2c22; border-color: #8c2c22; color: #fff; }
#deck-sheet .text-secondary { color: var(--muted) !important; }`;

const MODAL = `
<div class="modal fade" id="detailModal" tabindex="-1" aria-hidden="true" aria-labelledby="modalTitle">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="modalTitle">Details</h5>
        <div class="d-flex align-items-center ms-auto">
          <button type="button" class="deck-toggle"><i class="bi bi-plus-lg"></i> <span>Add to deck</span></button>
          <button type="button" class="ms-4 btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
      </div>
      <div class="modal-body" id="modalBody"></div>
      <div class="modal-footer">
        <button type="button" class="deck-toggle"><i class="bi bi-plus-lg"></i> <span>Add to deck</span></button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
      <!-- Bottom sheet: add the character to one of the decks (inside the popup, so that the focus trap of Bootstrap does not interfere) -->
      <div id="deck-sheet" role="dialog" aria-modal="true" aria-labelledby="deck-sheet-title" aria-hidden="true">
        <div class="sheet">
          <div class="d-flex align-items-center mb-2">
            <div id="deck-sheet-title" class="sheet-title flex-grow-1 text-center ps-4">Add to deck</div>
            <button type="button" id="deck-sheet-close" class="btn-close" aria-label="Close"></button>
          </div>
          <div id="deck-sheet-body"></div>
        </div>
      </div>
    </div>
  </div>
</div>`;

class ChunomDetail {
  static #instance;
  static #data;
  static #audio;

  static get() { return ChunomDetail.#instance ??= new ChunomDetail(); }

  /** Opens the popup for a character or word (Nôm). */
  // Pronounce Vietnamese text: the browser voice if there is one, else Google TTS through audiomanager.js
  static async speak(text) {
    if (!text) return;
    if (!ChunomDetail.#audio) {
      await ChunomDetail.loadScript(new URL('../decks/audiomanager.js', BASE).href, () => typeof AudioManager !== 'undefined' && AudioManager);
      ChunomDetail.#audio = new AudioManager(new Audio(), {});
    }
    return ChunomDetail.#audio.speak(text, 'auto');
  }
  // A small speaker button for a reading
  static speakButton(text) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'speak-btn';
    b.title = 'Pronounce';
    b.setAttribute('aria-label', 'Pronounce');
    b.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); ChunomDetail.speak(text); });
    return b;
  }

  static open(nom, clickedId = null, row = null) { return ChunomDetail.get().open(nom, clickedId, row); }

  /** The rows of the dictionary [reading, nom, meaning, …, rank] (loaded once). */
  static loadData(url = DICT_URL) {
    return ChunomDetail.#data ??= fetch(url)
      .then(response => response.ok ? response.text() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(text => ChunomDetail.get().parseCSV(text))
      .catch(err => { ChunomDetail.#data = null; throw err; });
  }

  static loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      document.head.append(el('script', { src, onload: resolve, onerror: () => reject(new Error(`${src} not loaded`)) }));
    });
  }

  /** The Telex input method with the dictionaries of its candidates; they hold characters that are not in the csv. */
  static loadIme() {
    return ChunomDetail.loadScript(new URL('ime.js', BASE).href, () => window.VietIme)
      .then(() => window.VietIme.load())
      .catch(err => console.error('Input method dictionaries not available', err));
  }

  constructor() {
    this.options = {};
    this.data = [];
    this.deckIds = new Set();
    this.relatedBox = el('div', { className: 'related mt-2 text-center' });
  }

  // the decoding of the glyphs (parser.js), created when it is first needed
  get parser() {
    return this._parser ??= typeof VietnameseParser == 'undefined' ? null : new VietnameseParser();
  }

  /** urlFor(nom), onQattClick(text), onClose(): see above */
  configure(options) {
    Object.assign(this.options, options);
    return this;
  }

  // The popup is built when it is needed: styles, Bootstrap, the dictionary, the elements.
  setup() {
    return this.ready ??= (async () => {
      if (!document.getElementById('chunom-detail-style')) document.head.append(el('style', { id: 'chunom-detail-style', textContent: STYLE }));
      if (!document.querySelector('link[href*="bootstrap-icons"]')) document.head.append(el('link', { rel: 'stylesheet', href: ICONS_CSS }));
      await ChunomDetail.loadScript(BOOTSTRAP_JS, () => window.bootstrap);
      if (typeof Qatt != 'undefined') new Qatt().observe('qatt-code'); // draws the glyphs of the popup (an element is drawn only once)
      this.data = await ChunomDetail.loadData();
      await ChunomDetail.loadScript(new URL('ipa.js', BASE).href, () => window.ChunomIpa).catch(() => {}); // the IPA is optional
      document.body.insertAdjacentHTML('beforeend', MODAL);
      this.toast = document.getElementById('copy-toast') || document.body.appendChild(el('div', { id: 'copy-toast' }));
      const modalEl = document.getElementById('detailModal');
      this.modal = new bootstrap.Modal(modalEl);
      this.modalBody = document.getElementById('modalBody');
      this.initRelations();
      this.initDecks();
      this.initHistoryHandler(modalEl);
      this.initClickHandler();
    })().catch(err => { this.ready = null; throw err; });
  }

  async open(nom, clickedId = null, row = null) {
    await this.setup();
    this.showDetails(clickedId, nom, row);
  }

  hide() {
    this.modal?.hide();
  }

  // The address of the history entry of the open popup: a link to share on the dictionary page, unchanged elsewhere
  urlFor(nom) {
    return this.options.urlFor ? this.options.urlFor(nom) : location.href;
  }

  initHistoryHandler(modalEl) {
    window.addEventListener('popstate', () => {
      this.modal.hide();
      this.options.onClose?.();
    });
    // After closing back to the element that opened the popup, so that the keyboard goes on from there
    modalEl.addEventListener('show.bs.modal', () => { this.returnFocus = document.activeElement; });
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (history.state && history.state.modalOpen) history.back();
      this.returnFocus?.focus();
    });
  }

  // Capture: these clicks win over the clickable row or tile below them
  initClickHandler() {
    document.addEventListener('click', e => {
      if (!e.target.closest('#detailModal')) return;
      const glyph = e.target.closest('qatt-code');
      if (glyph?.title) {
        e.stopPropagation();
        const query = glyph.title.toLowerCase();
        if (this.options.onQattClick) this.options.onQattClick(query);
        else location.href = `${new URL('../index.html', BASE).href}?search=${encodeURIComponent(query)}`;
        return;
      }
      const nomChar = e.target.closest('.nom-char');
      if (nomChar) {
        e.stopPropagation();
        this.showDetails(null, nomChar.dataset.char);
        return;
      }
      const copy = e.target.closest('[data-copy]');
      if (copy) this.copyText(copy.dataset.copy, copy);
    }, true);
  }

  initRelations() {
    fetch('https://qatt.org/chunom/js/glyph_relations.json')
      .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(relations => {
        this.mainOf = relations;
        this.variantsOf = {};
        for (const [variant, [kind, main]] of Object.entries(relations)) (this.variantsOf[main] ??= []).push([variant, kind]);
        // Popup schon offen: Abschnitt nachtragen
        if (this.currentNom) this.renderRelated(this.currentNom);
      })
      .catch(err => console.error('Related characters not available', err));
  }

  // Das Hauptzeichen und alle seine Formen, ohne das Zeichen selbst

  renderRelated(nom) {
    const KINDS = { v: 'Variant', s: 'Simplified', t: 'Traditional' };
    const main = this.mainOf?.[nom]?.[1] || nom;
    const items = [];
    if (main !== nom) items.push([main, 'Standard form']);
    for (const [variant, kind] of this.variantsOf?.[main] || []) if (variant !== nom) items.push([variant, KINDS[kind]]);
    this.relatedBox.replaceChildren(...(items.length ? [
      el('div', { className: 'small text-secondary mb-1', textContent: 'Related' }),
      el('div', { className: 'd-flex flex-wrap justify-content-center gap-2' }, items.map(([ch, title]) => {
        const link = el('button', { type: 'button', className: 'btn btn-link text-body p-0 border-0 text-decoration-none', title: `${title}: ${ch}`, 'aria-label': `${title}: ${ch}` }, this.nomChars(ch, 32));
        link.addEventListener('click', () => this.showDetails(null, ch));
        return link;
      }))
    ] : []));
  }

  // Decks: das Zeichen im Popup einem Deck der Flashcards zuordnen (Daten in Supabase, angemeldet)

  initDecks() {
    this.deckToggles = [...document.querySelectorAll('.deck-toggle')]; // in the header and in the footer of the popup
    this.deckSheet = document.getElementById('deck-sheet');
    this.deckSheetBody = document.getElementById('deck-sheet-body');
    for (const toggle of this.deckToggles) toggle.addEventListener('click', () => {
      this.openDeckSheet();
      toggle.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
    });
    this.deckSheet.addEventListener('click', e => { if (e.target === this.deckSheet) this.closeDeckSheet(); });
    document.getElementById('deck-sheet-close').addEventListener('click', () => this.closeDeckSheet());
    this.deckSheet.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      this.closeDeckSheet();
    });
    document.getElementById('detailModal').addEventListener('hidden.bs.modal', () => this.closeDeckSheet());
    // Der Login-Dialog liegt außerhalb des Popups; Bootstraps Fokus-Trap würde ihm den Fokus (E-Mail-Feld) wegnehmen
    window.addEventListener('focusin', e => {
      if (e.target.closest?.('dialog.qatt-login')) e.stopImmediatePropagation();
    }, true);
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toast.style.display = 'none'; }, 2500);
  }

  signedIn() {
    return !!this.sp?.user && !this.sp.isAnonymous;
  }

  // true, wenn angemeldet; sonst öffnet sich der Login-Dialog (der Dienst wird erst jetzt gestartet, damit Besucher nicht anonym angelegt werden)

  async ensureSignedIn() {
    if (typeof SupabaseService === 'undefined' || typeof QattLogin === 'undefined') {
      this.showToast('Decks are not available right now.');
      return false;
    }
    this.sp ??= new SupabaseService();
    if (!this.sp.client) await this.sp.init();
    if (this.signedIn()) return true;
    QattLogin.open(this.sp, 'Sign in to save characters to your decks.');
    return false;
  }

  // "Added" mit Haken auf gefülltem Button, wenn das Zeichen in einem eigenen Deck liegt

  updateDeckUi() {
    const inDeck = this.deckIdsNom === this.currentNom && this.deckIds.size > 0;
    for (const toggle of this.deckToggles) {
      toggle.classList.toggle('in-deck', inDeck);
      toggle.querySelector('i').className = `bi ${inDeck ? 'bi-check-lg' : 'bi-plus-lg'}`;
      toggle.querySelector('span').textContent = inDeck ? 'Added' : 'Add to deck';
    }
  }

  async loadDeckIds() {
    const nom = this.currentNom;
    const ids = await this.sp.getDeckIdsWithWord(nom);
    if (nom !== this.currentNom) return;
    this.deckIds = new Set(ids);
    this.deckIdsNom = nom;
    this.updateDeckUi();
  }

  async openDeckSheet() {
    if (!await this.ensureSignedIn()) return;
    this.deckSheet.classList.add('open');
    this.deckSheet.setAttribute('aria-hidden', 'false');
    this.deckSheetBody.replaceChildren(el('div', { className: 'text-center text-secondary py-4' }, el('div', { className: 'spinner-border spinner-border-sm' })));
    const [decks] = await Promise.all([this.sp.getDecks(), this.loadDeckIds()]);
    this.decks = decks;
    this.renderDeckSheet();
  }

  closeDeckSheet() {
    this.deckSheet.classList.remove('open');
    this.deckSheet.setAttribute('aria-hidden', 'true');
  }

  renderDeckSheet(creating = false) {
    const rows = this.decks.map(deck => {
      const has = this.deckIds.has(deck.id);
      const row = el('button', { type: 'button', className: 'deck-row', 'aria-pressed': has },
        el('i', { className: `bi ${has ? 'bi-check-circle-fill' : 'bi-circle'}` }),
        el('span', { className: 'flex-grow-1' }, el('span', { className: 'd-block fw-semibold', textContent: deck.title }),
          el('small', { className: 'text-secondary', textContent: `${deck.count || 0} items` })));
      row.addEventListener('click', () => this.toggleInDeck(deck, row));
      const open = el('a', { className: 'deck-open', href: `decks/deck.html?id=${deck.id}`, title: 'Open the deck', 'aria-label': `Open the deck ${deck.title}` }, el('i', { className: 'bi bi-box-arrow-up-right' }));
      return el('div', { className: 'deck-line' }, row, open);
    });
    const nameInput = el('input', { type: 'text', className: 'form-control', placeholder: 'Deck title', maxLength: 80, 'aria-label': 'Deck title' });
    const create = () => this.createDeck(nameInput.value);
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
    const createBtn = el('button', { type: 'button', className: 'btn btn-new fw-bold px-4', textContent: 'Create' });
    createBtn.addEventListener('click', create);
    const newBtn = el('button', { type: 'button', className: 'btn btn-new w-100 py-2 fw-bold', textContent: 'New deck' });
    newBtn.addEventListener('click', () => this.renderDeckSheet(true));
    this.deckSheetBody.replaceChildren(
      el('div', { className: 'd-flex align-items-center gap-3 mb-2' },
        el('span', {}, this.nomChars(this.currentNom, 32)),
        el('span', { className: 'text-secondary', lang: 'vi', textContent: this.currentQn })),
      ...(rows.length ? rows : [el('p', { className: 'text-secondary small my-3', textContent: 'You have no decks yet.' })]),
      el('div', { className: 'mt-3' }, creating ? el('div', { className: 'd-flex gap-2' }, nameInput, createBtn) : newBtn));
    if (creating) nameInput.focus();
  }

  // Tells the page that a deck changed (a character added or removed, a deck created), so that it can show the new state
  announceDeckChange(deckId, added) {
    document.dispatchEvent(new CustomEvent('chunom:deckchange', { detail: { deckId, nom: this.currentNom, added } }));
  }

  async toggleInDeck(deck, row) {
    const nom = this.currentNom, qn = this.currentQn;
    const add = !this.deckIds.has(deck.id);
    row.disabled = true;
    const { error } = await this.sp.setWordInDeck(deck.id, { n: nom, qn }, add);
    if (error) {
      this.showToast('Could not save, please try again.');
      row.disabled = false;
      return;
    }
    this.announceDeckChange(deck.id, add);
    if (nom !== this.currentNom) return;
    this.deckIds[add ? 'add' : 'delete'](deck.id);
    deck.count = Math.max(0, (deck.count || 0) + (add ? 1 : -1));
    this.updateDeckUi();
    this.showToast(add ? `Added to “${deck.title}”` : `Removed from “${deck.title}”`);
    // after adding the sheet closes by itself; after removing it stays open for further changes
    if (add) this.closeDeckSheet(); else this.renderDeckSheet();
  }

  async createDeck(title) {
    title = title.trim();
    if (!title) return this.deckSheetBody.querySelector('input')?.focus();
    const nom = this.currentNom;
    this.deckSheetBody.querySelectorAll('input, button').forEach(node => { node.disabled = true; });
    const { error } = await this.sp.saveDeck({ id: crypto.randomUUID(), title, words: [{ n: nom, qn: this.currentQn }] });
    if (error) {
      this.showToast('Could not create the deck, please try again.');
      return this.renderDeckSheet(true);
    }
    this.announceDeckChange(null, true);
    this.closeDeckSheet();
    this.showToast(`Added to “${title}”`);
    if (nom === this.currentNom) this.loadDeckIds();
  }

  makeActivatable(el, action) {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('click', action);
    el.addEventListener('keydown', (e) => {
      if (e.target === el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        action();
      }
    });
  }

  parseCSV(text) {
    const rows = [];
    const lines = text.split(/\r?\n/);
    for (let line of lines) {
      if (!line.trim()) continue;
      const row = [];
      let cell = '', inQuotes = false;
      for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          row.push(cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
          cell = '';
        } else cell += char;
      }
      row.push(cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      if (row.length >= 2) rows.push(row);
    }
    return rows;
  }

  qattCodes(quocNgu, fontSize = 'inherit') {
    const codes = [];
    for (const word of (quocNgu && this.parser ? quocNgu.split(/\s+/) : [])) {
      const parsed = word && this.parser.parse(word);
      // the glyph after the rhyme table of the decoding; a syllable without a glyph is left out
      if (parsed?.qatt) codes.push(' ', el('qatt-code', { title: word, style: `font-size: ${fontSize}`, textContent: parsed.qatt }));
    }
    return codes.slice(1);
  }

  // Nôm-Zeichen als Bild aus chunom-assets (Schrift als Ersatz), einzeln anklickbar

  nomChars(text, size) {
    return [...(text || '')].map(ch => {
      if (!NOM_CHAR.test(ch)) return ch;
      if (!size) size = 32;
      const assetSize = size > 40 ? 160 : 32;
      const hex = ch.codePointAt(0).toString(16).toUpperCase();
      return el('span', { className: 'font-serif nom-char', 'data-char': ch },
        this.image([`https://qatt.org/chunom-assets/generated/${assetSize}/${hex}.webp`], { alt: ch, width: size, height: size, loading: 'lazy', style: 'vertical-align: middle' }, () => ch));
    });
  }

  // Bild mit Ersatzquellen; scheitern alle, ersetzt fallback() das Bild. onError läuft bei jedem Fehlschlag.

  image(sources, attrs, fallback, onError) {
    if (!sources.length) return fallback();
    const img = el('img', attrs);
    let i = 0;
    img.addEventListener('error', () => {
      onError?.(img);
      if (++i < sources.length) img.src = sources[i]; else img.replaceWith(fallback());
    });
    img.src = sources[0];
    return img;
  }

  async copyText(text, target) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      return console.error('Copy failed', err);
    }
    if (target?.classList.contains('glyph-box')) {
      target.classList.add('border-info');
      setTimeout(() => target.classList.remove('border-info'), 1000);
    }
    this.showToast(`Copied: ${text}`);
  }

  // Einträge der IME-Wörterbücher mit genau diesem Zeichen, im Format der CSV-Zeilen [Lesung, Zeichen, Bedeutung]

  imeRows(nom) {
    return (window.VietIme?.lookupGlyph?.(nom) || []).filter(entry => entry.glyph === nom).map(entry => [entry.reading, entry.glyph, entry.definition]);
  }

  showDetails(clickedId, mainNom, row) {
    let related = this.data.filter(row => row[1] && row[1].includes(mainNom));
    // IME-Treffer stehen nicht in der CSV
    if (row?.[0] && !related.includes(row)) related.unshift(row);
    else if (!row && !related.some(r => r[1] === mainNom)) {
      // Ohne Zeile (Link aus "Related" oder ?detail=): Einträge aus den IME-Wörterbüchern suchen, falls sie schon geladen sind, sonst nachladen
      related.unshift(...this.imeRows(mainNom));
      if (!related.some(r => r[1] === mainNom)) {
        ChunomDetail.loadIme().then(() => {
          if (this.currentNom === mainNom && this.imeRows(mainNom).length) this.showDetails(clickedId, mainNom);
        });
      }
    }
    const seenEntries = new Set();
    related = related.filter(r => {
      const key = `${r[0].trim().toLowerCase()}|${r[1].trim()}|${r[2].trim()}`;
      if (seenEntries.has(key)) return false;
      seenEntries.add(key);
      return true;
    });

    const sortedRelated = related.sort((a, b) => {
        const aIsExact = (a[1] === mainNom);
        const bIsExact = (b[1] === mainNom);
        if (aIsExact !== bIsExact) return aIsExact ? -1 : 1;
        const aIsCompound = a[0].trim().includes(' ');
        const bIsCompound = b[0].trim().includes(' ');
        if (aIsCompound !== bIsCompound) return aIsCompound ? 1 : -1;
        const aRank = parseInt(a[5]) || Infinity;
        const bRank = parseInt(b[5]) || Infinity;
        return aRank - bRank;
    });

    // Eigener Verlaufseintrag mit ?detail=, Wechsel innerhalb des offenen Popups ersetzt ihn
    if (!history.state || !history.state.modalOpen) {
      history.pushState({ modalOpen: true }, "", this.urlFor(mainNom));
    } else {
      history.replaceState(history.state, "", this.urlFor(mainNom));
    }

    if (mainNom !== this.currentNom) this.deckIds = new Set();
    this.currentNom = mainNom;
    this.closeDeckSheet();
    this.updateDeckUi();
    const mainEntry = sortedRelated.find(r => r[1] === mainNom && !r[0].trim().includes(' '));
    const codes = [...mainNom].map(c => c.codePointAt(0).toString(16).toUpperCase());
    // Bilder gibt es nur für Einzelzeichen; der Codepunkt kommt direkt vom Zeichen, nicht aus der CSV
    const hex = codes.length === 1 ? codes[0] : '';
    const strokes = mainEntry ? mainEntry[4] : (related.find(r => r[4])?.[4] || '');
    const rank = clickedId || (mainEntry ? mainEntry[5] : null);

    const exactMatches = sortedRelated.filter(r => r[1] === mainNom);
    const uniqueReadings = [...new Set(exactMatches.map(r => r[0]))];
    this.renderRelated(mainNom);
    this.currentQn = (mainEntry ? mainEntry[0] : uniqueReadings[0] || '').trim();
    // Ist der Nutzer schon angemeldet, zeigt das Herz gleich, ob das Zeichen in einem Deck liegt
    if (this.signedIn() && this.deckIdsNom !== mainNom) this.loadDeckIds();
    const qattParts = uniqueReadings.map(read => this.qattCodes(read)).filter(part => part.length);

    // Großes Bild: Animation, dann zwei SVG-Varianten, sonst das Zeichen als Schrift
    const glyph = this.image(
      hex ? ['animations/anim-' + hex + '.gif', 'glyph-composer/new/' + hex + '.svg', 'glyph-composer/svg/' + hex + '.svg'].map(path => `https://qatt.org/chunom-assets/${path}`) : [],
      { style: 'height:150px;width:150px' },
      () => el('div', { className: 'text-center' },
        el('div', { className: 'display-1 font-serif text-nowrap', textContent: mainNom }),
        hex && el('div', { className: 'small text-secondary font-monospace', textContent: `U+${hex}` })),
      img => Object.assign(img.style, { visibility: 'hidden', marginTop: '-32px', height: '160px' }));
    glyph.addEventListener('load', () => { glyph.style.visibility = 'visible'; });

    this.modalBody.replaceChildren(
      el('div', { className: 'd-flex align-items-start gap-4 mb-4 p-2' },
        el('div', { className: 'd-flex flex-column align-items-center' },
          el('div', { className: 'd-flex align-items-center justify-content-center rounded border glyph-box px-2', title: 'Click to copy glyph', 'data-copy': mainNom }, glyph),
          this.relatedBox),
        el('div', { className: 'flex-grow-1' },
          // Kopfzeile nur Quốc Ngữ, QATT steht darunter
          el('div', { className: 'd-flex flex-column w-100' }, uniqueReadings.length
            ? uniqueReadings.map(read => el('span', { className: 'fs-2 fw-bold lh-sm d-flex justify-content-between align-items-center' }, el('span', { lang: 'vi', textContent: read }), ChunomDetail.speakButton(read)))
            : el('span', { className: 'text-secondary fst-italic', textContent: 'Part of compound words' })),
          el('div', { className: 'd-flex flex-column gap-1 mt-3 small text-secondary' },
            uniqueReadings.length > 0 && el('div', {}, 'Quốc Ngữ: ', el('span', { lang: 'vi', textContent: uniqueReadings.join('; ') })),
            qattParts.length > 0 && el('div', {}, 'Quốc Âm Tân Tự: ', qattParts.map((part, i) => [i ? ' / ' : '', part])),
            window.ChunomIpa && uniqueReadings.length > 0 && el('div', { className: 'd-flex align-items-baseline gap-2' }, 'IPA:', el('div', { className: 'ipa-box' }, uniqueReadings.flatMap(read => {
              const { north, south } = ChunomIpa.fromQuocNgu(read);
              return north ? [el('div', {}, `[ ${north} ] `, el('sup', { textContent: 'north' })), el('div', {}, `[ ${south} ] `, el('sup', { textContent: 'south' }))] : [];
            }))),
            el('div', {},
              el('span', { className: 'clickable-meta border-bottom', title: 'Click to copy hex code', 'data-copy': codes.join(' '), textContent: `Unicode: ${codes.map(c => `U+${c}`).join(' ')}` }),
              ' - ',
              el('span', { className: 'clickable-meta border-bottom font-serif', title: 'Click to copy', 'data-copy': mainNom, textContent: mainNom })),
            strokes && el('div', { textContent: `Strokes: ${strokes}` }),
            rank && el('div', {}, 'Rank: ', el('span', { className: 'badge badge-rank', textContent: `#${rank}` }))))),
      el('div', { className: 'list-group list-group-flush border-top' }, sortedRelated.map(r => {
        const item = el('div', { className: `list-group-item ${r[1] !== mainNom ? 'list-group-item-action' : ''} py-3 px-0` },
          el('div', { className: 'd-flex align-items-center justify-content-between mb-1' },
            el('div', { className: 'd-flex align-items-center flex-wrap' },
              el('span', { className: 'fs-3 me-2' }, this.nomChars(r[1])),
              el('span', { className: 'text-secondary fw-bold fs-5 qn-text', lang: 'vi', textContent: r[0] })),
            el('div', { className: 'text-end d-flex align-items-center gap-2 flex-wrap justify-content-end' }, this.qattCodes(r[0]))),
          el('div', { className: 'd-flex justify-content-between align-items-center w-100' },
            el('div', { className: 'text-secondary small text-truncate flex-grow-1', textContent: r[2] || 'No description' }),
            r[5] && el('span', { className: 'badge badge-rank ms-2', textContent: `#${r[5]}` })));
        // Zeilen anderer Einträge (Komposita) öffnen deren Details
        if (r[1] !== mainNom) this.makeActivatable(item, () => this.showDetails(r[5], r[1], r));
        return item;
      })));
    // Wechsel innerhalb des offenen Popups: nach oben und Fokus zurück ins Popup
    const modalEl = this.modalBody.closest('.modal');
    if (modalEl.classList.contains('show')) {
      modalEl.scrollTop = 0;
      modalEl.focus();
    }
    this.modal.show();
  }
}

window.ChunomDetail = ChunomDetail;
})();
