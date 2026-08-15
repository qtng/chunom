/**
 * ==========================================
 * AUDIO MANAGER (Lazy Loading / Loose Coupling)
 * ==========================================
 * 
 * A state-based, modular audio controller handling Text-to-Speech (TTS), 
 * background music playlists, and synthesized binaural beats.
 * 
 * Key Features:
 * - Lazy Loading: AudioContext and network requests (MP3s) are deferred 
 *   until music or binaural beats are explicitly activated.
 * - Standalone TTS: Can be initialized without DOM elements or config 
 *   to serve strictly as a lightweight text-to-speech engine.
 * - Event-Driven: Emits 'update' events on state changes for UI syncing.
 * 
 * @class AudioManager
 * 
 * @param {HTMLAudioElement|null} [audioEl=null] - The <audio> element for playback. Optional.
 * @param {Object} [config={}] - Configuration containing { playlist: [], binaural: {} }. Optional.
 * @param {Object} [initialState={}] - Initial overrides (e.g., { isMusicOn: false }). Optional.
 * 
 * @example
 * // 1. Standalone TTS usage:
 * // const audio = new AudioManager();
 * // audio.speak("Xin chào");
 * 
 * // 2. Full usage with UI binding:
 * // const audio = new AudioManager(document.getElementById('bg-audio'), APP_CONFIG, state);
 * // audio.on('update', (state) => updateUI(state));
 * // audio.init();
 * 
 * Public API:
 * @method init() - Initializes context if music/binaural is active.
 * @method toggleMusic() - Toggles playlist playback (triggers lazy load).
 * @method toggleBinaural() - Toggles synthesized beats.
 * @method toggleSpeech() - Enables/disables TTS capability globally.
 * @method setBinaural(type) - Sets beat type (e.g., 'alpha', 'theta', 'none').
 * @method setBinauralVolume(val) - Adjusts beat volume (0.0 - 1.0).
 * @method nextTrack() / prevTrack() - Navigates the playlist.
 * @method speak(text, [lang='vi-VN'], [rate=0.8]) - Reads text aloud (includes Webkit bugfixes).
 * @method on(event, callback) - Subscribes to events (currently: 'update').
 */

class EventEmitter {
    constructor() { this.events = {}; }
    on(evt, fn) { (this.events[evt] = this.events[evt] || []).push(fn); }
    emit(evt, data) { (this.events[evt] || []).forEach(fn => fn(data)); }
}

class AudioManager {
    constructor(audioEl = null, config = { playlist: [], binaural: {} }, initialState = {}) {
        this.el = audioEl;
        this.config = config;
        this.events = new EventEmitter();

        if (this.el) {
            this.el.crossOrigin = "anonymous";
            this.el.onended = () => this.nextTrack();
        }

        const parseVolume = (v) => {
            const num = parseFloat(v);
            return isFinite(num) ? num : 0.5;
        };

        this.state = {
            isMusicOn: initialState.isMusicOn === true,
            isSpeechOn: initialState.isSpeechOn !== false,
            isBinauralOn: initialState.isBinauralOn === true,
            binauralType: initialState.binauralType || 'alpha',
            binauralVolume: parseVolume(initialState.binauralVolume),
            currentTrackIdx: parseInt(initialState.currentTrackIdx || 0) || 0,
        };

        this.ctx = null;
        this.oscs = [];
        this.binauralGainNode = null;
        this.masterCompressor = null; 
        this.sourceAttached = false; 
    }

    on(evt, fn) { this.events.on(evt, fn); }

    init() {
        if (!this.ctx && (this.state.isMusicOn || this.state.isBinauralOn)) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            this.masterCompressor = this.ctx.createDynamicsCompressor();
            this.masterCompressor.threshold.setValueAtTime(-15, this.ctx.currentTime);
            this.masterCompressor.knee.setValueAtTime(30, this.ctx.currentTime);
            this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.masterCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);
            this.masterCompressor.connect(this.ctx.destination);

            if (this.el && !this.sourceAttached) {
                const source = this.ctx.createMediaElementSource(this.el);
                source.connect(this.masterCompressor);
                this.sourceAttached = true;
            }
        }

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.state.isMusicOn) this._loadTrack();
        if (this.state.isBinauralOn) this.startBinaural();
        this._notify();
    }

    toggleMusic() {
        this.state.isMusicOn = !this.state.isMusicOn;
        
        if (this.state.isMusicOn && !this.ctx) this.init(); 
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();

        if (this.state.isMusicOn) {
            if (this.el && !this.el.src) this._loadTrack(); 
            if (this.el) this.el.play().catch(() => {});
        } else {
            if (this.el) this.el.pause();
        }
        this._notify();
    }

    toggleSpeech() {
        this.state.isSpeechOn = !this.state.isSpeechOn;
        this._notify();
    }

    toggleBinaural() {
        if (this.state.binauralType === 'none') return this.setBinaural('alpha');
        this.state.isBinauralOn = !this.state.isBinauralOn;
        
        if (this.state.isBinauralOn && !this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();

        this.state.isBinauralOn ? this.startBinaural() : this.stopBinaural();
        this._notify();
    }

    setBinaural(type) {
        this.state.binauralType = type;
        this.state.isBinauralOn = (type !== 'none');
        
        if (this.state.isBinauralOn && !this.ctx) this.init();

        this.state.isBinauralOn ? this.startBinaural() : this.stopBinaural();
        this._notify();
    }

    setBinauralVolume(val) {
        let v = parseFloat(val);
        if (!isFinite(v)) v = 0.5;
        this.state.binauralVolume = v;
        if (this.binauralGainNode && this.ctx) {
            this.binauralGainNode.gain.setTargetAtTime(this.state.binauralVolume * 0.15, this.ctx.currentTime, 0.05);
        }
        this._notify();
    }

    nextTrack() {
        if (!this.config.playlist || !this.config.playlist.length) return;
        this.state.currentTrackIdx = (this.state.currentTrackIdx + 1) % this.config.playlist.length;
        if (this.state.isMusicOn) this._loadTrack();
    }

    prevTrack() {
        if (!this.config.playlist || !this.config.playlist.length) return;
        this.state.currentTrackIdx = (this.state.currentTrackIdx - 1 + this.config.playlist.length) % this.config.playlist.length;
        if (this.state.isMusicOn) this._loadTrack();
    }

    speak(text, lang = 'vi-VN', rate = 0.8) {
        if (!this.state.isSpeechOn) return;
        
        speechSynthesis.cancel();
        
        // Timeout is a workaround for a known Webkit bug where speech synthesis hangs
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang;
            u.rate = rate;
            speechSynthesis.speak(u);
        }, 50);
    }

    startBinaural() {
        if (!this.ctx) return;
        this.stopBinaural();
        
        const typeCfg = (this.config.binaural && this.config.binaural[this.state.binauralType]) || null;
        if (!typeCfg || typeCfg.freq === 0) return;
        
        const baseFreq = 200;
        const beatFreq = typeCfg.freq;
        let vol = parseFloat(this.state.binauralVolume);
        if (!isFinite(vol)) vol = 0.5;

        this.binauralGainNode = this.ctx.createGain();
        this.binauralGainNode.gain.value = vol * 0.15;
        this.binauralGainNode.connect(this.masterCompressor);

        const freqs = [baseFreq - (beatFreq / 2), baseFreq + (beatFreq / 2)];
        freqs.forEach((f, i) => {
            const o = this.ctx.createOscillator();
            const p = this.ctx.createStereoPanner();
            o.frequency.value = f;
            p.pan.value = (i === 0) ? -1 : 1;
            o.connect(p).connect(this.binauralGainNode);
            o.start();
            this.oscs.push(o);
        });
    }

    stopBinaural() {
        this.oscs.forEach(o => { 
            try { o.stop(); o.disconnect(); } catch(e) {} 
        });
        this.oscs = [];
        if (this.binauralGainNode) {
            this.binauralGainNode.disconnect();
            this.binauralGainNode = null;
        }
    }

    _loadTrack() {
        if (!this.el || !this.config.playlist || !this.config.playlist.length) return;
        const trackId = this.config.playlist[this.state.currentTrackIdx];
        
        this.el.pause();
        this.el.src = `https://qtng.github.io/chunom-assets/audio/SoundHelix-Song-${trackId}.mp3`;
        this.el.load();
        
        if (this.state.isMusicOn) {
            this.el.oncanplay = () => {
                this.el.play().catch(() => {});
                this.el.oncanplay = null;
            };
        }
        this._notify();
    }

    _notify() {
        this.events.emit('update', { ...this.state });
    }
}
