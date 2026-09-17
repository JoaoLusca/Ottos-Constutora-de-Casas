(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileQuery = window.matchMedia('(max-width: 900px)');

  const loader = $('#pageLoader');
  const topHeader = $('#siteHeader');
  const floatingHeader = $('#siteHeaderFloat');
  const app = $('#app');
  const year = $('#year');

  if (year) year.textContent = new Date().getFullYear();

  /* Loader — homepage only when the element exists. */
  const loaderStartedAt = performance.now();
  const minimumLoaderTime = reduceMotion ? 500 : 1900;
  const hideLoader = () => {
    if (!loader || loader.dataset.closed === 'true') return;
    const remaining = Math.max(0, minimumLoaderTime - (performance.now() - loaderStartedAt));
    window.setTimeout(() => {
      if (loader.dataset.closed === 'true') return;
      loader.dataset.closed = 'true';
      loader.classList.add('is-hidden');
      document.dispatchEvent(new CustomEvent('ottos:loader-hidden'));
    }, remaining);
  };
  if (document.readyState === 'complete') hideLoader();
  else window.addEventListener('load', hideLoader, { once: true });
  window.setTimeout(hideLoader, 5000);

  /* Shared mobile menu — works on every page without third-party libraries. */
  const initMobileMenu = () => {
    const menu = $('#mobileMenu');
    const toggles = $$('.menu-toggle');
    const close = $('.mobile-menu-close');
    if (!menu || !toggles.length) return;

    const setMenu = (open) => {
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', String(!open));
      toggles.forEach(button => button.setAttribute('aria-expanded', String(open)));
      document.body.classList.toggle('menu-open', open);
    };

    toggles.forEach(button => button.addEventListener('click', () => setMenu(true)));
    close?.addEventListener('click', () => setMenu(false));
    $$('a', menu).forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenu(false);
    });
  };
  initMobileMenu();

  /* Shared top -> floating header behavior. */
  let loco = null;
  let headerVisible = false;
  const updateHeader = (y) => {
    const next = Number(y || 0) > 80;
    if (next === headerVisible) return;
    headerVisible = next;
    topHeader?.classList.toggle('is-dimmed', next && !mobileQuery.matches);
    floatingHeader?.classList.toggle('is-visible', next);
    floatingHeader?.setAttribute('aria-hidden', String(!next));
  };

  const onNativeScroll = () => {
    if (loco && !mobileQuery.matches) return;
    updateHeader(window.scrollY || document.documentElement.scrollTop || 0);
  };
  window.addEventListener('scroll', onNativeScroll, { passive: true });
  onNativeScroll();

  /* Hero entrance — lightweight native animation. */
  const playHeroEntrance = () => {
    if (reduceMotion) return;
    $$('.hero-reveal').forEach((el, index) => {
      el.animate(
        [
          { opacity: 0, transform: 'translate3d(0,22px,0)' },
          { opacity: 1, transform: 'translate3d(0,0,0)' }
        ],
        {
          duration: 700,
          delay: index * 70,
          easing: 'cubic-bezier(.22,1,.36,1)',
          fill: 'both'
        }
      );
    });
  };
  document.addEventListener('ottos:loader-hidden', playHeroEntrance, { once: true });
  if (!loader || loader.classList.contains('is-hidden')) playHeroEntrance();

  /* Hero slideshow: two decoded image nodes at a time. */
  const initHeroSlideshow = () => {
    const stage = $('[data-hero-slideshow]');
    if (!stage) return;
    const slots = $$('[data-hero-slot]', stage);
    const total = Number(stage.dataset.total || 0);
    if (slots.length < 2 || total < 2) return;

    let outgoing = slots[0];
    let incoming = slots[1];
    let currentIndex = 0;
    let timer = 0;
    let stopped = false;
    const holdTime = reduceMotion ? 7200 : 6100;
    const fadeTime = reduceMotion ? 460 : (mobileQuery.matches ? 1250 : 1450);

    const pathFor = (index) => {
      const num = String(index + 1).padStart(2, '0');
      return mobileQuery.matches
        ? `assets/images/projects/mobile/residencia-ottos-uberlandia-${num}-720.webp`
        : `assets/images/projects/residencia-ottos-uberlandia-${num}.webp`;
    };

    const schedule = (delay = holdTime) => {
      window.clearTimeout(timer);
      if (!stopped && !document.hidden) timer = window.setTimeout(nextSlide, delay);
    };

    const loadInto = (img, src) => new Promise(resolve => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        resolve(ok);
      };
      const onLoad = () => finish(true);
      const onError = () => finish(false);
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onError, { once: true });
      img.src = src;
      if (img.complete) queueMicrotask(() => finish(Boolean(img.naturalWidth)));
      if (typeof img.decode === 'function') {
        img.decode().then(() => finish(true)).catch(() => {
          if (img.complete) finish(Boolean(img.naturalWidth));
        });
      }
    });

    async function nextSlide() {
      if (stopped || document.hidden) return;
      const nextIndex = (currentIndex + 1) % total;
      incoming.classList.remove('is-active', 'is-leaving');
      incoming.style.zIndex = '2';
      const ready = await loadInto(incoming, pathFor(nextIndex));
      if (!ready || stopped) {
        incoming.style.zIndex = '';
        schedule(1800);
        return;
      }

      requestAnimationFrame(() => {
        incoming.classList.add('is-active');
        outgoing.classList.add('is-leaving');
      });

      window.setTimeout(() => {
        outgoing.classList.remove('is-active', 'is-leaving');
        outgoing.removeAttribute('srcset');
        outgoing.style.zIndex = '0';
        incoming.style.zIndex = '1';
        [outgoing, incoming] = [incoming, outgoing];
        currentIndex = nextIndex;
        schedule();
      }, fadeTime + 80);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.clearTimeout(timer);
      else schedule(900);
    }, { passive: true });
    schedule(900);
  };
  document.addEventListener('ottos:loader-hidden', initHeroSlideshow, { once: true });
  if (!loader || loader.classList.contains('is-hidden')) initHeroSlideshow();

  /* Subtle section motion implemented with browser-native APIs. */
  const initSectionMotion = () => {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    const targets = [
      ...$$('.statement-copy,.gallery-intro,.services-intro,.contact-head>p:last-child'),
      ...$$('.service-card')
    ];
    if (!targets.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = el.classList.contains('service-card')
          ? Math.min(180, $$('.service-card').indexOf(el) * 45)
          : 0;
        el.animate(
          [
            { opacity: 0, transform: 'translate3d(0,24px,0)' },
            { opacity: 1, transform: 'translate3d(0,0,0)' }
          ],
          { duration: 680, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
        );
        observer.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(el => observer.observe(el));
  };
  initSectionMotion();

  /* Desktop gallery accordion. */
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.gallery-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        $$('.gallery-item').forEach(card => card.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }

  /* Internal links: use Locomotive only if it actually started. */
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      if (loco && !mobileQuery.matches) {
        event.preventDefault();
        loco.scrollTo(target, { offset: -24, duration: 900 });
      }
    });
  });

  /* Optional desktop smooth scrolling. */
  const loadScript = (src, timeout = 5000) => new Promise((resolve, reject) => {
    let settled = false;
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      script.remove();
      reject(new Error(`Timeout ao carregar ${src}`));
    }, timeout);
    script.src = src;
    script.async = true;
    script.addEventListener('load', () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(new Error(`Falha ao carregar ${src}`));
    }, { once: true });
    document.head.appendChild(script);
  });

  const initDesktopSmoothScroll = async () => {
    if (mobileQuery.matches || reduceMotion || !app) return;
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js');
      if (!window.LocomotiveScroll) return;
      loco = new window.LocomotiveScroll({
        el: app,
        smooth: true,
        lerp: 0.085,
        multiplier: 1,
        smartphone: { smooth: false },
        tablet: { smooth: false }
      });
      loco.on('scroll', event => updateHeader(event?.scroll?.y ?? 0));
      requestAnimationFrame(() => loco?.update());
      window.setTimeout(() => loco?.update(), 240);
    } catch (error) {
      console.warn('[OTTOS] Smooth scroll indisponível; usando scroll nativo.', error);
      loco = null;
    }
  };
  initDesktopSmoothScroll();

  mobileQuery.addEventListener?.('change', () => window.location.reload());
})();
