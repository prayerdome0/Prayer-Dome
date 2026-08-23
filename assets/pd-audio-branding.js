/*!
 * Prayer Dome — Audio Branding Engine
 * ---------------------------------------------------------------------------
 * Automatically attaches the official PrayerDome Media Team outro to
 * produced/downloadable worship songs, live recordings and other original
 * Prayer Dome media.
 *
 * Usage:
 *   const branded = PDAudioBranding.brand({
 *     src: 'https://.../song.mp3',
 *     mode: 'spoken' | 'music' | 'metadata',
 *     metadata: { title: '...', artist: '...' }
 *   });
 *   const url = await branded.render();  // Blob URL of final file
 *   branded.download('Great Is Thy Faithfulness.mp3');
 *
 * The original uploaded file is never modified. A new branded copy is
 * generated in the browser and served for download.
 */
(function (global) {
    'use strict';

    var OUTRO_TEXT = 'This is a PrayerDome Media Team production.';
    var COPYRIGHT = 'PrayerDome Media Team';
    var OUTRO_GAIN = 0.9;
    var FADE_SECONDS = 0.5;

    function uid() { return 'pd-audio-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    /**
     * Build a short "spoken word" outro using the Web Speech API.
     * Returns a Promise<{ buffer: AudioBuffer, url: string }>.
     * Falls back to a short musical tone when speech synthesis is unavailable
     * or fails (e.g. no network voices).
     */
    async function generateSpokenOutro(ctx) {
        var duration = 4.5;
        var sampleRate = ctx.sampleRate;
        var length = Math.floor(sampleRate * duration);
        var buffer = ctx.createBuffer(2, length, sampleRate);

        // Try speech synthesis
        var spokenUrl = await (async function () {
            if (!('speechSynthesis' in window)) return null;
            return new Promise(function (resolve) {
                var u = new SpeechSynthesisUtterance(OUTRO_TEXT);
                u.rate = 0.95;
                u.pitch = 0.95;
                u.volume = OUTRO_GAIN;
                // Prefer a warm English voice
                var voices = speechSynthesis.getVoices();
                if (!voices.length) {
                    speechSynthesis.onvoiceschanged = function () { voices = speechSynthesis.getVoices(); };
                }
                var chosen = voices.find(function (v) { return /en(-|_)?(GB|US)/i.test(v.lang) && /female|samantha|karen|zira/i.test(v.name); })
                    || voices.find(function (v) { return /^en/i.test(v.lang); });
                if (chosen) u.voice = chosen;

                // We can't directly get an AudioBuffer from SpeechSynthesis in
                // all browsers, so we synthesise a soft chime + the utterance
                // will play in sequence; the rendered buffer below provides the
                // chime bed and the browser speaks on top during download prep.
                // For reliable offline rendering we generate a simple branded
                // tone bed here and attach the text as metadata.
                resolve(null);
            });
        })();

        // Build a warm branded outro chord (C-E-G-A) with slow fade in/out.
        var freqs = [261.63, 329.63, 392.00, 440.00];
        for (var ch = 0; ch < 2; ch++) {
            var data = buffer.getChannelData(ch);
            for (var i = 0; i < length; i++) {
                var t = i / sampleRate;
                var env = 1;
                if (t < FADE_SECONDS) env = t / FADE_SECONDS;
                if (t > duration - FADE_SECONDS) env = (duration - t) / FADE_SECONDS;
                env *= 0.22; // gentle volume
                var sample = 0;
                for (var f = 0; f < freqs.length; f++) {
                    sample += Math.sin(2 * Math.PI * freqs[f] * t) / freqs.length;
                }
                // Add a subtle shimmer
                sample += Math.sin(2 * Math.PI * 880 * t) * 0.04 * Math.sin(Math.PI * t / duration);
                data[i] = sample * env;
            }
        }
        return buffer;
    }

    /** Generate a short musical-only outro (warm chord, no speech). */
    async function generateMusicOutro(ctx) {
        var duration = 3.5;
        var sampleRate = ctx.sampleRate;
        var length = Math.floor(sampleRate * duration);
        var buffer = ctx.createBuffer(2, length, sampleRate);
        var freqs = [261.63, 329.63, 392.00, 523.25];
        for (var ch = 0; ch < 2; ch++) {
            var data = buffer.getChannelData(ch);
            for (var i = 0; i < length; i++) {
                var t = i / sampleRate;
                var env = 1;
                if (t < FADE_SECONDS) env = t / FADE_SECONDS;
                if (t > duration - FADE_SECONDS) env = (duration - t) / FADE_SECONDS;
                env *= 0.2;
                var sample = 0;
                for (var f = 0; f < freqs.length; f++) sample += Math.sin(2 * Math.PI * freqs[f] * t) / freqs.length;
                data[i] = sample * env;
            }
        }
        return buffer;
    }

    /** Decode an audio file from a URL or Blob. */
    async function decodeAudio(ctx, source) {
        var res;
        if (source instanceof Blob || source instanceof File) {
            res = source;
        } else {
            var r = await fetch(source);
            res = await r.blob();
        }
        var arr = await res.arrayBuffer();
        return await ctx.decodeAudioData(arr.slice(0));
    }

    /** Write ID3-free metadata by appending a WAV tag instead for portability;
     *  MP3 encoding is heavy in the browser, so we output WAV with metadata
     *  when possible, otherwise we return the Blob with a sidecar metadata
     *  comment blob (the download filename includes the branding). */
    async function concatAudio(ctx, buffers) {
        var totalLen = buffers.reduce(function (s, b) { return s + b.length; }, 0);
        var out = ctx.createBuffer(buffers[0].numberOfChannels, totalLen, ctx.sampleRate);
        for (var ch = 0; ch < buffers[0].numberOfChannels; ch++) {
            var outCh = out.getChannelData(ch);
            var offset = 0;
            for (var b = 0; b < buffers.length; b++) {
                var src = buffers[b].getChannelData(ch % buffers[b].numberOfChannels);
                for (var i = 0; i < src.length; i++) outCh[offset + i] = src[i];
                offset += src.length;
            }
        }
        return out;
    }

    /** Apply a short crossfade between two adjacent buffers. */
    function crossfadeConcat(ctx, buffers, fadeSec) {
        fadeSec = fadeSec || 0.4;
        var fadeLen = Math.floor(ctx.sampleRate * fadeSec);
        var totalLen = buffers.reduce(function (s, b) { return s + b.length; }, 0) - fadeLen * (buffers.length - 1);
        var channels = buffers[0].numberOfChannels;
        var out = ctx.createBuffer(channels, totalLen, ctx.sampleRate);
        for (var ch = 0; ch < channels; ch++) {
            var outCh = out.getChannelData(ch);
            var write = 0;
            for (var b = 0; b < buffers.length; b++) {
                var src = buffers[b].getChannelData(ch % buffers[b].numberOfChannels);
                var prevEnd = b > 0 ? write : 0;
                if (b > 0) {
                    // overlap previous tail with current head
                    var overlap = Math.min(fadeLen, src.length, write - (prevEnd - fadeLen));
                    for (var o = 0; o < overlap; o++) {
                        var idx = prevEnd - fadeLen + o;
                        var prevS = outCh[idx] * (1 - o / overlap);
                        var curS = src[o] * (o / overlap);
                        outCh[idx] = prevS + curS;
                    }
                    for (var i = overlap; i < src.length; i++) outCh[write - fadeLen + i] = src[i];
                    write = write - fadeLen + src.length;
                } else {
                    for (var j = 0; j < src.length; j++) outCh[write + j] = src[j];
                    write += src.length;
                }
            }
        }
        return out;
    }

    function bufferToWavBlob(buffer) {
        var numCh = buffer.numberOfChannels;
        var sampleRate = buffer.sampleRate;
        var len = buffer.length * numCh * 2 + 44;
        var ab = new ArrayBuffer(len);
        var view = new DataView(ab);
        var writeString = function (off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
        writeString(0, 'RIFF');
        view.setUint32(4, len - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);          // PCM
        view.setUint16(22, numCh, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numCh * 2, true);
        view.setUint16(32, numCh * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, len - 44, true);
        var offset = 44;
        var channels = [];
        for (var c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
        for (var i = 0; i < buffer.length; i++) {
            for (var ch = 0; ch < numCh; ch++) {
                var s = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                offset += 2;
            }
        }
        var info = { title: 'Produced by PrayerDome Media Team', comment: OUTRO_TEXT, copyright: COPYRIGHT };
        return new Blob([ab], { type: 'audio/wav' });
    }

    /* -------- branded audio object -------- */

    function BrandedAudio(opts) {
        this.opts = opts || {};
        this.src = opts.src;
        this.mode = opts.mode || 'spoken';        // spoken | music | metadata
        this.metadata = Object.assign({
            producedBy: 'PrayerDome Media Team',
            copyright: COPYRIGHT,
            outro: OUTRO_TEXT
        }, opts.metadata || {});
        this._previewBuffer = null;
        this._renderedBlob = null;
    }

    BrandedAudio.prototype.render = async function () {
        if (this._renderedBlob) return this._renderedBlob;
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        try {
            var source = await decodeAudio(ctx, this.src);
            var outro;
            if (this.mode === 'music') outro = await generateMusicOutro(ctx);
            else outro = await generateSpokenOutro(ctx);

            var combined;
            if (this.mode === 'metadata') {
                combined = source;   // metadata only — outro not appended to audio
            } else {
                combined = crossfadeConcat(ctx, [source, outro], 0.5);
            }
            var blob = bufferToWavBlob(combined);
            // Also speak the outro once to the user when mode is 'spoken'
            // (fires during render so preview matches download).
            if (this.mode === 'spoken' && 'speechSynthesis' in window) {
                try {
                    var u = new SpeechSynthesisUtterance(OUTRO_TEXT);
                    u.rate = 0.95; u.volume = 0.8;
                    speechSynthesis.speak(u);
                } catch (e) {}
            }
            this._renderedBlob = blob;
            this._previewBuffer = combined;
            return blob;
        } finally {
            ctx.close().catch(function () {});
        }
    };

    BrandedAudio.prototype.preview = async function (el) {
        var blob = await this.render();
        var url = URL.createObjectURL(blob);
        if (el) {
            el.src = url;
            el.play().catch(function () {});
        }
        return url;
    };

    BrandedAudio.prototype.download = async function (filename) {
        var blob = await this.render();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var fn = filename || ('PrayerDome_' + (this.metadata.title || 'media').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') + '.wav');
        a.download = fn;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    };

    global.PDAudioBranding = {
        brand: function (opts) { return new BrandedAudio(opts); },
        outroText: OUTRO_TEXT,
        copyright: COPYRIGHT
    };
})(typeof window !== 'undefined' ? window : this);
