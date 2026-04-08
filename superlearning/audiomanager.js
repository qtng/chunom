/**
 * AUDIO MANAGER (Selective Sync Version)
 * Distinguishes between UI-driven pauses and System-driven pauses.
 * https://qtng.github.io/chunom/superlearning/audiomanager.js
 */

class EventEmitter {
    constructor() { this.events = {}; }
    on(evt, fn) { (this.events[evt] = this.events[evt] || []).push(fn); }
    emit(evt, data) { (this.events[evt] || []).forEach(fn => fn(data)); }
}

class AudioManager {
    constructor(audioEl, config, initialState = {}) {
        this.el = audioEl;
        this.config = config;
        this.events = new EventEmitter();

        const parseVolume = (v) => {
            const num = parseFloat(v);
            return isFinite(num) ? num : 0.5;
        };

        this.state = {
            isMusicOn: initialState.isMusicOn !== false,
            isSpeechOn: initialState.isSpeechOn !== false,
            isBinauralOn: initialState.isBinauralOn === true,
            binauralType: initialState.binauralType || 'alpha',
            binauralVolume: parseVolume(initialState.binauralVolume),
            currentTrackIdx: parseInt(initialState.currentTrackIdx) || Math.floor(Math.random() * config.playlist.length)
        };

        this.ctx = null;
        this.oscs = [];
        this.binauralGainNode = null;
        this.masterCompressor = null; 
        this.sourceAttached = false; 
        
        // Flag to distinguish internal UI actions from OS/System actions
        this._isInternalChange = false;

        // System event bindings
        this.el.onplay = () => this._handleSystemPlay();
        this.el.onpause = () => this._handleSystemPause();
        this.el.onended = () => this.nextTrack();
    }

    on(evt, fn) { this.events.on(evt, fn); }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterCompressor = this.ctx.createDynamicsCompressor();
            this.masterCompressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
            this.masterCompressor.knee.setValueAtTime(40, this.ctx.currentTime);
            this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.masterCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);
            this.masterCompressor.connect(this.ctx.destination);

            if (!this.sourceAttached) {
                const source = this.ctx.createMediaElementSource(this.el);
                source.connect(this.masterCompressor);
                this.sourceAttached = true;
            }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this._loadTrack();
        if (this.state.isBinauralOn) this.startBinaural();
        this._notify();
    }

    _handleSystemPlay() {
        if (this._isInternalChange) return; // Ignore internal state toggles
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.state.isMusicOn = true;
        if (this.state.isBinauralOn) this.startBinaural();
        this._notify();
    }

    _handleSystemPause() {
        // If the pause was triggered by UI toggleMusic, we don't want to kill beats/speech
        if (this._isInternalChange) {
            this._isInternalChange = false; 
            return; 
        }

        // Hard stop for everything if triggered by System (e.g. Notification Bar)
        this.state.isMusicOn = false;
        this.stopBinaural(false); 
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        this._notify();
    }

    /**
     * Toggles music. Uses a flag to tell the system handler to keep beats/speech alive.
     */
    toggleMusic() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        
        this._isInternalChange = true; // Signal to the onpause/onplay handlers
        this.state.isMusicOn = !this.state.isMusicOn;
        
        if (this.state.isMusicOn) {
            this.el.play().catch(() => { this._isInternalChange = false; });
        } else {
            this.el.pause();
        }
        this._notify();
    }

    toggleSpeech() {
        this.state.isSpeechOn = !this.state.isSpeechOn;
        if (!this.state.isSpeechOn) speechSynthesis.cancel();
        this._notify();
    }

    toggleBinaural() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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
        this.state.currentTrackIdx = (this.state.currentTrackIdx + 1) % this.config.playlist.length;
        this._loadTrack();
    }

    prevTrack() {
        this.state.currentTrackIdx = (this.state.currentTrackIdx - 1 + this.config.playlist.length) % this.config.playlist.length;
        this._loadTrack();
    }

    speak(text, lang = 'vi-VN', rate = 0.8) {
        // Speech is independent of music state, but stops if system is paused
        if (!this.state.isSpeechOn) return;
        
        speechSynthesis.cancel();
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang;
            u.rate = rate;
            speechSynthesis.speak(u);
        }, 50);
    }

    startBinaural() {
        if (!this.ctx || !this.state.isBinauralOn) return;
        this.stopBinaural(false); 
        
        const typeCfg = this.config.binaural[this.state.binauralType];
        if (!typeCfg || typeCfg.freq === 0) return;
        
        const baseFreq = 200;
        const beatFreq = typeCfg.freq;
        let vol = parseFloat(this.state.binauralVolume);
        if (!isFinite(vol)) vol = 0.5;

        this.binauralGainNode = this.ctx.createGain();
        this.binauralGainNode.gain.value = vol * 0.15;
        this.masterCompressor ? this.binauralGainNode.connect(this.masterCompressor) : this.binauralGainNode.connect(this.ctx.destination);

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

    stopBinaural(resetState = false) {
        if (resetState) this.state.isBinauralOn = false;
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
        const trackId = this.config.playlist[this.state.currentTrackIdx];
        this.el.pause();
        this.el.src = `https://qtng.github.io/chunom/superlearning/media/music/track-${trackId}.mp3`;
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
