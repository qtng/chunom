/**
 * AUDIO MANAGER (Stable Routing Version with Cloud Fallback)
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
        
        // Configuration & API Key Override
        const defaultApiKey = "AIzaSyCkkaumOk3-wz9yR7XfxMWYYxdiF_m1iNE";
        this.googleApiKey = initialState.googleApiKey || defaultApiKey;
        
        this.el.crossOrigin = "anonymous";

        const parseVolume = (v) => {
            const num = parseFloat(v);
            return isFinite(num) ? num : 0.5;
        };

        this.voice = null;

        const findVoice = () => {
            const voices = window.speechSynthesis.getVoices();
            const viVoice = voices.find(v => v.lang.startsWith('vi'));
            if (viVoice) {
                this.voice = viVoice;
                if (this.state) {
                    this.state.hasSpeechVoice = true;
                    this._notify();
                }
            }
        };

        if (window.speechSynthesis) {
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = findVoice;
            }
            findVoice();
        }
        
        this.state = {
            isMusicOn: initialState.isMusicOn !== false,
            isSpeechOn: initialState.isSpeechOn !== false,
            hasSpeechVoice: false, 
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
        
        this.el.onended = () => this.nextTrack();
    }

    on(evt, fn) { this.events.on(evt, fn); }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterCompressor = this.ctx.createDynamicsCompressor();
            this.masterCompressor.threshold.setValueAtTime(-15, this.ctx.currentTime);
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

    /**
     * @param {string} text - The text to be spoken
     * @param {string} mode - 'auto' (default), 'browser' (force local), 'cloud' (force Google)
     * @param {number} rate - Speaking rate for browser TTS
     */
    async speak(text, mode = 'auto', rate = 0.8) {
        if (!this.state.isSpeechOn) return;

        if (!this.voice && window.speechSynthesis) {
            this.voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('vi'));
        }

        const forceCloud = (mode === 'cloud');
        const forceBrowser = (mode === 'browser');

        if (!forceCloud && (forceBrowser || mode === 'auto') && this.voice) {
            speechSynthesis.cancel();
            setTimeout(() => {
                const u = new SpeechSynthesisUtterance(text);
                u.voice = this.voice;
                u.lang = 'vi-VN';
                u.rate = rate;
                speechSynthesis.speak(u);
            }, 50);
        } else {
            if (forceBrowser && !this.voice) {
                console.warn("Browser voice forced but not found.");
                return;
            }
            await this._speakCloud(text);
        }
    }

    async _speakCloud(text) {
        if (!this.googleApiKey || this.googleApiKey.includes("HIER")) return;

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleApiKey}`;
        const payload = {
            input: { text: text },
            voice: { languageCode: "vi-VN", name: "vi-VN-Neural2-A" },
            audioConfig: { audioEncoding: "MP3" }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.audioContent) {
                const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
                audio.play();
            }
        } catch (err) {
            console.error("Cloud TTS failed:", err);
        }
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

    startBinaural() {
        if (!this.ctx) return;
        this.stopBinaural();
        const typeCfg = this.config.binaural[this.state.binauralType];
        if (!typeCfg || typeCfg.freq === 0) return;
        const baseFreq = 200;
        const beatFreq = typeCfg.freq;
        let vol = this.state.binauralVolume;
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
        this.oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch(e) {} });
        this.oscs = [];
        if (this.binauralGainNode) {
            this.binauralGainNode.disconnect();
            this.binauralGainNode = null;
        }
    }

    _loadTrack() {
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
