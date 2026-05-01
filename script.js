(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────
  var TOTAL_FRAMES = 330;
  var FIRST_FRAME  = 1000;
  var LERP_FACTOR  = 0.08;
  var FPS_CAP      = 60;
  var FRAME_MS     = 1000 / FPS_CAP;
  var MOBILE_BP    = 768;

  // On mobile load every 3rd frame (~110 frames, ~40MB) for fast load
  var isMobile     = window.innerWidth < MOBILE_BP;
  var FRAME_STEP   = isMobile ? 3 : 1;
  var FRAME_COUNT  = Math.ceil(TOTAL_FRAMES / FRAME_STEP);

  // ── DOM refs ───────────────────────────────────────────
  var overlay       = document.getElementById('preload-overlay');
  var pctEl         = document.getElementById('pct');
  var progressBar   = document.getElementById('progress-bar');
  var scrollHint    = document.getElementById('scroll-hint');
  var scrollWrapper = document.getElementById('scroll-wrapper');
  var canvas        = document.getElementById('hero-canvas');
  var ctx           = canvas.getContext('2d');
  var cursorEl      = document.getElementById('cursor');

  // ── Custom Cursor ──────────────────────────────────────
  var cx = 0, cy = 0;
  var mx = window.innerWidth  / 2;
  var my = window.innerHeight / 2;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;
  });

  var hoverTargets = document.querySelectorAll('a, button, .stat-block');
  for (var h = 0; h < hoverTargets.length; h++) {
    hoverTargets[h].addEventListener('mouseenter', function () {
      cursorEl.classList.add('halo');
    });
    hoverTargets[h].addEventListener('mouseleave', function () {
      cursorEl.classList.remove('halo');
    });
  }

  function tickCursor() {
    requestAnimationFrame(tickCursor);
    cx += (mx - cx) * 0.18;
    cy += (my - cy) * 0.18;
    cursorEl.style.transform = 'translate(' + cx + 'px, ' + cy + 'px)';
  }
  tickCursor();

  // ── State ──────────────────────────────────────────────
  var images       = new Array(FRAME_COUNT);
  var currentFrame = 0;
  var targetFrame  = 0;
  var isLoaded     = false;
  var hasScrolled  = false;
  var lastTs       = 0;
  var dpr          = 1;

  // ── Image path builder ─────────────────────────────────
  // i = logical index (0..FRAME_COUNT-1), maps to actual frame via FRAME_STEP
  function framePath(i) {
    var n = String(FIRST_FRAME + i * FRAME_STEP).padStart(5, '0');
    return 'assets/scroll-sequence/Sequence ' + n + '.jpg';
  }

  // ── Canvas sizing ──────────────────────────────────────
  function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }

  // ── Scroll wrapper height ──────────────────────────────
  function setWrapperHeight() {
    var px = isMobile ? 4 : 6;
    scrollWrapper.style.height = (window.innerHeight + TOTAL_FRAMES * px) + 'px';
  }

  // ── Object-fit cover draw ──────────────────────────────
  function drawFrame(img) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var ir = img.naturalWidth / img.naturalHeight;
    var vr = vw / vh;
    var sw, sh, sx, sy;

    if (ir > vr) {
      sh = vh;
      sw = vh * ir;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / ir;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.drawImage(img, sx, sy, sw, sh);
  }

  // ── Scroll hint fade ───────────────────────────────────
  function fadeScrollHint() {
    if (scrollHint) scrollHint.style.opacity = '0';
  }

  // ── Headline reveal ────────────────────────────────────
  function revealHeadline() {
    var reveals = document.querySelectorAll('.headline-reveal');
    for (var i = 0; i < reveals.length; i++) {
      reveals[i].classList.add('visible');
    }
  }

  // ── Scroll handler ─────────────────────────────────────
  function onScroll() {
    if (!isLoaded) return;

    if (!hasScrolled) {
      hasScrolled = true;
      fadeScrollHint();
    }

    var rect        = scrollWrapper.getBoundingClientRect();
    var totalScroll = scrollWrapper.offsetHeight - window.innerHeight;
    var scrolled    = -rect.top;
    var progress    = Math.max(0, Math.min(1, scrolled / totalScroll));

    targetFrame = progress * (FRAME_COUNT - 1);
    progressBar.style.width = (progress * 100) + '%';
  }

  // ── RAF render loop ────────────────────────────────────
  function tick(timestamp) {
    requestAnimationFrame(tick);

    if (!isLoaded) return;

    var delta = timestamp - lastTs;
    if (delta < FRAME_MS) return;
    lastTs = timestamp - (delta % FRAME_MS);

    currentFrame += (targetFrame - currentFrame) * LERP_FACTOR;

    var idx = Math.round(currentFrame);
    idx = Math.max(0, Math.min(FRAME_COUNT - 1, idx));

    var img = images[idx];
    if (img && img.complete && img.naturalWidth > 0) {
      drawFrame(img);
    }
  }

  // ── Preloader ──────────────────────────────────────────
  function preload() {
    var loaded = 0;

    function onImageLoad() {
      loaded++;
      var pct = Math.floor((loaded / FRAME_COUNT) * 100);
      pctEl.textContent = pct;

      if (loaded === FRAME_COUNT) {
        pctEl.textContent = '100';
        setTimeout(function () {
          overlay.classList.add('hidden');
          setTimeout(revealHeadline, 250);
          setTimeout(function () {
            isLoaded = true;
          }, 650);
        }, 200);
      }
    }

    for (var i = 0; i < FRAME_COUNT; i++) {
      (function (index) {
        var img = new Image();
        img.onload  = onImageLoad;
        img.onerror = onImageLoad;
        img.src     = framePath(index);
        images[index] = img;
      })(i);
    }
  }

  // ── Resize handler ─────────────────────────────────────
  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeCanvas();
      setWrapperHeight();
      onScroll();
    }, 100);
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    resizeCanvas();
    setWrapperHeight();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    requestAnimationFrame(tick);
    preload();
  }

  init();

})();
