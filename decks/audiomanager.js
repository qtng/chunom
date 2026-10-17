/**
 * AUDIO MANAGER (Stable Routing Version with Cloud Fallback)
 * https://qtng.github.io/chunom/decks/audiomanager.js
 * Call initMusicEngine() to use background audio and binaural beats.
 * To only use speak(str, mode='auto', rate=0.8), don't call initMusicEngine().
 */

// Recorded syllables: chunom-assets/audio/tts/vi-VN-Standard-A/<name>.mp3 (made by tools/make_tts.py).
// <name> is the syllable in Telex letters (â=aa ê=ee ô=oo ă=aw ơ=ow ư=uw đ=dd) followed by the tone digit
// 0 ngang, 1 sắc, 2 huyền, 3 hỏi, 4 ngã, 5 nặng: tân = taan0, việt = vieet5. tools/make_tts.py has the same rule.
const TTS_DIR = new URL('../../chunom-assets/audio/tts/vi-VN-Standard-A/', document.currentScript ? document.currentScript.src : location.href);
function syllableFileName(text) {
    const TONE = { '\u0300': 2, '\u0301': 1, '\u0309': 3, '\u0303': 4, '\u0323': 5 };
    const MARK = { '\u0302': 'a', '\u0306': 'w', '\u031B': 'w' }; // circumflex, breve, horn
    let out = '', tone = 0;
    const s = String(text).trim().toLowerCase().normalize('NFC').replace(/đ/g, 'd\u0000');
    if (!/^[a-zà-ỹ\u0000]+$/.test(s)) return null; // a single syllable only
    for (const c of s.normalize('NFD')) {
        if (c === '\u0000') out += 'd';                 // the second d of dd
        else if (c in TONE) tone = TONE[c];
        else if (c in MARK) out += (c === '\u0302' ? out.slice(-1) : 'w');
        else if (/[a-z]/.test(c)) out += c;
        else return null;
    }
    return out + tone;
}

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
        const defaultApiKey = "AIzaSyBI69AC7hLhMfX5gGEw1npY_-Na9V6MdaU";
        this.googleApiKey = initialState.googleApiKey || defaultApiKey;
        
        this.el.crossOrigin = "anonymous";

        // Crossfade: config.crossfadeAfter (seconds of playing time after which the next song is faded in; 0 = off)
        // and config.crossfadeDuration (seconds the fade lasts). A song that ends sooner is faded out at its end.
        this.crossfadeAfter = parseFloat(config.crossfadeAfter) || 0;
        this.crossfadeDuration = parseFloat(config.crossfadeDuration) || 4;
        this.fading = false;
        this._fadeTimer = null;
        this.el1 = audioEl;
        this.el2 = new Audio();
        this.el2.crossOrigin = "anonymous";
        this.el2.preload = "auto";

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
        
        this._bindElement(this.el1);
        this._bindElement(this.el2);
    }

    _bindElement(el) {
        // only the song that is playing counts; the one fading out is stopped by the fade itself
        el.onended = () => { if (el === this.el && !this.fading) this.nextTrack(); };
        el.ontimeupdate = () => {
            if (el !== this.el || this.fading || !this.state.isMusicOn || !this.crossfadeAfter || !this.gains) return;
            const left = isFinite(el.duration) ? el.duration - el.currentTime : Infinity;
            if (el.currentTime >= this.crossfadeAfter || left <= this.crossfadeDuration) this._crossfadeToNext();
        };
    }

    on(evt, fn) { this.events.on(evt, fn); }

    initMusicEngine() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterCompressor = this.ctx.createDynamicsCompressor();
            this.masterCompressor.threshold.setValueAtTime(-15, this.ctx.currentTime);
            this.masterCompressor.connect(this.ctx.destination);

            if (!this.sourceAttached) {
                // each element gets its own gain, so that one can fade out while the other fades in
                this.gains = new Map();
                for (const el of [this.el1, this.el2]) {
                    const gain = this.ctx.createGain();
                    gain.gain.value = (el === this.el1) ? 1 : 0;
                    this.ctx.createMediaElementSource(el).connect(gain);
                    gain.connect(this.masterCompressor);
                    this.gains.set(el, gain);
                }
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

        // a recorded syllable first, the same voice everywhere; anything else (or a missing file) as before
        if (mode === 'auto') {
            const name = syllableFileName(text);
            if (name && await this.playRecorded(new URL(name + '.mp3', TTS_DIR).href)) return;
        }

        if (!this.voice && window.speechSynthesis) {
            this.voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('vi'));
        }

        const forceCloud = (mode === 'cloud');
        const forceBrowser = (mode === 'browser');

        if (!forceCloud && (forceBrowser || mode === 'auto') && this.voice) {
            // resolves when the voice has finished (or was stopped), like the recorded and the cloud voice
            return new Promise(resolve => setTimeout(() => {
                const u = new SpeechSynthesisUtterance(text);
                u.voice = this.voice;
                u.lang = 'vi-VN';
                u.rate = rate;
                u.onend = u.onerror = () => resolve();
                this.stopSpeech();
                speechSynthesis.speak(u);
            }, 50));
        } else {
            if (forceBrowser && !this.voice) {
                console.warn("Browser voice forced but not found.");
                return;
            }
            await this.speakCloud(text);
        }
    }

    // resolves true if the file was played, false if it is missing or cannot be played
    playRecorded(url) {
        return new Promise(resolve => {
            const audio = new Audio(url);
            let started = false;
            audio.onplaying = () => { started = true; this.stopSpeech(); this.currentCloudAudio = audio; };
            audio.onended = () => { this.currentCloudAudio = null; resolve(true); };
            audio.onerror = () => resolve(started);
            audio.play().catch(() => resolve(false));
        });
    }

    async speakCloud(text, lang= "vi-VN", voice = "vi-VN-Standard-A", ssml = false) {
        if (!this.googleApiKey) return;

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleApiKey}`;
        const input = !ssml ? {text: text} : {ssml: text};
        const payload = {
            input: input,
            voice: { languageCode: lang || "vi-VN", name: voice || "vi-VN-Standard-A" },
            audioConfig: { audioEncoding: "MP3" }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!response.ok) {
                console.error(`Google Cloud TTS API error (HTTP ${response.status}):`, result.error || result);
                return;
            }

            if (result.audioContent) {
                return new Promise((resolve) => {
                    const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
                    this.currentCloudAudio = audio;
                    audio.onended = () => {
                        this.currentCloudAudio = null;
                        resolve();
                    };
                    audio.onerror = () => {
                        this.currentCloudAudio = null;
                        resolve();
                    };
                    this.stopSpeech();
                    audio.play().catch(resolve);
                });
            }
            else {
                console.warn("Google TTS response had no audioContent:", result);
            }
        } catch (err) {
            console.error("Cloud TTS failed:", err);
        }
    }

    stopSpeech() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        if (this.currentCloudAudio) {
            this.currentCloudAudio.pause();
            this.currentCloudAudio.currentTime = 0;
            this.currentCloudAudio = null;
        }
    }

    toggleMusic() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
        this.state.isMusicOn = !this.state.isMusicOn;
        if (this.state.isMusicOn) {
            this.el.play().catch(() => {});
            if (this.fading) this.el2.play().catch(() => {}); // the one fading out; the fade timer ends it
        } else {
            this.el.pause();
            this.el2.pause();
        }
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

    _trackUrl(idx) {
        return `../../chunom-assets/audio/SoundHelix-Song-${this.config.playlist[idx]}.mp3`;
    }

    // Fade the next song in while the current one fades out (equal power).
    _crossfadeToNext() {
        if (this.fading) return;
        this.fading = true;
        const out = this.el, inn = (out === this.el1) ? this.el2 : this.el1;
        const gOut = this.gains.get(out), gIn = this.gains.get(inn);
        this.state.currentTrackIdx = (this.state.currentTrackIdx + 1) % this.config.playlist.length;
        inn.pause();
        inn.src = this._trackUrl(this.state.currentTrackIdx);
        inn.currentTime = 0;
        const start = () => {
            inn.onerror = null;
            const t = this.ctx.currentTime, d = this.crossfadeDuration, n = 64;
            const up = new Float32Array(n), down = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                const x = i / (n - 1);
                up[i] = Math.sin(x * Math.PI / 2);
                down[i] = Math.cos(x * Math.PI / 2);
            }
            for (const [g, curve] of [[gIn, up], [gOut, down]]) {
                g.gain.cancelScheduledValues(t);
                g.gain.setValueAtTime(curve[0], t);
                g.gain.setValueCurveAtTime(curve, t, d);
            }
            this.el = inn;   // the new song is the current one from now on
            inn.play().catch(() => {});
            this._notify();
            this._fadeTimer = setTimeout(() => {
                out.pause();
                this._fadeTimer = null;
                this.fading = false;
            }, d * 1000 + 50);
        };
        inn.oncanplay = () => { inn.oncanplay = null; start(); };
        inn.onerror = () => { inn.onerror = null; this.fading = false; this.nextTrack(); }; // could not load: plain switch
        inn.load();
    }

    _loadTrack() {
        // a plain switch ends a fade that is running
        if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
        this.fading = false;
        for (const el of [this.el1, this.el2]) if (el !== this.el) el.pause();
        if (this.gains) {
            const t = this.ctx.currentTime;
            for (const [el, g] of this.gains) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(el === this.el ? 1 : 0, t); }
        }
        this.el.pause();
        this.el.src = this._trackUrl(this.state.currentTrackIdx);
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
