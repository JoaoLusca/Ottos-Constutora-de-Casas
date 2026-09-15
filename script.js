(() => {
  'use strict';

  const app = document.getElementById('app');
  const header = document.getElementById('siteHeader');
  const floatingHeader = document.getElementById('siteHeaderFloat');
  const loader = document.getElementById('pageLoader');
  const year = document.getElementById('year');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (year) year.textContent = new Date().getFullYear();

  // Keep the loader visible long enough to be perceived, while also waiting
  // for the page resources to finish loading. The previous 350ms timeout was
  // too short and made the loader look like a flash.
  const loaderStart = performance.now();
  const minimumLoaderMs = reduceMotion ? 600 : 1700;
  let pageLoaded = document.readyState === 'complete';

  const hideLoader = () => {
    if (!loader || loader.dataset.closed === 'true') return;
    const elapsed = performance.now() - loaderStart;
    const remaining = Math.max(0, minimumLoaderMs - elapsed);
    setTimeout(() => {
      loader.dataset.closed = 'true';
      loader.classList.add('is-hidden');
    }, remaining);
  };

  if (pageLoaded) {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader, { once: true });
  }

  const init = () => {
    const gsap = window.gsap;
    const hasScrollTrigger = !!window.ScrollTrigger && !!gsap;
    const hasSplitText = !!window.SplitText && !!gsap;

    if (!gsap) {
      console.warn('[OTTOS] GSAP failed to load. Native interactions will be used where possible.');
      document.body.classList.add('no-gsap');
    } else {
      if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
      if (window.SplitText) gsap.registerPlugin(window.SplitText);
    }

    // Cursor
    if (gsap) {
      const dot = document.querySelector('.cursor-dot');
      const ring = document.querySelector('.cursor-ring');
      if (dot && ring && !('ontouchstart' in window)) {
        let mx = innerWidth / 2, my = innerHeight / 2;
        let rx = mx, ry = my;
        window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; dot.style.opacity='1'; ring.style.opacity='1'; }, { passive:true });
        gsap.ticker.add(() => {
          rx += (mx-rx)*.18; ry += (my-ry)*.18;
          dot.style.left=`${mx}px`; dot.style.top=`${my}px`;
          ring.style.left=`${rx}px`; ring.style.top=`${ry}px`;
        });
        document.querySelectorAll('a,button,.gallery-item').forEach(el=>{
          el.addEventListener('mouseenter',()=>gsap.to(ring,{scale:1.5,duration:.25,overwrite:true}));
          el.addEventListener('mouseleave',()=>gsap.to(ring,{scale:1,duration:.25,overwrite:true}));
        });
      }
    }

    // Locomotive is used only for the content scroller. The headers remain outside it,
    // so position:fixed is truly viewport-fixed and can animate without layout jumps.
    let loco = null;
    if (window.LocomotiveScroll && app && !reduceMotion) {
      loco = new LocomotiveScroll({ el: app, smooth: true, lerp: 0.085, smartphone:{smooth:false}, tablet:{smooth:false} });
    }

    let currentY = 0;
    let headerState = false;
    const setHeaderState = (scrolled) => {
      if (scrolled === headerState) return;
      headerState = scrolled;
      if (header) header.classList.toggle('is-dimmed', scrolled);
      if (floatingHeader) {
        floatingHeader.classList.toggle('is-visible', scrolled);
        floatingHeader.setAttribute('aria-hidden', String(!scrolled));
      }
    };
    const readY = () => {
      if (loco && typeof loco.scroll?.instance?.scroll?.y === 'number') return loco.scroll.instance.scroll.y;
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const onScrollY = (y) => {
      currentY = Math.max(0, Number(y) || 0);
      setHeaderState(currentY > 80);
      if (hasScrollTrigger) window.ScrollTrigger.update();
    };

    if (loco) {
      loco.on('scroll', args => {
        const y = typeof args?.scroll?.y === 'number' ? args.scroll.y : readY();
        onScrollY(y);
      });
      onScrollY(readY());
    } else {
      const onNative = () => onScrollY(window.scrollY || document.documentElement.scrollTop || 0);
      window.addEventListener('scroll', onNative, { passive:true });
      onNative();
    }

    if (hasScrollTrigger && loco) {
      window.ScrollTrigger.scrollerProxy(app, {
        scrollTop(value) {
          if (arguments.length) { loco.scrollTo(value, { duration: 0, disableLerp: true }); return; }
          return readY();
        },
        getBoundingClientRect() { return { top:0,left:0,width:innerWidth,height:innerHeight }; },
        pinType: 'transform'
      });
      loco.on('scroll', window.ScrollTrigger.update);
      window.ScrollTrigger.addEventListener('refresh', () => loco.update());
    }

    // Hero
    if (gsap) {
      gsap.from('.hero-reveal', { y:40, opacity:0, stagger:.1, duration:1, ease:'power3.out', delay:.25 });
      gsap.to('.hero-image', { scale:1, duration:2, ease:'power2.out', delay:.05 });
    }

    // Reliable redacted reveal: create one set of word spans and trigger them from the
    // actual locomotive scroll position. This avoids depending on ScrollTrigger to detect
    // transformed descendants for the reveal itself.
    const splitWordsFallback = el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes=[];
      while(walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node=>{
        const frag=document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(part=>{
          if(/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else if(part){ const span=document.createElement('span'); span.className='redacted-word'; span.textContent=part; frag.appendChild(span); }
        });
        node.parentNode.replaceChild(frag,node);
      });
      return [...el.querySelectorAll(':scope .redacted-word')];
    };

    const revealItems=[];
    const prepareReveal = el => {
      if (!el || el.dataset.redactedReady === 'true') return;
      let words=[];
      if (hasSplitText) {
        try {
          const split = new window.SplitText(el,{type:'words'});
          words = split.words;
        } catch(e) { words = splitWordsFallback(el); }
      } else words = splitWordsFallback(el);
      if(!words.length) return;

      const color=getComputedStyle(el).color;
      words.forEach(word=>{
        word.classList.add('redacted-word');
        word.style.setProperty('--reveal-color',color);
        word.style.color='transparent';
        word.style.backgroundImage=`linear-gradient(${color},${color})`;
        word.style.backgroundSize='100% 100%';
        word.style.backgroundRepeat='no-repeat';
        word.style.backgroundPosition='100% 0';
        word.style.padding='0 .045em';
      });
      revealItems.push({el,words,revealed:false});
      el.dataset.redactedReady='true';
    };

    document.querySelectorAll('.statement h2,.gallery h2,.services h2,.blog h2,.contact h2').forEach(prepareReveal);

    const revealNow = item => {
      if(item.revealed) return;
      item.revealed=true;

      // GSAP path: same word-by-word Redacted Reveal concept as the reference.
      if (gsap) {
        const tl=gsap.timeline({
          onComplete:()=>item.words.forEach(word=>{
            const c = word.style.getPropertyValue('--reveal-color').trim() || getComputedStyle(item.el).color;
            gsap.set(word,{color:c,backgroundSize:'0% 100%'});
          })
        });
        item.words.forEach((word,i)=>{
          const revealColor = word.style.getPropertyValue('--reveal-color').trim() || getComputedStyle(item.el).color;
          tl.to(word,{backgroundSize:'0% 100%',duration:.26,ease:'power2.inOut'},i*.075)
            .to(word,{color:revealColor,duration:.16,ease:'power1.out'},i*.075+.08);
        });
        return;
      }

      // Native fallback: keeps the reveal functional even if a CDN is unavailable.
      item.words.forEach((word,i)=>{
        setTimeout(()=>{
          word.classList.add('is-revealed');
          word.style.color = word.style.getPropertyValue('--reveal-color').trim() || getComputedStyle(item.el).color;
        }, i * 75);
      });
    };

    const checkReveal = () => {
      const viewportH = innerHeight;
      revealItems.forEach(item=>{
        if(item.revealed) return;
        const rect=item.el.getBoundingClientRect();
        if(rect.top < viewportH*.82 && rect.bottom > 0) revealNow(item);
      });
    };

    if(loco) loco.on('scroll', checkReveal);
    window.addEventListener('scroll',checkReveal,{passive:true});
    window.addEventListener('resize',checkReveal,{passive:true});
    requestAnimationFrame(()=>setTimeout(checkReveal,120));

    // Breath words keep their gradient; each line simply gets a subtle entrance.
    if(gsap && hasScrollTrigger && app) {
      const triggerConfig={scroller:app};
      gsap.utils.toArray('.statement-copy,.gallery-intro,.services-intro,.contact-head>p:last-child').forEach(el=>{
        gsap.from(el,{y:30,opacity:0,duration:.8,ease:'power2.out',scrollTrigger:{...triggerConfig,trigger:el,start:'top 88%'}});
      });
      gsap.utils.toArray('.service-card').forEach((el,i)=>{
        gsap.from(el,{y:50,opacity:0,duration:.8,delay:i*.08,ease:'power3.out',scrollTrigger:{...triggerConfig,trigger:el,start:'top 86%'}});
      });
      gsap.to('.breath-word',{yPercent:-10,scrollTrigger:{...triggerConfig,trigger:'.breath',start:'top bottom',end:'bottom top',scrub:true}});
    }

    // Gallery accordion
    document.querySelectorAll('.gallery-item').forEach(item=>{
      item.addEventListener('mouseenter',()=>{
        document.querySelectorAll('.gallery-item').forEach(x=>x.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Magnetic CTAs
    if(gsap){
      document.querySelectorAll('.btn').forEach(btn=>{
        btn.addEventListener('mousemove',e=>{
          const r=btn.getBoundingClientRect();
          const x=(e.clientX-r.left-r.width/2)*.06;
          const y=(e.clientY-r.top-r.height/2)*.12;
          gsap.to(btn,{x,y,duration:.25,ease:'power2.out',overwrite:true});
        });
        btn.addEventListener('mouseleave',()=>gsap.to(btn,{x:0,y:0,duration:.4,ease:'power3.out',overwrite:true}));
      });
    }

    // Mobile menu
    const toggles=[...document.querySelectorAll('.menu-toggle')];
    const menu=document.querySelector('.mobile-menu');
    if(toggles.length&&menu){
      const setMenu=(open)=>{
        menu.classList.toggle('open',open);
        menu.setAttribute('aria-hidden',String(!open));
        toggles.forEach(t=>t.setAttribute('aria-expanded',String(open)));
        document.body.style.overflow=open?'hidden':'';
      };
      toggles.forEach(toggle=>toggle.addEventListener('click',()=>setMenu(!menu.classList.contains('open'))));
      menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
    }

    if(hasScrollTrigger){
      window.addEventListener('load',()=>setTimeout(()=>window.ScrollTrigger.refresh(),300),{once:true});
    }
    // Initial states always correct even with no JS animation libraries.
    checkReveal();
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
