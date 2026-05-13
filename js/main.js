/* ============================================================
   MAIN.JS — Lanzarote Producciones
   ============================================================ */

// ── VIEWPORT HEIGHT FIX (iOS Safari) ──────────────────────────
// iOS Safari reports incorrect values for 100vh/100svh/100dvh.
// This sets --vh to the real visible height so the slideshow
// fills the screen correctly on every iPhone.
(function setVH() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
})();
window.addEventListener('resize', function() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', vh + 'px');
}, { passive: true });

document.addEventListener('DOMContentLoaded', () => {

  // ── NAV: scroll state ──────────────────────────────────────
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── NAV: active link ──────────────────────────────────────
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a').forEach(a => {
    if (a.getAttribute('href') === currentPath) a.classList.add('active');
  });

  // ── BURGER MENU ───────────────────────────────────────────
  const burger = document.querySelector('.nav__burger');
  const navLinks = document.querySelector('.nav__links');

  function closeNav() {
    burger.classList.remove('open');
    navLinks.classList.remove('open');
    document.body.classList.remove('nav-open');
  }

  function openNav() {
    burger.classList.add('open');
    navLinks.classList.add('open');
    document.body.classList.add('nav-open');
  }

  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      if (navLinks.classList.contains('open')) { closeNav(); } else { openNav(); }
    });

    // Close when any link is tapped
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeNav);
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeNav();
    });
  }

  // ── HERO: entrance animation (inner pages) ───────────────
  const hero = document.querySelector('.hero');
  if (hero) {
    requestAnimationFrame(() => setTimeout(() => hero.classList.add('loaded'), 80));
  }

  // ── SLIDESHOW ─────────────────────────────────────────────
  const slideshowEl = document.querySelector('.slideshow');
  if (slideshowEl) {
    const slides   = slideshowEl.querySelectorAll('.slide');
    const dots     = slideshowEl.querySelectorAll('.slideshow__dot');
    const counter  = slideshowEl.querySelector('.slideshow__counter');
    const progress = slideshowEl.querySelector('.slideshow__progress');
    const total    = slides.length;
    let current    = 0;
    let autoTimer  = null;

    const updateCounter = () => {
      if (counter) counter.textContent =
        `${String(current + 1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;
    };

    const resetProgress = () => {
      if (!progress) return;
      progress.classList.remove('running');
      progress.style.transition = 'none';
      progress.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        progress.classList.add('running');
      }));
    };

    const goTo = (index) => {
      slides[current].classList.remove('active');
      dots[current]?.classList.remove('active');
      current = (index + total) % total;
      slides[current].classList.add('active');
      dots[current]?.classList.add('active');
      updateCounter();
      resetProgress();
    };

    const next = () => goTo(current + 1);
    const prev = () => goTo(current - 1);

    const startAuto = () => {
      clearInterval(autoTimer);
      autoTimer = setInterval(next, 6000);
    };

    const resetAuto = () => startAuto();

    // Init
    setTimeout(() => slideshowEl.classList.add('loaded'), 80);
    updateCounter();
    startAuto();
    resetProgress();

    // Arrows
    slideshowEl.querySelector('.slideshow__arrow--prev')
      ?.addEventListener('click', () => { prev(); resetAuto(); });
    slideshowEl.querySelector('.slideshow__arrow--next')
      ?.addEventListener('click', () => { next(); resetAuto(); });

    // Dots
    dots.forEach((dot, i) =>
      dot.addEventListener('click', () => { goTo(i); resetAuto(); })
    );

    // Touch swipe
    let touchX = 0;
    slideshowEl.addEventListener('touchstart', e => {
      touchX = e.touches[0].clientX;
    }, { passive: true });
    slideshowEl.addEventListener('touchend', e => {
      const diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); resetAuto(); }
    });

    // Mouse wheel — only navigates slides when page hasn't scrolled yet
    let wheelLocked = false;
    slideshowEl.addEventListener('wheel', e => {
      if (wheelLocked || window.scrollY > 80) return;
      e.preventDefault();
      wheelLocked = true;
      setTimeout(() => { wheelLocked = false; }, 900);
      e.deltaY > 0 ? next() : prev();
      resetAuto();
    }, { passive: false });
  }

  // ── SCROLL REVEAL ─────────────────────────────────────────
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ── COOKIE BANNER ─────────────────────────────────────────
  const banner = document.querySelector('.cookie-banner');
  if (banner && !localStorage.getItem('lp_cookies')) {
    banner.classList.add('show');
    banner.querySelector('.js-cookie-accept')?.addEventListener('click', () => {
      localStorage.setItem('lp_cookies', 'accepted');
      banner.style.transition = 'transform 0.4s ease';
      banner.style.transform = 'translateY(110%)';
    });
    banner.querySelector('.js-cookie-reject')?.addEventListener('click', () => {
      banner.style.transition = 'transform 0.4s ease';
      banner.style.transform = 'translateY(110%)';
    });
  }

  // ── CONTACT / TALENT FORM ─────────────────────────────────
  const form = document.querySelector('.js-contact-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('.form__status');
      const btn = form.querySelector('[type="submit"]');
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = 'Enviando...';
      if (status) { status.className = 'form__status'; status.textContent = ''; }

      try {
        const data = Object.fromEntries(new FormData(form));
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (res.ok) {
          if (status) { status.className = 'form__status success'; status.textContent = json.message || '¡Mensaje enviado! Te contactaremos pronto.'; }
          form.reset();
        } else {
          throw new Error(json.error || 'Error al enviar');
        }
      } catch (err) {
        if (status) { status.className = 'form__status error'; status.textContent = err.message || 'Error al enviar. Intenta de nuevo.'; }
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  // ── SMOOTH ANCHOR LINKS ───────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── STAT COUNTER ANIMATION ────────────────────────────────
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const duration = 1800;
      const start = performance.now();

      const tick = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (Number.isInteger(target) ? Math.round(target * eased) : (target * eased).toFixed(1)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

});
