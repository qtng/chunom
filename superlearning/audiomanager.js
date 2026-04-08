/**
 * AUDIO MANAGER (Self-contained with internal EventEmitter)
 * https://qtng.github.io/chunom/superlearning/audiomanager.js
 */

/**
 * Internal Helper: EventEmitter
 * Kapselt das Observer-Pattern innerhalb dieses Moduls.
 */
class EventEmitter {
    constructor() { this.events = {}; }
    on(evt, fn) { (this.events[evt] = this.events[evt] || []).push(fn); }
    emit(evt, data) { (this.events[evt] || []).forEach(fn => fn(data)); }
}

class AudioManager {
    /**
     * @param {HTMLAudioElement} audioEl - Das <audio> DOM-Element
     * @param {Object} config - { playlist: [], binaural: {} }
     * @param {Object} initialState - Initiale Einstellungen aus localStorage
     */
    constructor(audioEl, config, initialState = {}) {
        this.el = audioEl;
        this.config = config;
        
        // INTERNER EMITTER (Komposition statt Vererbung)
        this.events = new EventEmitter();

        this.state = {
            isMusicOn: initialState.isMusicOn ?? true,
            isSpeechOn: initialState.isSpeechOn ?? true,
            isBinauralOn: initialState.isBinauralOn ?? true,
            binauralType: initialState.binauralType || 'alpha',
            currentTrackIdx: initialState.currentTrackIdx ?? Math.floor(Math.random() * config.playlist.length)
        };

        this.ctx = null;
        this.oscs = [];
        this.el.onended = () => this.nextTrack();
    }

    /**
     * Schnittstelle nach außen: Registrierung von Events
     */
    on(evt, fn) {
        this.events.on(evt, fn);
    }

    init() {
        this._loadTrack();
        if (this.state.isBinauralOn) this.startBinaural();
        this._notify();
    }

    toggleMusic() {
        this.state.isMusicOn = !this.state.isMusicOn;
        this.state.isMusicOn ? this.el.play().catch(() => {}) : this.el.pause();
        this._notify();
    }

    toggleSpeech() {
        this.state.isSpeechOn = !this.state.isSpeechOn;
        this._notify();
    }

    toggleBinaural() {
        if (this.state.binauralType === 'none') return this.setBinaural('alpha');
        this.state.isBinauralOn = !this.state.isBinauralOn;
        this.state.isBinauralOn ? this.startBinaural() : this.stopBinaural();
        this._notify();
    }

    setBinaural(type) {
        this.state.binauralType = type;
        this.state.isBinauralOn = (type !== 'none');
        this.state.isBinauralOn ? this.startBinaural() : this.stopBinaural();
        this._notify();
    }

    nextTrack() {
        this.state.currentTrackIdx = (this.state.currentTrackIdx + 1) % this.config.playlist.length;
        this._loadTrack();
    }

    prevTrack() {
        this.state.currentTrackIdx = (this.state.currentTrackIdx - 1 + this.config.playlist.length) % this.config.playlist.length;
        this._loadTrack();
    }

    speak(text, lang = 'vi-VN', rate = 0.8) {
        if (!this.state.isSpeechOn) return;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = rate;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    }

    // --- Private Logik ---

    startBinaural() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.stopBinaural();
        const typeCfg = this.config.binaural[this.state.binauralType];
        if (!typeCfg || typeCfg.freq === 0) return;
        const base = 200, diff = typeCfg.freq;
        const g = this.ctx.createGain(); g.gain.value = 0.05; g.connect(this.ctx.destination);
        [0, diff].forEach((d, i) => {
            const o = this.ctx.createOscillator();
            const p = this.ctx.createStereoPanner();
            o.frequency.value = base + d;
            p.pan.value = i === 0 ? -1 : 1;
            o.connect(p).connect(g);
            o.start();
            this.oscs.push(o);
        });
    }

    stopBinaural() {
        this.oscs.forEach(o => { try { o.stop(); } catch(e) {} });
        this.oscs = [];
    }

    _loadTrack() {
        const trackId = this.config.playlist[this.state.currentTrackIdx];
        this.el.src = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${trackId}.mp3`;
        if (this.state.isMusicOn) this.el.play().catch(() => {});
        this._notify();
    }

    _notify() {
        // Der Manager emittiert über seinen internen Bus
        this.events.emit('update', { ...this.state });
    }
}
