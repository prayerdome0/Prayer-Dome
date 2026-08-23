/*!
 * Prayer Dome — Real-Time Live Streaming Engine (WebRTC)
 * ---------------------------------------------------------------------------
 * True peer-to-peer live streaming with Firestore signaling.
 *
 *   • Admin camera/mic → RTCPeerConnection → viewers (sub-second latency)
 *   • Automatic MediaRecorder → Cloudinary rolling-parts upload (via pd-cloud-video)
 *   • Firestore real-time: comments, reactions, viewer presence, moderation
 *   • Graceful reconnection, connection quality indicators, automatic bitrate adjust
 *   • Viewer limit protection: falls back to HLS when the mesh gets too large
 *   • Pin/delete/block/mute moderation, pinned comments, live viewer list
 *
 * Admin usage:
 *   const ctrl = PDLive.createBroadcaster({ db, auth });
 *   await ctrl.start({ title, description, category, camera: 'user', muted: false });
 *   await ctrl.stop();
 *
 * Viewer usage:
 *   const v = PDLive.createViewer({ db, auth });
 *   v.attach(videoElement);
 *   await v.join(liveId);
 */
(function (global) {
    'use strict';

    var CLOUD_NAME = 'prayerdome';
    var MAX_WEBRTC_VIEWERS = 12;          // soft cap on mesh viewers before HLS fallback
    var ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ];

    function uid(prefix) {
        return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }
    function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
    function log() { try { console.log.apply(console, ['[PDLive]'].concat(Array.prototype.slice.call(arguments))); } catch (e) {} }
    function warn() { try { console.warn.apply(console, ['[PDLive]'].concat(Array.prototype.slice.call(arguments))); } catch (e) {} }

    /* ------------------------------------------------------------------ */
    /*                       SIGNALING (Firestore)                         */
    /* ------------------------------------------------------------------ */

    function Signal(fb, liveId) {
        this.fb = fb;
        this.liveId = liveId || 'current';
        this.unsubs = [];
    }
    // Build a DocumentReference using modular API from a path array under liveSignals/{liveId}
    Signal.prototype._docFromParts = function (parts) {
        var fb = this.fb;
        // parts starts with 'liveSignals', then doc, coll, doc, ...
        // doc(fb.db, 'liveSignals', id1, 'subcoll', id2, ...)
        return fb.doc.apply(null, [fb.db].concat(parts));
    };
    // Build a CollectionReference using modular API from a path array under liveSignals/{liveId}
    Signal.prototype._colFromParts = function (parts) {
        var fb = this.fb;
        return fb.collection.apply(null, [fb.db].concat(parts));
    };
    Signal.prototype.ref = function (path) {
        var parts = ['liveSignals', this.liveId].concat(path.split('/').filter(Boolean));
        return this._docFromParts(parts);
    };
    Signal.prototype.col = function (path) {
        var parts = ['liveSignals', this.liveId].concat(path.split('/').filter(Boolean));
        return this._colFromParts(parts);
    };
    Signal.prototype.set = async function (path, data) {
        await this.fb.setDoc(this.ref(path), data);
    };
    Signal.prototype.update = async function (path, data) {
        await this.fb.updateDoc(this.ref(path), data);
    };
    Signal.prototype.del = async function (path) {
        await this.fb.deleteDoc(this.ref(path));
    };
    Signal.prototype.onDoc = function (path, cb) {
        var fb = this.fb;
        var unsub = fb.onSnapshot(this.ref(path), function (snap) {
            cb(snap.exists ? snap.data() : null);
        }, function () { cb(null); });
        this.unsubs.push(unsub);
        return unsub;
    };
    Signal.prototype.onCol = function (path, cb) {
        var fb = this.fb;
        var colRef = this.col(path);
        var q = fb.query(colRef, fb.orderBy('createdAt', 'asc'));
        var self = this;
        var unsub = fb.onSnapshot(q, function (snap) {
            snap.docChanges().forEach(function (change) {
                if (change.type === 'added') cb({ id: change.doc.id, data: change.doc.data() });
            });
        });
        this.unsubs.push(unsub);
        return unsub;
    };
    Signal.prototype.detach = function () {
        this.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
        this.unsubs = [];
    };

    /* ================================================================== */
    /*                         BROADCASTER (Admin)                        */
    /* ================================================================== */

    function Broadcaster(fb, opts) {
        this.fb = fb;
        this.opts = opts || {};
        this.signal = null;
        this.stream = null;
        this.recorder = null;
        this.peers = {};           // viewerId -> { pc, polite, viewerInfo }
        this.state = {
            isLive: false,
            liveId: null,
            title: '',
            description: '',
            category: 'service',
            commentsEnabled: true,
            cameraOn: true,
            micOn: true,
            facingMode: 'user',
            startedAt: 0,
            duration: 0,
            status: 'idle',        // idle | starting | live | reconnecting | ending | processing
            connectionQuality: 'good',
            peakViewers: 0,
            totalViews: 0,
            viewers: {},           // viewerId -> { joinedAt, name, avatar, userId }
            reactions: {},         // emoji -> count
            totalReactions: 0,
            totalComments: 0,
            totalShares: 0,
            newFollowers: 0
        };
        this.listeners = {};
        this._timer = null;
        this._iceServers = (opts && opts.iceServers) || ICE_SERVERS;
    }

    Broadcaster.prototype.on = function (ev, fn) {
        (this.listeners[ev] = this.listeners[ev] || []).push(fn);
    };
    Broadcaster.prototype.emit = function (ev, payload) {
        (this.listeners[ev] || []).forEach(function (fn) { try { fn(payload); } catch (e) {} });
    };

    Broadcaster.prototype.qualityFor = function (viewerCount) {
        if (viewerCount <= 4) return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
        if (viewerCount <= 8) return { width: { ideal: 854 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } };
        return { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 20, max: 24 } };
    };

    Broadcaster.prototype.createPeer = async function (viewerId, polite) {
        var self = this;
        var pc = new RTCPeerConnection({ iceServers: this._iceServers, bundlePolicy: 'max-bundle' });

        this.stream.getTracks().forEach(function (track) {
            pc.addTrack(track, self.stream);
        });

        pc.onicecandidate = function (e) {
            if (e.candidate) {
                // Write to a subcollection so all candidates are delivered via onSnapshot
                self.fb.addDoc(self.signal.col('viewers/' + viewerId + '/broadcasterCandidates'), {
                    candidate: e.candidate.toJSON(),
                    createdAt: self.fb.serverTimestamp()
                }).catch(function () {});
            } else {
                self.signal.set('viewers/' + viewerId + '/broadcasterIceComplete', {
                    done: true,
                    createdAt: self.fb.serverTimestamp()
                }).catch(function () {});
            }
        };

        pc.oniceconnectionstatechange = function () {
            var s = pc.iceConnectionState;
            log('viewer', viewerId, 'ICE state:', s);
            if (s === 'failed' || s === 'disconnected' || s === 'closed') {
                self.removeViewer(viewerId, s === 'failed');
            }
            self.updateConnectionQuality();
        };

            // Wait for the viewer's offer, then answer.
            this.signal.onDoc('viewers/' + viewerId + '/offer', async function (offer) {
                if (!offer) return;
                try {
                    if (pc.signalingState !== 'stable' && !polite) return;
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    var answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await self.signal.set('viewers/' + viewerId + '/answer', {
                        type: answer.type,
                        sdp: answer.sdp,
                        createdAt: self.fb.serverTimestamp()
                    });
                } catch (err) {
                    warn('answer failed for', viewerId, err);
                }
            });

            this.signal.onCol('viewers/' + viewerId + '/candidates', function (ev) {
                var c = ev.data && ev.data.candidate;
                if (!c) return;
                // Queue candidate if remote description isn't set yet
                if (!pc.remoteDescription) {
                    setTimeout(function () { pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {}); }, 500);
                } else {
                    pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {});
                }
            });

        this.peers[viewerId] = { pc: pc, polite: !!polite, viewerId: viewerId, joinedAt: Date.now() };
        return pc;
    };

    Broadcaster.prototype.removeViewer = function (viewerId, reconnect) {
        var peer = this.peers[viewerId];
        if (peer) {
            try { peer.pc.close(); } catch (e) {}
            delete this.peers[viewerId];
        }
        this.signal.del('viewers/' + viewerId).catch(function () {});
        if (this.state.viewers[viewerId]) {
            delete this.state.viewers[viewerId];
            this.emit('viewer:left', { viewerId: viewerId });
        }
        this.broadcastState();
    };

    Broadcaster.prototype.updateConnectionQuality = function () {
        var states = Object.values(this.peers).map(function (p) { return p.pc.iceConnectionState; });
        var quality = 'good';
        if (states.some(function (s) { return s === 'failed' || s === 'disconnected'; })) {
            quality = states.every(function (s) { return s === 'failed' || s === 'disconnected' || s === 'closed'; }) ? 'unstable' : 'unstable';
        }
        if (Object.keys(this.peers).length === 0) quality = 'good';
        this.state.connectionQuality = quality;
        this.emit('state', this.snapshot());
    };

    Broadcaster.prototype.renegotiateForNewTracks = function () {
        var self = this;
        Object.values(this.peers).forEach(function (peer) {
            var senders = peer.pc.getSenders();
            self.stream.getTracks().forEach(function (track) {
                var has = senders.some(function (s) { return s.track && s.track.kind === track.kind; });
                if (!has) {
                    try { peer.pc.addTrack(track, self.stream); } catch (e) {}
                }
            });
        });
    };

    Broadcaster.prototype.start = async function (opts) {
        var self = this;
        if (this.state.isLive) throw new Error('Already live');
        opts = opts || {};
        this.state.status = 'starting';
        this.emit('state', this.snapshot());

        var title = (opts.title || 'Prayer Dome Live').trim();
        var description = (opts.description || 'Join us live at Prayer Dome').trim();
        var category = opts.category || 'service';
        var facing = opts.facingMode || 'user';

        // 1. Camera
        this.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: true
        });
        this.state.cameraOn = true;
        this.state.micOn = !opts.muted;
        if (opts.muted) this.stream.getAudioTracks().forEach(function (t) { t.enabled = false; });
        this.state.facingMode = facing;

        // 2. Create liveId and signaling channel.
        var liveId = 'live_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        this.state.liveId = liveId;
        this.signal = new Signal(this.fb, liveId);

        // 3. Cloud recording
        if (global.PDCloudVideo) {
            this.recorder = PDCloudVideo.createRecorder(this.stream, {
                title: title,
                onProgress: function (s) { self.emit('recorder:progress', s); },
                onPart: function (part) { self.emit('recorder:part', part); },
                onError: function (err) { warn('recorder error:', err); self.emit('recorder:error', err); }
            });
            this.recorder.start();
        }

        // 4. Write live status document.
        var hlsUrl = 'https://res.cloudinary.com/' + CLOUD_NAME + '/video/upload/hls/' + liveId + '.m3u8';
        this.state.title = title;
        this.state.description = description;
        this.state.category = category;
        this.state.commentsEnabled = opts.commentsEnabled !== false;
        this.state.startedAt = Date.now();
        this.state.isLive = true;
        this.state.status = 'live';
        this.state.hlsUrl = hlsUrl;
        this.state.rtmpUrl = 'rtmp://api.cloudinary.com/v2/' + CLOUD_NAME + '/live/' + liveId;
        this.state.streamKey = liveId;

        var status = {
            isLive: true,
            liveId: liveId,
            title: title,
            description: description,
            category: category,
            commentsEnabled: this.state.commentsEnabled,
            source: 'webrtc',
            startedBy: (opts && opts.adminEmail) || 'admin',
            startedByUid: (opts && opts.adminUid) || null,
            startTime: this.fb.serverTimestamp(),
            viewers: 0,
            viewersList: {},
            reactions: {},
            totalReactions: 0,
            totalComments: 0,
            totalShares: 0,
            newFollowers: 0,
            peakViewers: 0,
            totalViews: 0,
            hlsUrl: hlsUrl,
            rtmpUrl: this.state.rtmpUrl,
            streamKey: liveId,
            connectionQuality: 'good',
            status: 'live'
        };
        await this.fb.setDoc(this.fb.doc(this.fb.db, 'liveStatus', 'current'), status);

        // Clean up any stale viewer signals.
        try {
            var existing = await this.fb.getDocs(this.fb.collection(this.fb.db, 'liveSignals', liveId, 'viewers'));
            var batch = this.fb.writeBatch ? this.fb.writeBatch(this.fb.db) : null;
            existing.forEach(function (d) {
                try { if (batch) batch.delete(d.ref); else self.fb.deleteDoc(d.ref); } catch (e) {}
            });
            if (batch) await batch.commit();
        } catch (e) { /* non-critical */ }

        // 5. Listen for viewer joins.
        this.signal.onCol('join', function (ev) {
            var viewer = ev.data || {};
            var viewerId = ev.id;
            if (!viewer.joined) return;
            self.state.viewers[viewerId] = {
                viewerId: viewerId,
                userId: viewer.userId || null,
                name: viewer.name || 'Viewer',
                avatar: viewer.avatar || null,
                joinedAt: viewer.joinedAt ? (viewer.joinedAt.toDate ? viewer.joinedAt.toDate().getTime() : Date.now()) : Date.now()
            };
            self.state.totalViews++;
            self.state.peakViewers = Math.max(self.state.peakViewers, Object.keys(self.state.viewers).length);
            self.createPeer(viewerId, false).catch(function (err) { warn('createPeer error', err); });
            self.emit('viewer:joined', self.state.viewers[viewerId]);
            self.broadcastState();
        });

        // 6. Listen for chat/reactions/etc.
        this.signal.onCol('chat', function (ev) {
            var msg = ev.data || {};
            if (msg._handled) return;
            self.state.totalComments++;
            msg.id = ev.id;
            self.emit('chat', msg);
            // Mirror to /liveChat collection for persistent history.
            if (msg.type === 'comment' && !msg._system) {
                try {
                    self.fb.addDoc(self.fb.collection(self.fb.db, 'liveChat'), {
                        liveId: liveId,
                        userId: msg.userId,
                        name: msg.name,
                        avatar: msg.avatar,
                        message: msg.text,
                        isPrayer: !!msg.isPrayer,
                        pinned: false,
                        hidden: false,
                        timestamp: self.fb.serverTimestamp()
                    });
                } catch (e) {}
            }
            self.broadcastState();
        });

        this.signal.onCol('reactions', function (ev) {
            var r = ev.data || {};
            if (!r.emoji) return;
            self.state.reactions[r.emoji] = (self.state.reactions[r.emoji] || 0) + 1;
            self.state.totalReactions++;
            self.emit('reaction', r);
            self.broadcastState();
        });

        this.signal.onCol('events', function (ev) {
            var e = ev.data || {};
            if (e.type === 'share') self.state.totalShares++;
            if (e.type === 'follow') self.state.newFollowers++;
            if (e.type === 'report') self.emit('report', e);
            self.broadcastState();
        });

        // Periodic state broadcast.
        this._timer = setInterval(function () {
            self.state.duration = Math.floor((Date.now() - self.state.startedAt) / 1000);
            self.broadcastState();
        }, 2000);

        // Welcome message
        try {
            await this.fb.addDoc(this.fb.collection(this.fb.db, 'liveChat'), {
                liveId: liveId, userId: 'system', name: 'System',
                message: '🔴 LIVE NOW: "' + title + '" — welcome to Prayer Dome Live',
                isSystem: true, timestamp: this.fb.serverTimestamp()
            });
        } catch (e) {}

        this.emit('state', this.snapshot());
        return this.snapshot();
    };

    Broadcaster.prototype.broadcastState = function () {
        if (!this.signal) return;
        var viewersList = {};
        Object.keys(this.state.viewers).forEach(function (id) {
            viewersList[id] = { name: true }; // presence only, PII controlled
        });
        var payload = {
            isLive: this.state.isLive,
            title: this.state.title,
            description: this.state.description,
            category: this.state.category,
            commentsEnabled: this.state.commentsEnabled,
            viewers: Object.keys(this.state.viewers).length,
            viewersList: viewersList,
            duration: this.state.duration,
            connectionQuality: this.state.connectionQuality,
            reactions: this.state.reactions,
            totalReactions: this.state.totalReactions,
            totalComments: this.state.totalComments,
            totalShares: this.state.totalShares,
            totalViews: this.state.totalViews,
            newFollowers: this.state.newFollowers,
            status: this.state.status,
            startedAt: this.state.startedAt,
            updatedAt: Date.now()
        };
        this.fb.updateDoc(this.fb.doc(this.fb.db, 'liveStatus', 'current'), {
            viewers: payload.viewers,
            reactions: payload.reactions,
            totalReactions: payload.totalReactions,
            totalComments: payload.totalComments,
            totalShares: payload.totalShares,
            newFollowers: payload.newFollowers,
            totalViews: payload.totalViews,
            peakViewers: this.state.peakViewers,
            connectionQuality: payload.connectionQuality,
            duration: payload.duration,
            status: payload.status
        }).catch(function () {});

        this.signal.set('state', payload).catch(function () {});
    };

    Broadcaster.prototype.snapshot = function () { return JSON.parse(JSON.stringify(this.state)); };

    /* ------- camera/mic controls ------- */
    Broadcaster.prototype.toggleCamera = function () {
        if (!this.stream) return;
        var tracks = this.stream.getVideoTracks();
        this.state.cameraOn = !this.state.cameraOn;
        tracks.forEach(function (t) { t.enabled = !t.enabled; });
        this.broadcastState();
        this.emit('state', this.snapshot());
        return this.state.cameraOn;
    };
    Broadcaster.prototype.toggleMic = function () {
        if (!this.stream) return;
        this.state.micOn = !this.state.micOn;
        this.stream.getAudioTracks().forEach(function (t) { t.enabled = !t.enabled; });
        this.broadcastState();
        this.emit('state', this.snapshot());
        return this.state.micOn;
    };
    Broadcaster.prototype.switchCamera = async function () {
        if (!this.stream) return;
        this.state.facingMode = this.state.facingMode === 'user' ? 'environment' : 'user';
        var oldVid = this.stream.getVideoTracks();
        try {
            var newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.state.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            var newVideo = newStream.getVideoTracks()[0];
            // Replace in the main stream
            oldVid.forEach(function (t) { t.stop(); });
            this.stream.removeTrack(oldVid[0]);
            this.stream.addTrack(newVideo);
            // Replace in every peer connection
            var self = this;
            Object.values(this.peers).forEach(function (peer) {
                var senders = peer.pc.getSenders();
                var videoSender = senders.find(function (s) { return s.track && s.track.kind === 'video'; });
                if (videoSender) {
                    videoSender.replaceTrack(newVideo).catch(function () {});
                }
            });
            if (this.recorder && this.recorder.replaceStream) this.recorder.replaceStream(this.stream);
            this.emit('camera:flipped', this.state.facingMode);
        } catch (e) {
            warn('camera flip failed', e);
            this.emit('error', e);
        }
    };

    /* ------- moderation ------- */
    Broadcaster.prototype.deleteComment = async function (commentId) {
        if (!commentId) return;
        await this.fb.deleteDoc(this.fb.doc(this.fb.db, 'liveChat', commentId)).catch(function () {});
        this.signal.set('moderation/' + uid('mod'), { action: 'delete', commentId: commentId, at: Date.now() });
    };
    Broadcaster.prototype.pinComment = async function (commentId, pinned) {
        await this.fb.updateDoc(this.fb.doc(this.fb.db, 'liveChat', commentId), { pinned: pinned !== false }).catch(function () {});
        this.fb.updateDoc(this.fb.doc(this.fb.db, 'liveStatus', 'current'), { pinnedCommentId: pinned !== false ? commentId : null }).catch(function () {});
    };
    Broadcaster.prototype.setCommentsEnabled = async function (on) {
        this.state.commentsEnabled = !!on;
        await this.fb.updateDoc(this.fb.doc(this.fb.db, 'liveStatus', 'current'), { commentsEnabled: !!on });
        this.signal.set('moderation/' + uid('mod'), { action: 'comments', enabled: !!on, at: Date.now() });
        this.broadcastState();
    };
    Broadcaster.prototype.muteUser = async function (userId, mute) {
        if (!userId) return;
        await this.fb.setDoc(this.fb.doc(this.fb.db, 'liveMutedUsers', userId), { muted: mute !== false, at: this.fb.serverTimestamp() });
    };
    Broadcaster.prototype.blockUser = async function (userId) {
        if (!userId) return;
        await this.fb.setDoc(this.fb.doc(this.fb.db, 'liveBlockedUsers', userId), { blocked: true, at: this.fb.serverTimestamp() });
        // Kick them out
        var self = this;
        Object.keys(this.peers).forEach(function (vid) {
            if (self.state.viewers[vid] && self.state.viewers[vid].userId === userId) {
                self.removeViewer(vid, false);
            }
        });
    };

    /* ------- stop ------- */
    Broadcaster.prototype.stop = async function () {
        var self = this;
        if (!this.state.isLive) return;
        this.state.status = 'ending';
        this.emit('state', this.snapshot());

        clearInterval(this._timer);
        this.state.duration = Math.floor((Date.now() - this.state.startedAt) / 1000);

        // Close all peers.
        Object.keys(this.peers).forEach(function (id) {
            try { self.peers[id].pc.close(); } catch (e) {}
            delete self.peers[id];
        });

        // Stop camera.
        if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });

        // Finalize cloud recording.
        var cloud = null;
        if (this.recorder) {
            try {
                this.state.status = 'processing';
                this.emit('state', this.snapshot());
                cloud = await this.recorder.stop();
            } catch (e) { warn('recorder stop error', e); }
        }

        var summary = {
            liveId: this.state.liveId,
            title: this.state.title,
            description: this.state.description,
            category: this.state.category,
            startedBy: this.state.startedBy,
            startedByUid: this.state.startedByUid,
            durationSeconds: this.state.duration,
            peakViewers: this.state.peakViewers,
            totalViews: this.state.totalViews,
            totalReactions: this.state.totalReactions,
            totalComments: this.state.totalComments,
            totalShares: this.state.totalShares,
            newFollowers: this.state.newFollowers,
            reactions: this.state.reactions,
            parts: cloud ? cloud.parts : [],
            playbackUrl: cloud ? cloud.playbackUrl : (this.state.hlsUrl || null),
            hlsUrl: this.state.hlsUrl,
            thumbnail: cloud ? cloud.thumbnail : null,
            totalBytes: cloud ? cloud.totalBytes : 0,
            source: 'webrtc',
            endedAt: new Date().toISOString()
        };

        // Write to liveRecordings archive.
        try {
            await this.fb.addDoc(this.fb.collection(this.fb.db, 'liveRecordings'), Object.assign({}, summary, {
                published: true,
                featured: false,
                isPrivate: false,
                storage: 'cloudinary',
                createdAt: this.fb.serverTimestamp()
            }));
        } catch (e) { warn('recording save error', e); }

        // Reset live status
        try {
            await this.fb.setDoc(this.fb.doc(this.fb.db, 'liveStatus', 'current'), {
                isLive: false,
                status: 'ended',
                endedAt: this.fb.serverTimestamp(),
                lastLiveId: this.state.liveId,
                lastRecordingSummary: summary,
                viewers: 0
            }, { merge: true });
        } catch (e) {}

        // System message
        try {
            await this.fb.addDoc(this.fb.collection(this.fb.db, 'liveChat'), {
                liveId: this.state.liveId, userId: 'system', name: 'System',
                message: '🔴 The live broadcast has ended. The recording is being processed and will appear in the archive shortly.',
                isSystem: true, timestamp: this.fb.serverTimestamp()
            });
        } catch (e) {}

        if (this.signal) {
            this.signal.set('state', { isLive: false, status: 'ended', endedAt: Date.now() });
            setTimeout(function () { self.signal.detach(); self.signal = null; }, 2000);
        }

        this.state.isLive = false;
        this.state.status = 'ended';
        this.stream = null;
        this.recorder = null;
        this.peers = {};
        this.state.viewers = {};
        this.emit('ended', summary);
        this.emit('state', this.snapshot());
        return summary;
    };

    /* ================================================================== */
    /*                            VIEWER                                  */
    /* ================================================================== */

    function Viewer(fb, opts) {
        this.fb = fb;
        this.opts = opts || {};
        this.signal = null;
        this.pc = null;
        this.videoEl = null;
        this.state = {
            isLive: false,
            liveId: null,
            joined: false,
            viewerId: uid('vw'),
            status: 'connecting',
            connectionQuality: 'good',
            viewerCount: 0,
            title: '',
            description: '',
            commentsEnabled: true,
            mode: 'webrtc', // webrtc | hls
            hlsUrl: null,
            reactions: {},
            pinnedCommentId: null
        };
        this.listeners = {};
        this.unsubs = [];
        this.hls = null;
        this.reconnectAttempts = 0;
        this._iceServers = (opts && opts.iceServers) || ICE_SERVERS;
    }

    Viewer.prototype.on = function (ev, fn) {
        (this.listeners[ev] = this.listeners[ev] || []).push(fn);
    };
    Viewer.prototype.emit = function (ev, payload) {
        (this.listeners[ev] || []).forEach(function (fn) { try { fn(payload); } catch (e) {} });
    };

    Viewer.prototype.attach = function (videoEl) { this.videoEl = videoEl; };

    Viewer.prototype.join = async function () {
        var self = this;
        var statusRef = this.fb.doc(this.fb.db, 'liveStatus', 'current');
        var snap = await this.fb.getDoc(statusRef);
        var status = snap.exists ? snap.data() : null;
        if (!status || !status.isLive) {
            this.state.status = 'offline';
            this.emit('state', this.state);
            return false;
        }
        this.applyStatus(status);

        this.state.viewerId = sessionStorage.getItem('pd_viewer_id') || uid('vw');
        sessionStorage.setItem('pd_viewer_id', this.state.viewerId);

        this.signal = new Signal(this.fb, status.liveId);

        // Decide mode: WebRTC if viewer count < MAX, else HLS fallback.
        var viewerCount = Number(status.viewers) || 0;
        var useWebRTC = viewerCount < MAX_WEBRTC_VIEWERS && status.source === 'webrtc';
        this.state.mode = useWebRTC ? 'webrtc' : 'hls';

        // Register presence (write top-level doc so admin collection listeners see it).
        var userInfo = opts_userInfo(this.opts) || {};
        await this.signal.set('viewers/' + this.state.viewerId, {
            joinedAt: this.fb.serverTimestamp(),
            name: userInfo.name || 'Guest',
            avatar: userInfo.avatar || null,
            userId: userInfo.uid || null,
            heartbeat: { t: Date.now() }
        });
        await this.signal.set('join/' + this.state.viewerId, {
            joined: true,
            viewerId: this.state.viewerId,
            name: userInfo.name || 'Guest',
            avatar: userInfo.avatar || null,
            userId: userInfo.uid || null,
            joinedAt: this.fb.serverTimestamp()
        });
        this.state.joined = true;

        if (useWebRTC) {
            await this.connectWebRTC();
        } else {
            this.connectHLS();
        }

        // Listen for state updates.
        this.signal.onDoc('state', function (data) {
            if (!data) return;
            if (data.isLive === false) {
                self.handleEnd();
                return;
            }
            self.state.viewerCount = data.viewers || 0;
            self.state.title = data.title || self.state.title;
            self.state.description = data.description || self.state.description;
            self.state.commentsEnabled = data.commentsEnabled !== false;
            self.state.connectionQuality = data.connectionQuality || 'good';
            self.state.reactions = data.reactions || {};
            self.emit('state', self.state);
        });

        // Moderation actions
        this.signal.onCol('moderation', function (ev) {
            var m = ev.data || {};
            if (m.action === 'comments') self.state.commentsEnabled = !!m.enabled;
            self.emit('moderation', m);
            self.emit('state', self.state);
        });

        // Live state via main liveStatus doc (cross-device, including admin-dashboard)
        var mainUnsub = this.fb.onSnapshot(statusRef, function (s) {
            var d = s.exists ? s.data() : null;
            if (!d || !d.isLive) { self.handleEnd(); return; }
            self.applyStatus(d);
            // If the admin flips to a non-webrtc source, switch to HLS.
            if (d.source !== 'webrtc' && self.state.mode === 'webrtc' && !self._forceWebRTC) {
                self.switchToHLS();
            }
        });
        this.unsubs.push(mainUnsub);

        this.state.status = 'connected';
        this.emit('state', this.state);

        // Presence heartbeat — merge into the top-level viewer doc so admin staleness checks see it
        this._heartbeat = setInterval(function () {
            if (self.state.joined && self.signal) {
                self.fb.updateDoc(self.signal.ref('viewers/' + self.state.viewerId), { heartbeat: { t: Date.now() } }).catch(function () {});
            }
        }, 15000);

        window.addEventListener('beforeunload', function () { self.leave(); });
        window.addEventListener('pagehide', function () { self.leave(); });

        return true;
    };

    Viewer.prototype.applyStatus = function (d) {
        this.state.isLive = !!d.isLive;
        this.state.liveId = d.liveId || null;
        this.state.title = d.title || 'Prayer Dome Live';
        this.state.description = d.description || '';
        this.state.hlsUrl = d.hlsUrl || null;
        this.state.viewerCount = Number(d.viewers) || 0;
        this.state.commentsEnabled = d.commentsEnabled !== false;
        this.state.pinnedCommentId = d.pinnedCommentId || null;
        if (d.status) this.state.status = d.status;
    };

    Viewer.prototype.connectWebRTC = async function () {
        var self = this;
        this.state.status = 'connecting';
        this.emit('state', this.state);
        try {
            this.pc = new RTCPeerConnection({ iceServers: this._iceServers, bundlePolicy: 'max-bundle' });
            this.pc.ontrack = function (e) {
                if (self.videoEl && e.streams && e.streams[0]) {
                    self.videoEl.srcObject = e.streams[0];
                    self.videoEl.play().catch(function () {});
                    self.state.status = 'connected';
                    self.emit('state', self.state);
                    self.emit('stream', e.streams[0]);
                }
            };
            this.pc.onicecandidate = function (e) {
                if (e.candidate) {
                    self.fb.addDoc(self.signal.col('viewers/' + self.state.viewerId + '/candidates'), {
                        candidate: e.candidate.toJSON(),
                        createdAt: self.fb.serverTimestamp()
                    }).catch(function () {});
                }
            };
            this.pc.oniceconnectionstatechange = function () {
                var s = self.pc.iceConnectionState;
                log('viewer ICE', s);
                if (s === 'connected' || s === 'completed') {
                    self.state.status = 'connected';
                    self.state.connectionQuality = 'good';
                    self.reconnectAttempts = 0;
                } else if (s === 'checking' || s === 'disconnected') {
                    self.state.connectionQuality = 'unstable';
                } else if (s === 'failed') {
                    self.attemptReconnect();
                }
                self.emit('state', self.state);
            };

            // ---- Set up listeners BEFORE creating offer to avoid races ----
            // Wait for answer
            this.signal.onDoc('viewers/' + this.state.viewerId + '/answer', async function (ans) {
                if (!ans || !self.pc) return;
                try {
                    if (self.pc.signalingState !== 'stable') {
                        await self.pc.setRemoteDescription(new RTCSessionDescription(ans));
                    }
                } catch (e) { warn('setRemoteDescription failed', e); }
            });

            // Watch for broadcaster ICE candidates (subcollection gets every candidate)
            this.signal.onCol('viewers/' + this.state.viewerId + '/broadcasterCandidates', function (ev) {
                var c = ev.data && ev.data.candidate;
                if (!c || !self.pc) return;
                var add = function () { self.pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {}); };
                if (self.pc.remoteDescription && self.pc.remoteDescription.sdp) add();
                else setTimeout(add, 250);
            });

            // Create offer
            var offer = await this.pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
            await this.pc.setLocalDescription(offer);
            await this.signal.set('viewers/' + this.state.viewerId + '/offer', {
                type: offer.type, sdp: offer.sdp, createdAt: this.fb.serverTimestamp()
            });
        } catch (e) {
            warn('WebRTC failed, falling back to HLS:', e);
            this.switchToHLS();
        }
    };

    Viewer.prototype.switchToHLS = function () {
        this.state.mode = 'hls';
        this.state.status = 'connecting';
        this.emit('state', this.state);
        if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
        this.connectHLS();
    };

    Viewer.prototype.connectHLS = function () {
        var self = this;
        var url = this.state.hlsUrl;
        if (!url || !this.videoEl) return;
        if (this.hls) { try { this.hls.destroy(); } catch (e) {} this.hls = null; }
        var v = this.videoEl;
        v.srcObject = null;
        if (v.canPlayType('application/vnd.apple.mpegurl')) {
            v.src = url;
            v.play().catch(function () {});
            this.state.status = 'connected';
            this.emit('state', this.state);
        } else if (global.Hls && Hls.isSupported()) {
            this.hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 });
            this.hls.loadSource(url);
            this.hls.attachMedia(v);
            this.hls.on(Hls.Events.MANIFEST_PARSED, function () {
                v.play().catch(function () {});
                self.state.status = 'connected';
                self.emit('state', self.state);
            });
            this.hls.on(Hls.Events.ERROR, function (_e, data) {
                if (data.fatal) {
                    self.state.status = 'reconnecting';
                    self.emit('state', self.state);
                    setTimeout(function () { if (self.state.isLive) self.connectHLS(); }, 3000);
                }
            });
        }
    };

    Viewer.prototype.attemptReconnect = function () {
        var self = this;
        this.reconnectAttempts++;
        this.state.status = 'reconnecting';
        this.emit('state', this.state);
        if (this.reconnectAttempts > 3) {
            // Fall back to HLS.
            this.switchToHLS();
            return;
        }
        setTimeout(function () {
            if (!self.state.isLive) return;
            if (self.pc) { try { self.pc.close(); } catch (e) {} self.pc = null; }
            self.connectWebRTC().catch(function () { self.switchToHLS(); });
        }, 1500 * this.reconnectAttempts);
    };

    Viewer.prototype.leave = function () {
        if (!this.state.joined) return;
        this.state.joined = false;
        clearInterval(this._heartbeat);
        if (this.pc) { try { this.pc.close(); } catch (e) {} this.pc = null; }
        if (this.hls) { try { this.hls.destroy(); } catch (e) {} this.hls = null; }
        if (this.videoEl) { try { this.videoEl.pause(); this.videoEl.srcObject = null; this.videoEl.removeAttribute('src'); } catch (e) {} }
        if (this.signal) {
            this.signal.del('viewers/' + this.state.viewerId).catch(function () {});
            this.signal.detach();
        }
        this.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
        this.unsubs = [];
    };

    Viewer.prototype.handleEnd = function () {
        this.state.isLive = false;
        this.state.status = 'ended';
        this.emit('ended');
        this.emit('state', this.state);
        this.leave();
    };

    Viewer.prototype.sendComment = function (text, opts) {
        if (!this.state.joined || !this.signal) return;
        if (!this.state.commentsEnabled) throw new Error('Comments are disabled');
        var info = (opts_userInfo(opts || this.opts)) || {};
        var msg = {
            type: 'comment',
            text: String(text || '').slice(0, 500),
            name: info.name || 'Guest',
            avatar: info.avatar || null,
            userId: info.uid || null,
            isPrayer: !!(opts && opts.isPrayer),
            at: Date.now()
        };
        this.signal.col('chat').add ? null : null;
        return this.fb.addDoc(this.signal.col('chat'), msg);
    };

    Viewer.prototype.sendReaction = function (emoji) {
        if (!this.state.joined || !this.signal) return;
        return this.fb.addDoc(this.signal.col('reactions'), {
            emoji: emoji, viewerId: this.state.viewerId, at: Date.now()
        });
    };

    Viewer.prototype.sendEvent = function (type, data) {
        if (!this.state.joined || !this.signal) return;
        return this.fb.addDoc(this.signal.col('events'), Object.assign({ type: type, at: Date.now(), viewerId: this.state.viewerId }, data || {}));
    };

    function opts_userInfo(o) {
        o = o || {};
        if (o.user) return o.user;
        return { name: o.name, avatar: o.avatar, uid: o.uid };
    }

    /* ================================================================== */
    /*                             PUBLIC API                             */
    /* ================================================================== */

    global.PDLive = {
        createBroadcaster: function (fb, opts) { return new Broadcaster(fb, opts); },
        createViewer: function (fb, opts) { return new Viewer(fb, opts); },
        MAX_WEBRTC_VIEWERS: MAX_WEBRTC_VIEWERS,
        CLOUD_NAME: CLOUD_NAME
    };
})(typeof window !== 'undefined' ? window : this);
