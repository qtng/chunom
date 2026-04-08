/**
 * AUDIO MANAGER (Production Grade)
 * Optimized for synthetic audio and long-running sessions.
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
        
        this.el.onended = () => this.nextTrack();
    }

    on(evt, fn) { this.events.on(evt, fn); }

    /**
     * Initializes the Web Audio API context.
     * Routes the audio element through a compressor to prevent distortion.
     */
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Compressor helps manage high-density electro music peaks
            this.masterCompressor = this.ctx.createDynamicsCompressor();
            this.masterCompressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
            this.masterCompressor.knee.setValueAtTime(30, this.ctx.currentTime);
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

        this._loadTrack();
        if (this.state.isBinauralOn) this.startBinaural();
        this._notify();
    }

    toggleMusic() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.state.isMusicOn = !this.state.isMusicOn;
        this.state.isMusicOn ? this.el.play().catch(() => {}) : this.el.pause();
        this._notify();
    }

    toggleSpeech() {
        this.state.isSpeechOn = !this.state.isSpeechOn;
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

    /**
     * TTS with a safety buffer to prevent driver-level crackling
     */
    speak(text, lang = 'vi-VN', rate = 0.8) {
        if (!this.state.isSpeechOn) return;
        speechSynthesis.cancel();
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = lang;
            u.rate = rate;
            speechSynthesis.speak(u);
        }, 60);
    }

    startBinaural() {
        if (!this.ctx) return;
        this.stopBinaural();
        
        const typeCfg = this.config.binaural[this.state.binauralType];
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

    /**
     * Flushes the audio buffer to prevent long-term distortion
     */
    _loadTrack() {
        const trackId = this.config.playlist[this.state.currentTrackIdx];
        
        this.el.pause();
        this.el.src = ""; // Clear existing buffer
        this.el.load(); 
        
        this.el.src = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${trackId}.mp3`;
        
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.state.isMusicOn) {
            // Small delay to let the browser register the source change
            setTimeout(() => {
                this.el.play().catch(() => {});
            }, 100);
        }
        this._notify();
    }

    _notify() {
        this.events.emit('update', { ...this.state });
    }
}
