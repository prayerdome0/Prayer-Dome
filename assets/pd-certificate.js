/* ==========================================================================
   Prayer Dome — certificate download
   --------------------------------------------------------------------------
   Renders Academy completion certificates to a canvas and downloads them as
   PNG files. Runs entirely in the browser (no external libraries) so certificates
   can be generated and downloaded offline, matching the rest of the Academy.

   Usage:
     PDCertificate.download({ name, course, score, id, date });
     PDCertificate.bindButton(button, { name, course, score, id, date });
   ========================================================================== */
(function () {
  'use strict';

  var W = 1600;
  var H = 1131; // A4 landscape ratio
  var NAVY = '#1d2a6b';
  var NAVY_SOFT = '#2b3a8f';
  var GOLD = '#c9a227';
  var GOLD_DARK = '#8f7410';
  var GOLD_LIGHT = '#e6c94f';
  var IVORY = '#fbf7ec';
  var MUTED = '#6b675c';
  var SERIF = "Georgia, 'Times New Roman', serif";
  var VERSE = '“He does everything blamelessly.” — Mark 7:37';

  var logoPromise = null;

  function loadedPageLogo() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
    var images = document.querySelectorAll('img[src*="/assets/logo"]');
    for (var i = 0; i < images.length; i++) {
      if (images[i].complete && images[i].naturalWidth && images[i].naturalHeight) return images[i];
    }
    return null;
  }

  function loadLogo() {
    if (!logoPromise) {
      logoPromise = new Promise(function (resolve) {
        var settled = false;
        function done(img) { if (!settled) { settled = true; resolve(img); } }
        var onPage = loadedPageLogo();
        if (onPage) { done(onPage); return; }
        if (typeof Image === 'undefined') { done(null); return; }
        var img = new Image();
        img.onload = function () { done(img); };
        img.onerror = function () { done(null); };
        img.src = '/assets/logo.png';
        // A slow or unavailable image must never leave certificate buttons spinning.
        setTimeout(function () { done(null); }, 1800);
      });
    }
    return logoPromise;
  }

  function ellipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function star(ctx, cx, cy, spikes, outerR, innerR, color) {
    var rot = (Math.PI / 2) * 3;
    var step = Math.PI / spikes;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (var i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR); rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR); rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fill();
  }

  function seal(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // ribbons
    ctx.fillStyle = NAVY_SOFT;
    ctx.beginPath(); ctx.moveTo(-26, 34); ctx.lineTo(-54, 116); ctx.lineTo(-26, 98); ctx.lineTo(-2, 116); ctx.closePath(); ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.moveTo(26, 34); ctx.lineTo(54, 116); ctx.lineTo(26, 98); ctx.lineTo(2, 116); ctx.closePath(); ctx.fill();
    // scalloped edge
    for (var i = 0; i < 18; i++) {
      var a = (i / 18) * Math.PI * 2;
      ellipse(ctx, Math.cos(a) * 66, Math.sin(a) * 66, 8, 8, GOLD_DARK);
    }
    ellipse(ctx, 0, 0, 62, 62, GOLD);
    ellipse(ctx, 0, 0, 52, 52, IVORY);
    ctx.strokeStyle = GOLD_DARK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
    star(ctx, 0, 2, 5, 30, 13, GOLD);
    ctx.restore();
  }

  function diamond(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
    ctx.closePath(); ctx.fill();
  }

  function fallbackMark(ctx) {
    // Fast vector fallback for offline WebViews: the certificate still displays
    // a recognisable Prayer Dome book-and-dome mark if the PNG is unavailable.
    ctx.save();
    ctx.translate(W / 2, 184);
    ctx.strokeStyle = NAVY_SOFT;
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(-110, 28); ctx.quadraticCurveTo(-82, -74, 0, -112);
    ctx.quadraticCurveTo(82, -74, 110, 28); ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(-96, 44); ctx.lineTo(-8, 82); ctx.lineTo(0, 98); ctx.lineTo(8, 82); ctx.lineTo(96, 44);
    ctx.lineTo(18, 112); ctx.lineTo(0, 124); ctx.lineTo(-18, 112); ctx.closePath(); ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = "700 48px " + SERIF;
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 12);
    ctx.restore();
  }

  function spaced(ctx, text, cx, y, spacing) {
    var chars = String(text).split('');
    var widths = chars.map(function (c) { return ctx.measureText(c).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * Math.max(0, chars.length - 1);
    var x = cx - total / 2;
    var align = ctx.textAlign;
    ctx.textAlign = 'left';
    chars.forEach(function (c, i) { ctx.fillText(c, x, y); x += widths[i] + spacing; });
    ctx.textAlign = align;
  }

  function fitFont(ctx, text, maxWidth, baseSize, style, weight) {
    var size = baseSize;
    while (size > 24) {
      ctx.font = style + ' ' + weight + ' ' + size + 'px ' + SERIF;
      if (ctx.measureText(text).width <= maxWidth) break;
      size -= 2;
    }
    return size;
  }

  function fmtDate(iso) {
    try {
      var d = iso ? new Date(iso) : new Date();
      if (isNaN(d.getTime())) d = new Date();
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function draw(ctx, opts, logo) {
    var name = String(opts.name || 'Prayer Dome Member');
    var course = String(opts.course || 'Prayer Dome Academy Lesson');
    var score = Math.round(Number(opts.score) || 0);
    var certId = String(opts.id || 'PD-CERT');

    // background
    ctx.fillStyle = IVORY;
    ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.62);
    glow.addColorStop(0, 'rgba(255, 252, 240, 0.95)');
    glow.addColorStop(1, 'rgba(238, 228, 198, 0.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // frame
    ctx.strokeStyle = NAVY; ctx.lineWidth = 14;
    ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.strokeRect(58, 58, W - 116, H - 116);
    [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(function (c) {
      diamond(ctx, c[0], c[1], 12, GOLD);
    });

    // logo
    if (logo && logo.naturalWidth) {
      var lh = 182;
      var lw = (lh * logo.naturalWidth) / logo.naturalHeight;
      if (lw > 260) { lw = 260; lh = (lw * logo.naturalHeight) / logo.naturalWidth; }
      ctx.drawImage(logo, (W - lw) / 2, 88, lw, lh);
    } else {
      fallbackMark(ctx);
    }

    ctx.fillStyle = GOLD_DARK;
    ctx.font = "600 27px " + SERIF;
    spaced(ctx, 'PRAYER DOME ACADEMY', W / 2, 332, 10);

    ctx.textAlign = 'center';
    ctx.fillStyle = NAVY;
    ctx.font = "700 76px " + SERIF;
    ctx.fillText('Certificate of Completion', W / 2, 428);

    // divider
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 250, 462); ctx.lineTo(W / 2 - 24, 462); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 24, 462); ctx.lineTo(W / 2 + 250, 462); ctx.stroke();
    diamond(ctx, W / 2, 462, 10, GOLD);

    ctx.fillStyle = MUTED;
    ctx.font = "italic 28px " + SERIF;
    ctx.fillText('This certifies that', W / 2, 522);

    // recipient name with flourish underline
    var nSize = fitFont(ctx, name, 1100, 64, 'normal', '700');
    ctx.fillStyle = NAVY;
    ctx.font = "700 " + nSize + "px " + SERIF;
    ctx.fillText(name, W / 2, 592);
    var nw = Math.min(ctx.measureText(name).width + 90, 1180);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2 - nw / 2, 620);
    ctx.quadraticCurveTo(W / 2, 634, W / 2 + nw / 2, 620);
    ctx.stroke();

    ctx.fillStyle = MUTED;
    ctx.font = "italic 28px " + SERIF;
    ctx.fillText('has successfully completed', W / 2, 676);

    var cSize = fitFont(ctx, course, 1280, 48, 'normal', '700');
    ctx.fillStyle = GOLD_DARK;
    ctx.font = "700 " + cSize + "px " + SERIF;
    ctx.fillText(course, W / 2, 736);

    ctx.fillStyle = MUTED;
    ctx.font = "25px " + SERIF;
    ctx.fillText('Score: ' + score + '%   ·   Certificate ID: ' + certId + '   ·   ' + fmtDate(opts.date), W / 2, 788);

    ctx.fillStyle = NAVY_SOFT;
    ctx.font = "italic 27px " + SERIF;
    ctx.fillText(VERSE, W / 2, 846);

    // signature
    ctx.fillStyle = NAVY;
    ctx.font = "italic 600 46px " + SERIF;
    ctx.fillText('Prayer Dome', 400, 968);
    ctx.strokeStyle = MUTED; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(240, 1000); ctx.lineTo(560, 1000); ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = "600 21px " + SERIF;
    spaced(ctx, 'MINISTRY TEAM', 400, 1038, 6);

    seal(ctx, 1205, 946);

    ctx.fillStyle = '#a09a8b';
    ctx.font = "20px " + SERIF;
    ctx.fillText('Verify at prayerdome.net/academy — ' + certId, W / 2, 1082);
  }

  function slug(v) {
    return String(v || 'certificate').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'certificate';
  }

  function saveBlob(blob, filename) {
    if (!blob) return;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 400);
  }

  function dataUrlBlob(canvas) {
    try {
      var dataUrl = canvas.toDataURL('image/png');
      var bin = atob(dataUrl.split(',')[1]);
      var buf = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return new Blob([buf], { type: 'image/png' });
    } catch (e) { return null; }
  }

  function toBlobP(canvas) {
    return new Promise(function (resolve) {
      var settled = false;
      function done(blob) {
        if (settled) return;
        settled = true;
        resolve(blob || dataUrlBlob(canvas));
      }
      if (canvas.toBlob) {
        try {
          canvas.toBlob(done, 'image/png');
          // Some Android WebViews expose toBlob but never invoke its callback.
          // Fall back to toDataURL so the button always finishes.
          setTimeout(function () { done(null); }, 2500);
          return;
        } catch (e) { /* use the synchronous fallback below */ }
      }
      done(null);
    });
  }

  function render(opts) {
    opts = opts || {};
    return loadLogo().then(function (logo) {
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not supported in this browser.');
      draw(ctx, opts, logo);
      return canvas;
    });
  }

  function download(opts) {
    opts = opts || {};
    return render(opts).then(function (canvas) {
      return toBlobP(canvas);
    }).then(function (blob) {
      if (!blob) throw new Error('Could not generate the certificate image.');
      saveBlob(blob, 'prayer-dome-certificate-' + slug(opts.id || opts.name) + '.png');
      return true;
    });
  }

  function bindButton(btn, opts) {
    if (!btn) return;
    var original = btn.innerHTML;
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Preparing…';
      return download(opts).then(function () {
        btn.innerHTML = '<i class="fas fa-check"></i> Downloaded';
        setTimeout(function () { btn.innerHTML = original; btn.disabled = false; }, 2200);
        // Optional tracking hook (e.g. bump the download counter in Firestore)
        if (typeof opts.onDownload === 'function') {
          try { opts.onDownload(opts); }
          catch (e) { if (window.console) console.error('Certificate tracking hook failed', e); }
        }
      }).catch(function (err) {
        btn.innerHTML = original;
        btn.disabled = false;
        if (window.console) console.error('Certificate download failed', err);
        alert('Sorry, the certificate could not be downloaded in this browser. You can still use Print / Save.');
      });
    });
  }

  // Start loading the official mark before a member presses Download.
  loadLogo();

  window.PDCertificate = {
    download: download,
    bindButton: bindButton,
    render: render,
    preview: function (opts) {
      return render(opts).then(function (canvas) {
        return canvas.toDataURL('image/png');
      });
    },
    _draw: draw // exposed for tests
  };
})();
