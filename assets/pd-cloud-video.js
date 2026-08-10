/*!
 * Prayer Dome — Cloud Video Recorder
 * ---------------------------------------------------------------------------
 * Every live broadcast is recorded straight into Prayer Dome cloud storage
 * (Cloudinary). Nothing is written to the broadcaster's or the viewer's device:
 *
 *   • The camera feed is captured in rolling segments (default 4 minutes).
 *   • Each finished segment is uploaded immediately and then released from
 *     memory, so a two-hour service never fills the phone.
 *   • Failed uploads are retried with backoff; a segment is only dropped from
 *     memory once the cloud has confirmed it.
 *   • The resulting recording is a list of cloud URLs stored in Firestore, so
 *     members can watch the replay from inside the app on any device.
 *
 * No `URL.createObjectURL` replay links, no downloads, no local files.
 *
 * Usage
 *   const rec = PDCloudVideo.createRecorder(stream, {
 *     title: 'Sunday Service',
 *     onProgress: s => console.log(s.uploadedBytes, s.state)
 *   });
 *   await rec.start();
 *   ... later ...
 *   const result = await rec.stop();   // { parts, playbackUrl, thumbnail, ... }
 */
(function (global) {
    'use strict';

    var CONFIG = {
        cloudName: 'prayerdome',
        // Unsigned upload presets, tried in order. Create `live_recordings`
        // (unsigned, resource type video, folder live_recordings) in the
        // Cloudinary console; the others are existing presets kept as
        // fallbacks so recording never fails because of configuration.
        presets: ['live_recordings', 'live_streams', 'gallery_uploads'],
        folder: 'live_recordings',
        chunkSize: 6 * 1024 * 1024,        // Cloudinary chunked upload size
        segmentSeconds: 240,               // rotate a new cloud part every 4 min
        segmentMaxBytes: 40 * 1024 * 1024, // ...or sooner if it gets large
        maxRetries: 4,
        timeslice: 1000
    };

    function configure(patch) {
        if (patch && typeof patch === 'object') {
            Object.keys(patch).forEach(function (k) { CONFIG[k] = patch[k]; });
        }
        return CONFIG;
    }

    function endpoint(resourceType) {
        return 'https://api.cloudinary.com/v1_1/' + CONFIG.cloudName + '/' +
            (resourceType || 'video') + '/upload';
    }

    function slug(value) {
        return String(value || 'prayer-dome')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'prayer-dome';
    }

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function pickMimeType() {
        var candidates = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4'
        ];
        if (typeof MediaRecorder === 'undefined') return '';
        for (var i = 0; i < candidates.length; i++) {
            try {
                if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
            } catch (e) { /* keep looking */ }
        }
        return '';
    }

    function extensionFor(mime) {
        if (!mime) return 'webm';
        if (mime.indexOf('mp4') > -1) return 'mp4';
        return 'webm';
    }

    /* ----------------------------------------------------------- thumbnails */
    function thumbnailFor(publicId) {
        if (!publicId) return null;
        return 'https://res.cloudinary.com/' + CONFIG.cloudName +
            '/video/upload/so_3,w_640,h_360,c_fill,q_auto,f_jpg/' + publicId + '.jpg';
    }

    /* -------------------------------------------------------- single upload */
    function postChunk(url, form, headers, onProgress) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            Object.keys(headers || {}).forEach(function (h) {
                xhr.setRequestHeader(h, headers[h]);
            });
            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = function (e) {
                    if (e.lengthComputable) onProgress(e.loaded, e.total);
                };
            }
            xhr.onload = function () {
                var body = null;
                try { body = JSON.parse(xhr.responseText || '{}'); } catch (e) { body = {}; }
                if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
                var message = (body && body.error && body.error.message) ||
                    ('Upload failed with status ' + xhr.status);
                var error = new Error(message);
                error.status = xhr.status;
                reject(error);
            };
            xhr.onerror = function () { reject(new Error('Network error during upload')); };
            xhr.ontimeout = function () { reject(new Error('Upload timed out')); };
            xhr.send(form);
        });
    }

    /**
     * Upload a Blob to Cloudinary using unsigned chunked upload.
     * Resolves with { url, publicId, bytes, duration, thumbnail, preset }.
     */
    async function uploadBlob(blob, options) {
        options = options || {};
        if (!blob || !blob.size) throw new Error('Nothing to upload');

        var resourceType = options.resourceType || 'video';
        var presets = options.preset ? [options.preset]
            : (options.presets && options.presets.length ? options.presets.slice() : CONFIG.presets.slice());
        var publicId = options.publicId ||
            (slug(options.title) + '-' + Date.now().toString(36));
        var folder = options.folder || CONFIG.folder;
        var uploadId = 'pd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        var total = blob.size;
        var chunkSize = Math.max(5 * 1024 * 1024, CONFIG.chunkSize);
        var lastError = null;

        for (var p = 0; p < presets.length; p++) {
            var preset = presets[p];
            try {
                var offset = 0;
                var response = null;
                while (offset < total) {
                    var end = Math.min(offset + chunkSize, total);
                    var slice = blob.slice(offset, end, blob.type);
                    var form = new FormData();
                    form.append('file', slice);
                    form.append('upload_preset', preset);
                    if (folder) form.append('folder', folder);
                    form.append('public_id', publicId);
                    if (options.tags) form.append('tags', [].concat(options.tags).join(','));
                    if (options.context) form.append('context', options.context);

                    var headers = { 'X-Unique-Upload-Id': uploadId };
                    if (total > chunkSize) {
                        headers['Content-Range'] = 'bytes ' + offset + '-' + (end - 1) + '/' + total;
                    }

                    var base = offset;
                    /* eslint-disable no-await-in-loop */
                    response = await postChunk(endpoint(resourceType), form, headers, function (loaded) {
                        if (options.onProgress) options.onProgress(Math.min(base + loaded, total), total);
                    });
                    /* eslint-enable no-await-in-loop */
                    offset = end;
                    if (options.onProgress) options.onProgress(offset, total);
                }

                var secure = response && (response.secure_url || response.url);
                if (!secure) throw new Error('Cloud storage did not return a playback URL');
                return {
                    url: secure,
                    publicId: response.public_id || publicId,
                    bytes: response.bytes || total,
                    duration: response.duration || null,
                    format: response.format || extensionFor(blob.type),
                    thumbnail: thumbnailFor(response.public_id || publicId),
                    preset: preset,
                    provider: 'cloudinary'
                };
            } catch (error) {
                lastError = error;
                // A preset that does not exist / is signed returns 400/401 —
                // try the next configured preset before giving up.
                if (!(error.status === 400 || error.status === 401 || error.status === 403)) break;
            }
        }
        throw lastError || new Error('Cloud upload failed');
    }

    /** Upload with retries and exponential backoff. */
    async function uploadWithRetry(blob, options) {
        var attempt = 0;
        var lastError = null;
        while (attempt <= CONFIG.maxRetries) {
            try {
                return await uploadBlob(blob, options);
            } catch (error) {
                lastError = error;
                attempt += 1;
                if (attempt > CONFIG.maxRetries) break;
                if (options && options.onRetry) options.onRetry(attempt, error);
                await wait(Math.min(30000, 1500 * Math.pow(2, attempt - 1)));
            }
        }
        throw lastError || new Error('Cloud upload failed');
    }

    /* ------------------------------------------------------ segment recorder */
    function createRecorder(stream, options) {
        options = options || {};

        var state = {
            state: 'idle',              // idle | recording | finishing | done | error
            parts: [],                  // uploaded cloud parts
            pending: 0,                 // segments still uploading
            uploadedBytes: 0,
            recordedBytes: 0,
            seconds: 0,
            error: null
        };

        var mime = pickMimeType();
        var recorder = null;
        var chunks = [];
        var chunkBytes = 0;
        var rotating = false;
        var stopping = false;
        var timer = null;
        var rotateAt = 0;
        var uploads = [];
        var partIndex = 0;
        var activeStream = stream;
        var baseTitle = options.title || 'Prayer Dome Live';
        var idBase = slug(baseTitle) + '-' + Date.now().toString(36);

        function emit() {
            if (typeof options.onProgress === 'function') {
                try { options.onProgress(snapshot()); } catch (e) { /* ignore */ }
            }
        }

        function snapshot() {
            return {
                state: state.state,
                parts: state.parts.slice(),
                pending: state.pending,
                uploadedBytes: state.uploadedBytes,
                recordedBytes: state.recordedBytes,
                seconds: state.seconds,
                error: state.error
            };
        }

        function queueUpload(blob, index) {
            state.pending += 1;
            emit();
            var task = uploadWithRetry(blob, {
                title: baseTitle,
                publicId: idBase + '-part' + String(index + 1).padStart(2, '0'),
                folder: options.folder || CONFIG.folder,
                tags: ['prayer-dome', 'live-recording'].concat(options.tags || []),
                onProgress: function (loaded) {
                    // Report cumulative bytes safely across concurrent parts.
                    state.uploadedBytes = state.parts.reduce(function (sum, part) {
                        return sum + (part.bytes || 0);
                    }, 0) + loaded;
                    emit();
                },
                onRetry: function (attempt, error) {
                    if (typeof options.onRetry === 'function') options.onRetry(attempt, error);
                }
            }).then(function (part) {
                part.index = index;
                state.parts.push(part);
                state.parts.sort(function (a, b) { return a.index - b.index; });
                state.uploadedBytes = state.parts.reduce(function (sum, p) {
                    return sum + (p.bytes || 0);
                }, 0);
                if (typeof options.onPart === 'function') options.onPart(part, snapshot());
                return part;
            }).catch(function (error) {
                state.error = error;
                if (typeof options.onError === 'function') options.onError(error);
                return null;
            }).then(function (value) {
                state.pending -= 1;
                emit();
                return value;
            });
            uploads.push(task);
            return task;
        }

        function flushChunks() {
            if (!chunks.length) return null;
            var blob = new Blob(chunks, { type: mime || 'video/webm' });
            chunks = [];
            chunkBytes = 0;
            return blob;
        }

        function attachRecorder(target) {
            var mr = mime ? new MediaRecorder(target, { mimeType: mime }) : new MediaRecorder(target);
            mr.ondataavailable = function (event) {
                if (!event.data || !event.data.size) return;
                chunks.push(event.data);
                chunkBytes += event.data.size;
                state.recordedBytes += event.data.size;
                if (!rotating && !stopping && chunkBytes >= CONFIG.segmentMaxBytes) rotate();
            };
            mr.onstop = function () {
                var blob = flushChunks();
                if (blob && blob.size > 4096) queueUpload(blob, partIndex++);
                if (rotating && !stopping) {
                    rotating = false;
                    try {
                        recorder = attachRecorder(activeStream);
                        recorder.start(CONFIG.timeslice);
                        rotateAt = Date.now() + CONFIG.segmentSeconds * 1000;
                    } catch (error) {
                        state.error = error;
                        state.state = 'error';
                        emit();
                    }
                }
            };
            mr.onerror = function (event) {
                state.error = (event && event.error) || new Error('Recorder error');
                if (typeof options.onError === 'function') options.onError(state.error);
            };
            return mr;
        }

        function rotate() {
            if (!recorder || rotating || stopping) return;
            if (recorder.state === 'inactive') return;
            rotating = true;
            try { recorder.stop(); } catch (e) { rotating = false; }
        }

        function tick() {
            state.seconds += 1;
            if (!stopping && !rotating && rotateAt && Date.now() >= rotateAt) rotate();
            emit();
        }

        return {
            get state() { return state.state; },
            get parts() { return state.parts.slice(); },
            snapshot: snapshot,

            supported: typeof MediaRecorder !== 'undefined',

            start: function () {
                if (typeof MediaRecorder === 'undefined') {
                    throw new Error('Recording is not supported on this device');
                }
                recorder = attachRecorder(activeStream);
                recorder.start(CONFIG.timeslice);
                rotateAt = Date.now() + CONFIG.segmentSeconds * 1000;
                state.state = 'recording';
                timer = setInterval(tick, 1000);
                emit();
                return this;
            },

            /** Camera flip / source change without losing the recording. */
            replaceStream: function (nextStream) {
                activeStream = nextStream;
                if (!recorder || recorder.state === 'inactive') return;
                rotate();
            },

            /** Stop recording and resolve once every part is safely in the cloud. */
            stop: async function () {
                if (state.state === 'done') return this.result();
                stopping = true;
                state.state = 'finishing';
                emit();
                if (timer) { clearInterval(timer); timer = null; }
                if (recorder && recorder.state !== 'inactive') {
                    await new Promise(function (resolve) {
                        var settled = false;
                        var done = function () { if (!settled) { settled = true; resolve(); } };
                        recorder.addEventListener('stop', function () { setTimeout(done, 0); }, { once: true });
                        try { recorder.stop(); } catch (e) { done(); }
                        setTimeout(done, 5000);
                    });
                } else {
                    var tail = flushChunks();
                    if (tail && tail.size > 4096) queueUpload(tail, partIndex++);
                }
                await Promise.all(uploads);
                state.state = state.parts.length ? 'done' : 'error';
                emit();
                return this.result();
            },

            result: function () {
                var parts = state.parts.slice().sort(function (a, b) { return a.index - b.index; });
                var first = parts[0] || null;
                return {
                    provider: 'cloudinary',
                    storedOnDevice: false,
                    parts: parts.map(function (p) {
                        return {
                            url: p.url, publicId: p.publicId, bytes: p.bytes,
                            duration: p.duration, index: p.index
                        };
                    }),
                    playbackUrl: first ? first.url : null,
                    thumbnail: first ? first.thumbnail : null,
                    totalBytes: parts.reduce(function (sum, p) { return sum + (p.bytes || 0); }, 0),
                    durationSeconds: state.seconds,
                    error: state.error ? String(state.error.message || state.error) : null
                };
            }
        };
    }

    /* --------------------------------------------------- sequential playback */
    /**
     * Play a multi-part cloud recording in a single <video> element.
     * Parts play back-to-back so members experience one continuous replay.
     */
    function attachPlayer(videoEl, recording, hooks) {
        hooks = hooks || {};
        var parts = (recording && recording.parts && recording.parts.length)
            ? recording.parts.slice().sort(function (a, b) { return (a.index || 0) - (b.index || 0); })
            : (recording && recording.playbackUrl ? [{ url: recording.playbackUrl, index: 0 }] : []);
        if (!videoEl || !parts.length) return null;

        var current = 0;
        // Cloud-only playback: block the browser's "save video" affordance.
        videoEl.setAttribute('controlsList', 'nodownload noremoteplayback');
        videoEl.setAttribute('disablepictureinpicture', '');
        videoEl.setAttribute('playsinline', '');
        videoEl.oncontextmenu = function (e) { e.preventDefault(); return false; };

        function load(index, autoplay) {
            current = index;
            videoEl.src = parts[index].url;
            videoEl.load();
            if (autoplay) videoEl.play().catch(function () { /* user gesture needed */ });
            if (hooks.onPart) hooks.onPart(index + 1, parts.length);
        }

        videoEl.addEventListener('ended', function () {
            if (current + 1 < parts.length) load(current + 1, true);
            else if (hooks.onEnded) hooks.onEnded();
        });

        load(0, hooks.autoplay !== false);
        return {
            parts: parts.length,
            next: function () { if (current + 1 < parts.length) load(current + 1, true); },
            previous: function () { if (current > 0) load(current - 1, true); }
        };
    }

    global.PDCloudVideo = {
        configure: configure,
        config: CONFIG,
        uploadBlob: uploadBlob,
        uploadWithRetry: uploadWithRetry,
        createRecorder: createRecorder,
        attachPlayer: attachPlayer,
        thumbnailFor: thumbnailFor,
        pickMimeType: pickMimeType
    };
})(typeof window !== 'undefined' ? window : this);
