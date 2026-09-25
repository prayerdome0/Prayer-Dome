/*!
 * Prayer Dome — Native Media Upload
 * ---------------------------------------------------------------------------
 * Media picking and uploading the way members expect it to work:
 *
 *   CLICK UPLOAD  →  NATIVE DEVICE PICKER  →  PREVIEW  →  UPLOAD  →  DONE
 *
 * The device's own photo/file chooser opens directly (no third-party widget,
 * no separate "cloud page"). Storage and delivery are handled in the
 * background by the ministry's media service; members never see that layer.
 *
 * Usage:
 *   const res = await PDUpload.pick({
 *     title: 'Add a photo',
 *     accept: 'image/*',            // what the device picker offers
 *     multiple: false,
 *     preset: 'gallery_uploads',    // media service bucket
 *     folder: 'testimonies',
 *     maxBytes: 5 * 1024 * 1024
 *   });
 *   if (res.ok) console.log(res.files[0].url);
 *
 * A bare upload of File/Blob objects (used when a page already has the file,
 * e.g. from a canvas render) is available as PDUpload.upload(file, opts).
 */
(function (global) {
    'use strict';

    var CLOUD_NAME = 'prayerdome';
    var ENDPOINT = 'https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/auto/upload';

    // Preset fallbacks — mirrors the ministry's configured buckets. The first
    // preset that accepts the file wins, so uploads never fail because a
    // single bucket is missing on the media service.
    var PRESET_FALLBACKS = {
        'profile_photos': ['profile_photos', 'gallery_uploads', 'ml_default'],
        'gallery_uploads': ['gallery_uploads', 'ml_default'],
        'donation_proofs': ['donation_proofs', 'gallery_uploads', 'ml_default'],
        'news_images': ['news_images', 'gallery_uploads', 'ml_default'],
        'financial_reports': ['financial_reports', 'ml_default'],
        'live_streams': ['live_streams', 'ml_default'],
        'signatures': ['signatures', 'gallery_uploads', 'ml_default']
    };

    var activeModal = null;

    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function friendlyError(err) {
        var msg = (err && (err.message || err.error && err.error.message)) || String(err || '');
        if (/network|Failed to fetch|Load failed/i.test(msg)) {
            return 'No internet connection. Your upload will work once you are back online.';
        }
        if (/file size|too large|File too large/i.test(msg)) return 'That file is too large. Please choose a smaller one.';
        if (/format|not allowed|invalid/i.test(msg)) return 'That file type is not supported. Please try a different file.';
        if (/preset|unsigned/i.test(msg)) return 'Upload is temporarily unavailable. Please try again shortly.';
        return 'The upload did not go through. Please try again.';
    }

    function ensureStyles() {
        if (document.getElementById('pd-upload-styles')) return;
        var st = document.createElement('style');
        st.id = 'pd-upload-styles';
        st.textContent =
            '.pdu-overlay{position:fixed;inset:0;background:rgba(4,12,28,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:18px;animation:pduIn .22s ease}' +
            '@keyframes pduIn{from{opacity:0}to{opacity:1}}' +
            '.pdu-card{background:#fff;color:#0f172a;border-radius:22px;max-width:420px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 24px 70px rgba(0,0,0,.4);animation:pduPop .26s cubic-bezier(.2,.9,.3,1.2);font-family:Inter,system-ui,sans-serif}' +
            '@keyframes pduPop{from{transform:translateY(16px) scale(.96);opacity:0}to{transform:none;opacity:1}}' +
            '.pdu-head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #eef1f6;position:sticky;top:0;background:#fff;border-radius:22px 22px 0 0}' +
            '.pdu-head img{width:30px;height:30px;border-radius:8px;object-fit:contain}' +
            '.pdu-head h3{margin:0;font-size:.98rem;font-weight:800;flex:1;color:#0A4D9B}' +
            '.pdu-close{border:0;background:#f1f4f9;width:32px;height:32px;border-radius:50%;cursor:pointer;color:#475569;font-size:.9rem}' +
            '.pdu-body{padding:16px 18px}' +
            '.pdu-preview{border-radius:16px;overflow:hidden;background:#0b1830;margin-bottom:14px;display:flex;align-items:center;justify-content:center;min-height:140px;max-height:260px}' +
            '.pdu-preview img{width:100%;height:100%;object-fit:contain;max-height:260px}' +
            '.pdu-preview video{width:100%;max-height:260px}' +
            '.pdu-filemeta{display:flex;align-items:center;gap:10px;background:#f6f8fc;border-radius:14px;padding:10px 14px;margin-bottom:14px;font-size:.82rem;color:#334155}' +
            '.pdu-filemeta i{color:#0A4D9B}' +
            '.pdu-filemeta .pdu-size{margin-left:auto;color:#64748b;font-weight:700;white-space:nowrap}' +
            '.pdu-progress{height:10px;border-radius:50px;background:#e8edf5;overflow:hidden;margin:6px 0 6px}' +
            '.pdu-progress>div{height:100%;width:0;border-radius:50px;background:linear-gradient(90deg,#0A4D9B,#3b82f6);transition:width .25s ease}' +
            '.pdu-progress-label{display:flex;justify-content:space-between;font-size:.78rem;color:#64748b;margin-bottom:14px;font-weight:600}' +
            '.pdu-error{display:none;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:12px;padding:10px 12px;font-size:.82rem;margin-bottom:12px}' +
            '.pdu-error.show{display:block}' +
            '.pdu-actions{display:flex;gap:10px;padding:0 18px 18px}' +
            '.pdu-btn{flex:1;border:0;border-radius:14px;padding:13px 16px;font-weight:800;font-size:.88rem;cursor:pointer;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease}' +
            '.pdu-btn:active{transform:scale(.97)}' +
            '.pdu-btn-primary{background:linear-gradient(135deg,#0A4D9B,#1257ac);color:#fff;box-shadow:0 8px 22px rgba(10,77,155,.35)}' +
            '.pdu-btn-ghost{background:#f1f4f9;color:#0A4D9B}' +
            '.pdu-btn:disabled{opacity:.55;cursor:wait}' +
            '.pdu-brand{display:flex;align-items:center;justify-content:center;gap:6px;font-size:.68rem;color:#94a3b8;padding:0 0 14px;font-weight:600;letter-spacing:.4px}' +
            '.pdu-badge{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#07244d;color:#fff;padding:10px 18px;border-radius:50px;font-size:.8rem;font-weight:700;z-index:99998;box-shadow:0 12px 30px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;animation:pduPop .25s ease;font-family:Inter,system-ui,sans-serif}' +
            '.pdu-badge i{color:#4DA3FF}' + (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ?
                '.pdu-card{background:#0d1b33;color:#e6eefb}.pdu-head{background:#0d1b33;border-color:#1c2c4d}.pdu-head h3{color:#9cc3f7}.pdu-close{background:#16253f;color:#b6c6e2}.pdu-filemeta{background:#13223c;color:#c7d5ec}.pdu-progress{background:#1a2a47}.pdu-progress-label,.pdu-size{color:#8fa3c4!important}.pdu-btn-ghost{background:#16253f;color:#9cc3f7}' : '');
        document.head.appendChild(st);
    }

    function showModal(opts, file, api) {
        ensureStyles();
        var overlay = document.createElement('div');
        overlay.className = 'pdu-overlay';
        var isImg = /^image\//.test(file.type);
        var isVid = /^video\//.test(file.type);
        var objectUrl = (isImg || isVid) ? URL.createObjectURL(file) : null;
        var previewHtml = '';
        if (isImg) previewHtml = '<div class="pdu-preview"><img alt="Selected image preview"></div>';
        else if (isVid) previewHtml = '<div class="pdu-preview"><video controls playsinline muted></video></div>';
        else previewHtml = '<div class="pdu-preview"><i class="pd-i pd-i-file" style="font-size:2.4rem;color:#4DA3FF"></i></div>';

        overlay.innerHTML =
            '<div class="pdu-card" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || 'Upload') + '">'
            + '<div class="pdu-head"><img src="/assets/logo.png" alt=""><h3>' + esc(opts.title || 'Upload') + '</h3>'
            + '<button class="pdu-close" type="button" aria-label="Close"><i class="pd-i pd-i-x"></i></button></div>'
            + '<div class="pdu-body">'
            + '<div class="pdu-error" id="pduError"></div>'
            + previewHtml
            + '<div class="pdu-filemeta"><i class="pd-i ' + (isVid ? 'pd-i-film' : isImg ? 'pd-i-image' : 'pd-i-file-text') + '"></i>'
            + '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(file.name || 'Selected file') + '</span>'
            + '<span class="pdu-size">' + api._fmtBytes(file.size) + '</span></div>'
            + '<div class="pdu-progress"><div id="pduBar"></div></div>'
            + '<div class="pdu-progress-label"><span id="pduState">Ready to upload</span><span id="pduPct">0%</span></div>'
            + '</div>'
            + '<div class="pdu-actions">'
            + '<button class="pdu-btn pdu-btn-ghost" id="pduCancel" type="button">Cancel</button>'
            + '<button class="pdu-btn pdu-btn-primary" id="pduGo" type="button"><i class="pd-i pd-i-cloud-upload"></i> Upload</button>'
            + '</div>'
            + '<div class="pdu-brand"><img src="/assets/logo.png" style="width:14px;height:14px;border-radius:4px" alt=""> Prayer Dome</div>'
            + '</div>';

        document.body.appendChild(overlay);
        activeModal = overlay;

        if (isImg) overlay.querySelector('.pdu-preview img').src = objectUrl;
        if (isVid) overlay.querySelector('.pdu-preview video').src = objectUrl;

        var bar = overlay.querySelector('#pduBar');
        var pct = overlay.querySelector('#pduPct');
        var state = overlay.querySelector('#pduState');
        var go = overlay.querySelector('#pduGo');
        var cancel = overlay.querySelector('#pduCancel');
        var closeBtn = overlay.querySelector('.pdu-close');
        var errBox = overlay.querySelector('#pduError');

        function setProgress(p) {
            p = Math.max(0, Math.min(100, Math.round(p)));
            bar.style.width = p + '%';
            pct.textContent = p + '%';
        }
        function showError(msg) {
            errBox.textContent = msg;
            errBox.classList.add('show');
            state.textContent = 'Upload failed';
            go.innerHTML = '<i class="pd-i pd-i-rotate-cw"></i> Try Again';
            go.disabled = false;
            cancel.textContent = 'Cancel';
        }

        var cancelled = false;
        var settled = false;
        function close() {
            if (settled) return;
            settled = true;
            cancelled = true;
            api._xhr = null;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (activeModal === overlay) activeModal = null;
            api._resolve({ ok: false, cancelled: true });
        }
        closeBtn.addEventListener('click', close);
        cancel.addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

        go.addEventListener('click', async function () {
            errBox.classList.remove('show');
            go.disabled = true;
            go.innerHTML = '<i class="pd-i pd-i-loader-circle pd-i-spin"></i> Uploading…';
            state.textContent = 'Uploading — ' + Math.round(0) + '%';
            try {
                var result = await api._uploadFile(file, {
                    preset: opts.preset,
                    folder: opts.folder,
                    onProgress: function (p) { setProgress(p); state.textContent = 'Uploading'; },
                    shouldAbort: function () { return cancelled; }
                });
                settled = true;
                setProgress(100);
                state.textContent = 'Upload complete';
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                overlay.querySelector('.pdu-card').style.transition = 'opacity .18s ease, transform .18s ease';
                var card = overlay.querySelector('.pdu-card');
                card.style.opacity = '0';
                card.style.transform = 'scale(.96)';
                setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); if (activeModal === overlay) activeModal = null; }, 190);
                overlay.addEventListener('click', function (e) { if (e.target === overlay) e.stopPropagation(); });
                api._resolve({ ok: true, files: [result] });
            } catch (err) {
                if (cancelled) { return; }
                showError(friendlyError(err));
            }
        });
    }

    function showBadge(text) {
        ensureStyles();
        var b = document.createElement('div');
        b.className = 'pdu-badge';
        b.innerHTML = '<i class="pd-i pd-i-loader-circle pd-i-spin"></i> ' + esc(text);
        document.body.appendChild(b);
        return function () { if (b.parentNode) b.parentNode.removeChild(b); };
    }

    function fmtBytes(n) {
        n = Number(n) || 0;
        if (n < 1024) return n + ' B';
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1048576).toFixed(1) + ' MB';
    }

    var api = {
        _fmtBytes: fmtBytes,
        _xhr: null,
        _resolve: function () {},

        /**
         * Upload a File/Blob directly (public API). Resolves the uploaded
         * file descriptor. Pages that already hold the file (from their own
         * <input> or a canvas render) use this.
         */
        upload: function (file, opts) {
            return this._uploadFile(file, opts || {});
        },

        /**
         * Upload a File/Blob to the media service with progress reporting.
         * Resolves with { url, publicId, bytes, format, name, resourceType }.
         */
        _uploadFile: function (file, opts) {
            opts = opts || {};
            var presets = PRESET_FALLBACKS[opts.preset] || [opts.preset || 'ml_default'];
            var self = api;
            return new Promise(function (resolve, reject) {
                var attempt = 0;
                var tryPreset = function () {
                    if (attempt >= presets.length) {
                        return reject(new Error('Upload failed'));
                    }
                    var preset = presets[attempt++];
                    var xhr = new XMLHttpRequest();
                    self._xhr = xhr;
                    var form = new FormData();
                    form.append('file', file);
                    form.append('upload_preset', preset);
                    if (opts.folder) form.append('folder', opts.folder);

                    xhr.open('POST', ENDPOINT, true);
                    xhr.upload.onprogress = function (e) {
                        if (e.lengthComputable && opts.onProgress) {
                            opts.onProgress((e.loaded / e.total) * 100);
                        }
                    };
                    xhr.onload = function () {
                        self._xhr = null;
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                var data = JSON.parse(xhr.responseText);
                                if (data.secure_url) {
                                    return resolve({
                                        url: data.secure_url,
                                        publicId: data.public_id || null,
                                        bytes: data.bytes || file.size || 0,
                                        format: data.format || (file.type || '').split('/')[1] || null,
                                        name: file.name || null,
                                        resourceType: data.resource_type || 'auto'
                                    });
                                }
                            } catch (e) { /* fall through */ }
                            return tryPreset();
                        }
                        // 401/400 usually means the preset rejects this file — try the next bucket.
                        if ((xhr.status === 400 || xhr.status === 401) && attempt < presets.length) return tryPreset();
                        var msg = 'Upload failed';
                        try { var err = JSON.parse(xhr.responseText); if (err && err.error && err.error.message) msg = err.error.message; } catch (e) {}
                        reject(new Error(msg));
                    };
                    xhr.onerror = function () { self._xhr = null; reject(new Error('Network error during upload')); };
                    xhr.onabort = function () { self._xhr = null; reject(new Error('Upload cancelled')); };
                    xhr.send(form);
                };
                tryPreset();
            });
        },

        /**
         * Open the device's native picker and upload. Resolves
         * { ok:true, files:[…] } or { ok:false, cancelled:true }.
         */
        pick: function (opts) {
            opts = opts || {};
            var self = this;
            return new Promise(function (resolve) {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = opts.accept || 'image/*';
                if (opts.multiple) input.multiple = true;
                input.style.position = 'fixed';
                input.style.opacity = '0';
                input.style.pointerEvents = 'none';
                document.body.appendChild(input);

                var settled = false;
                var done = function (val) {
                    if (settled) return;
                    settled = true;
                    try { input.remove(); } catch (e) {}
                    resolve(val);
                };

                input.addEventListener('change', async function () {
                    var files = Array.prototype.slice.call(input.files || []);
                    if (!files.length) { return done({ ok: false, cancelled: true }); }
                    if (opts.maxBytes) {
                        var tooBig = files.filter(function (f) { return f.size > opts.maxBytes; });
                        if (tooBig.length) {
                            if (typeof opts.onError === 'function') opts.onError('That file is too large. Please choose one under ' + fmtBytes(opts.maxBytes) + '.');
                            return done({ ok: false, cancelled: false, error: 'too-large' });
                        }
                    }
                    if (opts.silent) {
                        // No modal — background upload with a small progress badge.
                        var hideBadge = files.length ? showBadge('Uploading ' + files.length + (files.length > 1 ? ' files…' : ' file…')) : null;
                        try {
                            var out = [];
                            for (var i = 0; i < files.length; i++) {
                                out.push(await api._uploadFile(files[i], {
                                    preset: opts.preset, folder: opts.folder,
                                    onProgress: function (p) { if (hideBadge && i === files.length - 1 && p >= 100) hideBadge(); }
                                }));
                            }
                            if (hideBadge) hideBadge();
                            if (typeof opts.onUploaded === 'function') opts.onUploaded(out);
                            done({ ok: true, files: out });
                        } catch (err) {
                            if (hideBadge) hideBadge();
                            if (typeof opts.onError === 'function') opts.onError(friendlyError(err));
                            done({ ok: false, cancelled: false, error: err });
                        }
                        return;
                    }
                    // Interactive single-file flow with preview + progress.
                    if (files.length === 1) {
                        api._resolve = done;
                        showModal(opts, files[0], api);
                        return;
                    }
                    // Multiple selection: upload all with a badge, resolve together.
                    var hide = showBadge('Uploading ' + files.length + ' files…');
                    try {
                        var results = [];
                        for (var j = 0; j < files.length; j++) {
                            results.push(await api._uploadFile(files[j], { preset: opts.preset, folder: opts.folder }));
                        }
                        hide();
                        if (typeof opts.onUploaded === 'function') opts.onUploaded(results);
                        done({ ok: true, files: results });
                    } catch (err) {
                        hide();
                        if (typeof opts.onError === 'function') opts.onError(friendlyError(err));
                        done({ ok: false, cancelled: false, error: err });
                    }
                });

                // If the user dismisses the native picker.
                var cancelTimer = setTimeout(function () {
                    // focus/visibility heuristic: a dismissed picker leaves the
                    // input unchanged; we still wait — change/focus will fire.
                }, 0);
                window.addEventListener('focus', function onFocus() {
                    setTimeout(function () {
                        if (!settled && (!input.files || !input.files.length)) {
                            window.removeEventListener('focus', onFocus);
                            done({ ok: false, cancelled: true });
                        }
                    }, 800);
                });
                clearTimeout(cancelTimer);

                input.click();
            });
        },

        /** True while an upload request is in flight (guards double submits). */
        isBusy: function () { return !!this._xhr; }
    };

    global.PDUpload = api;
})(typeof window !== 'undefined' ? window : this);
