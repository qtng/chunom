/**
 * AUDIO MANAGER (for superlearning.html)
 * * Responsibilities:
 * - Handling Audio Playback (Music & Binaural)
 * - Speech Synthesis (TTS)
 * - Managing internal Audio State
 * * Decoupling Strategy:
 * - No global variables (Injects config via constructor)
 * - No direct UI manipulation (Communicates via Events)
 * - DOM independent (Requires audio element reference)
 */
class AudioManager extends EventEmitter {
    /**
     * @param {HTMLAudioElement} audioEl - The <audio> element to control
     * @param {Object} config - Configuration object
     * @param {Array} config.playlist - List of track numbers/IDs
     * @param {Object} config.binaural - Binaural frequency settings
     * @param {Object} initialState - Initial state (e.g., from localStorage)
     */
    constructor(audioEl, config, initialState = {}) {
        super();
        this.el = audioEl;
        this.config = config;
        
        // Internal State (Independent of Persistence Layer)
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
     * Initializes the audio sources based on initial state
     */
    init() {
        this._loadTrack();
        if (this.state.isBinauralOn) this.startBinaural();
        this._notify();
    }

    // --- Public API ---

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
        // If current type is 'none', default back to 'alpha'
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

    // --- Internal Logic ---

    startBinaural() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.stopBinaural();

        const typeCfg = this.config.binaural[this.state.binauralType];
        if (!typeCfg || typeCfg.freq === 0) return;

        const base = 200;
        const diff = typeCfg.freq;
        const g = this.ctx.createGain(); 
        g.gain.value = 0.05; 
        g.connect(this.ctx.destination);

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
        // Emit the entire state object to let the orchestrator decide what to do
        this.emit('update', { ...this.state });
    }
}
