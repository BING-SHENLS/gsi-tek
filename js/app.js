/* GSI TEK — Plain JavaScript. No build step or third-party dependencies. */
(() => {
  'use strict';
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  const motionButton = document.querySelector('.motion-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const steps = [...document.querySelectorAll('.step')];
  const sizeAnimations = new Map();
  const filterAnimations = new Set();
  const pointerResets = [];
  let manualMotionOff = false;
  let framePending = false;
  const motionEnabled = () => !manualMotionOff && !reducedMotion.matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function setMenu(open, returnFocus = false) {
    menuButton.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
    if (returnFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) setMenu(false, true);
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target) && nav.classList.contains('open')) setMenu(false);
  });
  header.addEventListener('focusout', event => {
    if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', () => setMenu(false));
  document.querySelectorAll('a[href="#top"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: motionEnabled() ? 'smooth' : 'auto' });
    history.replaceState(null, '', '#top');
  }));

  function updateHeader() {
    header.classList.toggle('scrolled', window.scrollY > 24);
    const range = document.documentElement.scrollHeight - window.innerHeight;
    header.style.setProperty('--read-progress', String(range > 0 ? clamp(window.scrollY / range, 0, 1) : 0));
    steps.forEach(step => {
      const rect = step.getBoundingClientRect();
      const progress = clamp((window.innerHeight * .86 - rect.top) / (window.innerHeight * .4), 0, 1);
      step.style.setProperty('--step-progress', motionEnabled() ? String(progress) : '1');
    });
    framePending = false;
  }
  window.addEventListener('scroll', () => {
    if (!framePending) { window.requestAnimationFrame(updateHeader); framePending = true; }
  }, { passive: true });
  window.addEventListener('resize', updateHeader, { passive: true });
  updateHeader();

  // Content remains visible if JavaScript or IntersectionObserver is unavailable.
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -25px 0px' });
    document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
    root.classList.add('motion-ready');
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const link = nav.querySelector(`a[href="#${entry.target.id}"]`);
        if (!link) return;
        if (entry.isIntersecting) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(section => sectionObserver.observe(section));
  }

  // Animate native disclosures; keep their semantics and no-script fallback.
  const expertiseVisual = document.querySelector('.expertise-visual');
  const expertiseLabels = ['01 / 碳管理', '02 / 永續策略', '03 / 國際接軌', '04 / 轉型資源'];
  const expertiseLines = ['MAKE IMPACT MEASURABLE.', 'PUT PURPOSE INTO PRACTICE.', 'CONNECT TO THE NEXT WORLD.', 'TURN POTENTIAL INTO PROGRESS.'];
  function setService(service, open) {
    if (open && expertiseVisual) {
      const index = [...document.querySelectorAll('.service')].indexOf(service);
      expertiseVisual.dataset.service = String(index);
      expertiseVisual.querySelector('.expertise-current').textContent = expertiseLabels[index];
      expertiseVisual.querySelector('.expertise-caption-en').textContent = expertiseLines[index];
    }
    const startHeight = service.getBoundingClientRect().height;
    const previous = sizeAnimations.get(service);
    if (previous) {
      previous.animation.onfinish = null;
      previous.animation.cancel();
      sizeAnimations.delete(service);
    }
    service.style.height = '';
    service.style.overflow = '';
    service.dataset.expanding = String(open);
    const summary = service.querySelector('summary');
    if (!motionEnabled() || !service.animate) {
      service.open = open;
      delete service.dataset.expanding;
      updateHeader();
      document.dispatchEvent(new Event('gsi:layoutchange'));
      return;
    }
    service.open = true;
    const border = parseFloat(getComputedStyle(service).borderTopWidth) + parseFloat(getComputedStyle(service).borderBottomWidth);
    const endHeight = open ? service.getBoundingClientRect().height : summary.getBoundingClientRect().height + border;
    service.style.overflow = 'hidden';
    const animation = service.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], {
      duration: 430, easing: 'cubic-bezier(.22, 1, .36, 1)'
    });
    const settle = () => {
      animation.onfinish = null;
      animation.cancel();
      service.open = open;
      service.style.height = '';
      service.style.overflow = '';
      delete service.dataset.expanding;
      sizeAnimations.delete(service);
      updateHeader();
      document.dispatchEvent(new Event('gsi:layoutchange'));
    };
    sizeAnimations.set(service, { animation, settle });
    animation.onfinish = settle;
  }
  document.querySelectorAll('.service').forEach(service => {
    service.querySelector('summary').addEventListener('click', event => {
      event.preventDefault();
      const open = service.dataset.expanding ? service.dataset.expanding !== 'true' : !service.open;
      if (open) document.querySelectorAll('.service[open]').forEach(other => {
        if (other !== service) setService(other, false);
      });
      setService(service, open);
    });
  });

  const filters = document.querySelectorAll('[data-filter]');
  const newsItems = document.querySelectorAll('.news-item');
  filters.forEach(button => button.addEventListener('click', () => {
    document.querySelector('.news-list').classList.toggle('is-filtered', button.dataset.filter !== 'all');
    filterAnimations.forEach(animation => animation.cancel());
    filterAnimations.clear();
    filters.forEach(filter => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    newsItems.forEach(item => {
      const visible = button.dataset.filter === 'all' || item.dataset.category === button.dataset.filter;
      item.hidden = !visible;
      if (visible) {
        if (motionEnabled() && item.animate) {
          const animation = item.animate([
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ], { duration: 430, delay: count * 65, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
          filterAnimations.add(animation);
          animation.onfinish = () => filterAnimations.delete(animation);
        }
        count++;
      }
    });
    document.querySelector('#news-status').textContent = `顯示 ${count} 則${button.textContent}`;
    updateHeader();
    document.dispatchEvent(new Event('gsi:layoutchange'));
  }));

  // The editorial ribbon only runs while it is on screen.
  const ribbon = document.querySelector('.brand-ribbon');
  if (ribbon && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      ribbon.classList.toggle('ribbon-running', entries[0].isIntersecting);
    }).observe(ribbon);
  }

  // Pointer effects run only on actual movement; no permanent animation loop.
  function pointerResponse(element, move, reset) {
    let frame = 0;
    let point = null;
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      point = null;
      element.classList.remove('pointer-active');
      reset();
    };
    element.addEventListener('pointermove', event => {
      if (!motionEnabled() || !finePointer.matches || event.pointerType === 'touch') return;
      point = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!point || !motionEnabled()) return;
        const rect = element.getBoundingClientRect();
        element.classList.add('pointer-active');
        move(clamp((point.x - rect.left) / rect.width, 0, 1), clamp((point.y - rect.top) / rect.height, 0, 1));
      });
    }, { passive: true });
    element.addEventListener('pointerleave', clear);
    element.addEventListener('pointercancel', clear);
    pointerResets.push(clear);
  }
  const hero = document.querySelector('.hero');
  const stamp = document.querySelector('.hero-stamp');
  pointerResponse(hero, (x, y) => {
    hero.style.setProperty('--light-x', `${x * 100}%`);
    hero.style.setProperty('--light-y', `${y * 100}%`);
    if (stamp) stamp.style.translate = `${(x - .5) * 18}px ${(y - .5) * 14}px`;
  }, () => { if (stamp) stamp.style.translate = ''; });

  const contact = document.querySelector('.contact');
  pointerResponse(contact, (x, y) => {
    contact.style.setProperty('--light-x', `${x * 100}%`);
    contact.style.setProperty('--light-y', `${y * 100}%`);
  }, () => {});

  document.querySelectorAll('.button, .contact-orb').forEach(button => {
    pointerResponse(button, (x, y) => {
      button.style.setProperty('--magnet-x', `${(x - .5) * 12}px`);
      button.style.setProperty('--magnet-y', `${(y - .5) * 10}px`);
    }, () => {
      button.style.removeProperty('--magnet-x');
      button.style.removeProperty('--magnet-y');
    });
  });
  const resetPointers = () => pointerResets.forEach(reset => reset());
  finePointer.addEventListener('change', resetPointers);
  window.addEventListener('blur', resetPointers);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetPointers(); });

  function updateMotion() {
    const off = manualMotionOff || reducedMotion.matches;
    root.classList.toggle('motion-off', off);
    motionButton.setAttribute('aria-pressed', String(off));
    motionButton.textContent = reducedMotion.matches ? '已依系統減少動態' : off ? '開啟動態' : '暫停動態';
    motionButton.disabled = reducedMotion.matches;
    if (off) {
      resetPointers();
      [...sizeAnimations.values()].forEach(({ settle }) => settle());
      filterAnimations.forEach(animation => animation.cancel());
      filterAnimations.clear();
    }
    updateHeader();
    document.dispatchEvent(new CustomEvent('gsi:motionchange', { detail: { off } }));
  }
  motionButton.addEventListener('click', () => { manualMotionOff = !manualMotionOff; updateMotion(); });
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
  document.querySelector('#year').textContent = new Date().getFullYear();
})();
(function(){var a=document.getElementById('approach');if(!a)return;function f(){a.style.setProperty('--approach-angle',Math.atan2(a.offsetHeight,a.offsetWidth)*180/Math.PI+'deg')}f();window.addEventListener('resize',f);if('ResizeObserver'in window)new ResizeObserver(f).observe(a)})();
