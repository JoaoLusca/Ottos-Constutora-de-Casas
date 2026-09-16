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

  /* Loader: long enough to feel intentional, without animating the logo itself. */
  const loaderStartedAt = performance.now();
  const minimumLoaderTime = reduceMotion ? 700 : 2300;
  const hideLoader = () => {
    if (!loader || loader.dataset.closed === 'true') return;
    const remaining = Math.max(0, minimumLoaderTime - (performance.now() - loaderStartedAt));
    window.setTimeout(() => {
      loader.dataset.closed = 'true';
      loader.classList.add('is-hidden');
      document.dispatchEvent(new CustomEvent('ottos:loader-hidden'));
    }, remaining);
  };
  if (document.readyState === 'complete') hideLoader();
  else window.addEventListener('load', hideLoader, { once: true });
  window.setTimeout(hideLoader, 5200); // network-safe fallback

  /* Mobile menu is initialized first and never depends on GSAP/Locomotive. */
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
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
  };
  initMobileMenu();

  /* Hero slideshow is CSS-driven.
     This intentionally has no JS timer so it remains independent from GSAP,
     Locomotive Scroll, browser timer throttling and prefers-reduced-motion JS state. */

  const gsap = window.gsap || null;
  const ScrollTrigger = window.ScrollTrigger || null;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* Header state: mobile uses native scroll only. Locomotive is desktop-only. */
  let headerVisible = false;
  const updateHeader = (y) => {
    const next = Number(y || 0) > 80;
    if (next === headerVisible) return;
    headerVisible = next;
    topHeader?.classList.toggle('is-dimmed', next && !mobileQuery.matches);
    floatingHeader?.classList.toggle('is-visible', next);
    floatingHeader?.setAttribute('aria-hidden', String(!next));
  };

  const initScroll = () => {
    let loco = null;
    const useLocomotive = !mobileQuery.matches && !reduceMotion && !!window.LocomotiveScroll && !!app;

    if (useLocomotive) {
      try {
        loco = new window.LocomotiveScroll({
          el: app,
          smooth: true,
          lerp: 0.085,
          multiplier: 1,
          smartphone: { smooth: false },
          tablet: { smooth: false }
        });
        loco.on('scroll', event => {
          updateHeader(event?.scroll?.y ?? 0);
          if (ScrollTrigger) ScrollTrigger.update();
        });
      } catch (error) {
        console.warn('[OTTOS] Locomotive Scroll não iniciou; usando scroll nativo.', error);
        loco = null;
      }
    }

    /* Native listener always exists. On mobile this is the authoritative scroll source. */
    const onNativeScroll = () => {
      if (!loco || mobileQuery.matches) updateHeader(window.scrollY || document.documentElement.scrollTop || 0);
    };
    window.addEventListener('scroll', onNativeScroll, { passive: true });
    onNativeScroll();

    if (loco && gsap && ScrollTrigger) {
      try {
        ScrollTrigger.scrollerProxy(app, {
          scrollTop(value) {
            if (arguments.length) {
              loco.scrollTo(value, { duration: 0, disableLerp: true });
              return;
            }
            return loco.scroll?.instance?.scroll?.y || 0;
          },
          getBoundingClientRect() { return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }; },
          pinType: app.style.transform ? 'transform' : 'fixed'
        });
        ScrollTrigger.addEventListener('refresh', () => loco.update());
        window.setTimeout(() => ScrollTrigger.refresh(), 250);
      } catch (error) {
        console.warn('[OTTOS] Integração ScrollTrigger/Locomotive indisponível.', error);
      }
    }

    return loco;
  };

  const loco = initScroll();

  /* Hero entrance animation. All other essential interactions remain independent. */
  if (gsap && !reduceMotion) {
    gsap.from('.hero-reveal', { y: 32, opacity: 0, stagger: 0.09, duration: 0.9, ease: 'power3.out', delay: 0.18 });
  }

  /* Robust Redacted Reveal without SplitText dependency. */
  const buildWordSpans = (heading) => {
    const textNodes = [];
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.reveal-word')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
      const parent = node.parentElement;
      const computedColor = window.getComputedStyle(parent).color;
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const word = document.createElement('span');
        word.className = 'reveal-word';
        word.style.setProperty('--word-color', computedColor);
        const text = document.createElement('span');
        text.className = 'reveal-word__text';
        text.textContent = part;
        const bar = document.createElement('span');
        bar.className = 'reveal-word__bar';
        bar.setAttribute('aria-hidden', 'true');
        word.append(text, bar);
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return $$('.reveal-word', heading);
  };

  const revealEntries = $$('.redacted-heading').map(heading => ({
    heading,
    words: buildWordSpans(heading),
    done: false
  }));

  const revealHeading = (entry) => {
    if (entry.done || !entry.words.length) return;
    entry.done = true;

    if (gsap && !reduceMotion) {
      const tl = gsap.timeline();
      entry.words.forEach((word, i) => {
        const bar = $('.reveal-word__bar', word);
        const text = $('.reveal-word__text', word);
        const color = word.style.getPropertyValue('--word-color') || 'currentColor';
        tl.to(bar, { scaleX: 0, transformOrigin: 'right center', duration: 0.48, ease: 'power2.inOut' }, i * 0.13)
          .to(text, { color, duration: 0.24, ease: 'power1.out' }, i * 0.13 + 0.16);
      });
    } else {
      entry.words.forEach((word, i) => {
        window.setTimeout(() => word.classList.add('is-revealed'), reduceMotion ? 0 : 140 + i * 130);
      });
    }
  };

  /* rAF viewport monitor works with both transformed desktop scrolling and native mobile scrolling. */
  const monitorReveals = () => {
    let pending = false;
    for (const entry of revealEntries) {
      if (entry.done) continue;
      pending = true;
      const rect = entry.heading.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.68 && rect.bottom > window.innerHeight * 0.08) revealHeading(entry);
    }
    if (pending) window.requestAnimationFrame(monitorReveals);
  };
  window.requestAnimationFrame(monitorReveals);

  /* Secondary GSAP scroll animations are desktop-enhancements only. */
  if (gsap && ScrollTrigger && loco && !reduceMotion) {
    const scroller = app;
    $$('.statement-copy,.gallery-intro,.services-intro,.contact-head>p:last-child').forEach(el => {
      gsap.from(el, { y: 28, opacity: 0, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: el, scroller, start: 'top 88%' } });
    });
    $$('.service-card').forEach((el, i) => {
      gsap.from(el, { y: 42, opacity: 0, duration: 0.8, delay: i * 0.06, ease: 'power3.out', scrollTrigger: { trigger: el, scroller, start: 'top 88%' } });
    });
    gsap.to('.breath-word', { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.breath', scroller, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* Desktop accordion. Touch devices keep their horizontal swipe carousel. */
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    $$('.gallery-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        $$('.gallery-item').forEach(card => card.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }

  /* Magnetic buttons are desktop-only and optional. */
  if (gsap && window.matchMedia('(hover:hover) and (pointer:fine)').matches && !reduceMotion) {
    $$('.btn').forEach(btn => {
      btn.addEventListener('mousemove', event => {
        const rect = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (event.clientX - rect.left - rect.width / 2) * 0.05,
          y: (event.clientY - rect.top - rect.height / 2) * 0.08,
          duration: 0.25,
          ease: 'power2.out',
          overwrite: true
        });
      });
      btn.addEventListener('mouseleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.35, ease: 'power3.out', overwrite: true }));
    });
  }

  /* Smooth internal links on mobile/native scroll; Locomotive handles desktop. */
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

  /* If viewport crosses the desktop/mobile breakpoint during development, refresh safely. */
  mobileQuery.addEventListener?.('change', () => window.location.reload());
})();
