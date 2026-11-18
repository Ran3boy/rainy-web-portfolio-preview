(() => {
  const region = document.querySelector('[data-work-slider]');
  if (!region) return;
  const stage = region.querySelector('.ws-stage');
  const slides = [...stage.querySelectorAll('[data-slide]')];
  const picks = [...region.querySelectorAll('[data-work-pick]')].map(link => {
    if (link.tagName === 'BUTTON') return link;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.workPick = link.dataset.workPick;
    button.setAttribute('aria-controls', 'work-' + link.dataset.workPick);
    button.append(...link.childNodes);
    link.replaceWith(button);
    return button;
  });
  const status = region.querySelector('[data-work-status]');
  const rail = region.querySelector('.ws-select');
  const mobileRail = matchMedia('(max-width: 700px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let active = -1;
  let revision = 0;
  let gesture = null;
  let dragFrame = 0;
  let suppressClickUntil = 0;
  const indexOf = n => (n + slides.length) % slides.length;

  for (const image of stage.querySelectorAll('img')) image.draggable = false;

  function clearMotion() {
    revision++;
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const slide of slides) {
      slide.classList.remove('is-leaving', 'is-preview');
      slide.style.removeProperty('transform');
      slide.style.removeProperty('opacity');
      slide.style.removeProperty('z-index');
    }
    delete region.dataset.moving;
  }

  function animate(element, frames, options) {
    if (reduced.matches || !element.animate) return null;
    const animation = element.animate(frames, options);
    animations.add(animation);
    animation.finished.catch(() => animations.delete(animation));
    return animation;
  }

  function finishGesture() {
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    const previous = gesture;
    gesture = null;
    delete region.dataset.dragging;
    if (previous && stage.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
    return previous;
  }

  // Scroll only the project rail. scrollIntoView would also move the document.
  function revealPick(index) {
    if (!mobileRail.matches || rail.scrollWidth <= rail.clientWidth) return;
    const control = picks[index];
    const bounds = control.getBoundingClientRect();
    const viewport = rail.getBoundingClientRect();
    const left = viewport.left + rail.clientLeft;
    if (bounds.left >= left - 1 && bounds.right <= left + rail.clientWidth + 1) return;
    const target = bounds.left - left + rail.scrollLeft;
    rail.scrollTo({ left: target, behavior: 'instant' });
  }

  function select(requested, direction = 0, movePickerFocus = false, drag = null) {
    const next = indexOf(requested);
    if (next === active) {
      revealPick(next);
      if (movePickerFocus) picks[next].focus({ preventScroll: true });
      return;
    }
    const initial = active < 0;
    const outgoing = initial ? null : slides[active];
    const restoreLinkFocus = outgoing?.contains(document.activeElement);
    const paintedOutgoing = !initial ? getComputedStyle(outgoing).transform : 'none';
    const delta = direction || Math.sign(next - active);
    finishGesture();
    clearMotion();
    const currentRevision = revision;
    for (let n = 0; n < slides.length; n++) {
      const chosen = n === next;
      slides[n].inert = !chosen;
      slides[n].setAttribute('aria-hidden', String(!chosen));
      picks[n].setAttribute('aria-pressed', String(chosen));
    }
    active = next;
    revealPick(active);
    if (initial) return;
    const incoming = slides[active];
    if (movePickerFocus) picks[active].focus({ preventScroll: true });
    else if (restoreLinkFocus) incoming.querySelector('.ws-case').focus({ preventScroll: true });
    status.textContent = 'Проект ' + (active + 1) + ' из ' + slides.length + '. ' + incoming.dataset.projectName;
    if (reduced.matches) return;
    region.dataset.moving = 'true';
    outgoing.classList.add('is-leaving');
    outgoing.style.zIndex = '1';
    incoming.style.zIndex = '2';
    const width = drag?.width || stage.getBoundingClientRect().width;
    const incomingX = drag ? drag.dx + delta * width : delta * Math.min(72, width * .11);
    const outgoingX = drag ? -delta * width : -delta * Math.min(38, width * .055);
    const duration = drag ? Math.min(460, Math.max(300, 400 - Math.abs(drag.velocity) * 30)) : 400;
    const timing = { duration, easing: 'cubic-bezier(.22,.78,.18,1)', fill: 'both' };
    animate(outgoing, [
      { transform: paintedOutgoing, opacity: 1 },
      { transform: `translateX(${outgoingX}px)`, opacity: drag ? 1 : .32 }
    ], timing);
    const arrival = animate(incoming, [
      { transform: `translateX(${incomingX}px)`, opacity: drag ? 1 : .44 },
      { transform: 'translateX(0)', opacity: 1 }
    ], timing);
    arrival?.finished.then(() => {
      if (revision === currentRevision) clearMotion();
    }, () => {});
  }

  function renderDrag() {
    dragFrame = 0;
    if (!gesture?.horizontal) return;
    const { dx, width } = gesture;
    const direction = dx < 0 ? 1 : -1;
    const candidate = indexOf(active + direction);
    for (let n = 0; n < slides.length; n++) {
      const slide = slides[n];
      if (n === active) {
        slide.style.transform = `translateX(${dx}px)`;
        slide.style.zIndex = '2';
      } else if (n === candidate) {
        slide.classList.add('is-preview');
        slide.style.transform = `translateX(${dx + direction * width}px)`;
        slide.style.zIndex = '1';
      } else {
        slide.classList.remove('is-preview');
        slide.style.removeProperty('transform');
      }
    }
  }

  function settleDrag() {
    const drag = finishGesture();
    if (!drag?.horizontal) return;
    const current = slides[active];
    const startTransform = getComputedStyle(current).transform;
    clearMotion();
    if (reduced.matches) return;
    const currentRevision = revision;
    const settle = animate(current, [
      { transform: startTransform },
      { transform: `translateX(${-drag.dx * .055}px)`, offset: .72 },
      { transform: 'translateX(0)' }
    ], { duration: 390, easing: 'cubic-bezier(.2,.7,.25,1)', fill: 'both' });
    settle?.finished.then(() => {
      if (revision === currentRevision) clearMotion();
    }, () => {});
  }

  region.dataset.enhanced = '';
  region.querySelector('.ws-step').hidden = false;
  const returning = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
  const saved = returning ? history.state?.rainyWorkCase : null;
  const start = slides.findIndex(slide => saved ? slide.dataset.slide === saved : '#' + slide.id === location.hash);
  select(Math.max(0, start));
  function restoreCaseFocus() {
    revealPick(active);
    if (history.state?.rainyWorkCase !== slides[active].dataset.slide) return;
    slides[active].querySelector('.ws-case').focus({ preventScroll: true });
    const state = { ...history.state };
    delete state.rainyWorkCase;
    history.replaceState(state, '');
  }
  if (saved) restoreCaseFocus();
  mobileRail.addEventListener('change', () => { if (mobileRail.matches) revealPick(active); });
  if ('ResizeObserver' in window) new ResizeObserver(() => revealPick(active)).observe(rail);
  window.addEventListener('pageshow', event => { if (event.persisted) restoreCaseFocus(); });
  region.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('.ws-case')) {
      history.replaceState({ ...history.state, rainyWorkCase: slides[active].dataset.slide }, '');
    }
  });
  window.addEventListener('hashchange', () => {
    const linked = slides.findIndex(slide => '#' + slide.id === location.hash);
    if (linked >= 0) select(linked);
  });
  picks.forEach((button, n) => button.addEventListener('click', () => { suppressClickUntil = 0; select(n); }));
  region.querySelector('[data-work-prev]').addEventListener('click', () => { suppressClickUntil = 0; select(active - 1, -1); });
  region.querySelector('[data-work-next]').addEventListener('click', () => { suppressClickUntil = 0; select(active + 1, 1); });
  region.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const picker = event.target.closest('[data-work-pick]');
    const origin = picker ? picks.indexOf(picker) : active;
    if (!picker && !event.target.closest('[data-slide],.ws-step')) return;
    let next;
    let direction = 0;
    if (event.key === 'ArrowLeft') { next = origin - 1; direction = -1; }
    else if (event.key === 'ArrowRight') { next = origin + 1; direction = 1; }
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = slides.length - 1;
    else return;
    event.preventDefault();
    suppressClickUntil = 0;
    if (gesture) settleDrag();
    select(next, direction, Boolean(picker));
  });

  stage.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('a,button,input,textarea')) return;
    if (!event.target.closest('.ws-art') && event.target !== stage) return;
    if (gesture) settleDrag();
    gesture = {
      id: event.pointerId, originX: event.clientX, originY: event.clientY,
      lastX: event.clientX, lastTime: event.timeStamp, velocity: 0,
      width: stage.getBoundingClientRect().width, dx: 0, horizontal: false
    };
  });
  window.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.originX;
    const dy = event.clientY - gesture.originY;
    if (!gesture.horizontal) {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { finishGesture(); return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
      clearMotion();
      gesture.horizontal = true;
      region.dataset.dragging = 'true';
      stage.setPointerCapture(event.pointerId);
    }
    const elapsed = Math.max(8, event.timeStamp - gesture.lastTime);
    gesture.velocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;
    gesture.dx = Math.max(-gesture.width * .82, Math.min(gesture.width * .82, dx));
    if (event.cancelable) event.preventDefault();
    if (!dragFrame) dragFrame = requestAnimationFrame(renderDrag);
  }, { passive: false });
  window.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const drag = gesture;
    if (!drag.horizontal) { finishGesture(); return; }
    if (dragFrame) { cancelAnimationFrame(dragFrame); renderDrag(); }
    const velocity = event.timeStamp - drag.lastTime < 120 ? drag.velocity : 0;
    const passDistance = Math.abs(drag.dx) >= Math.min(110, drag.width * .18);
    const flick = Math.abs(drag.dx) > 24 && Math.abs(velocity) > .48;
    suppressClickUntil = performance.now() + 400;
    if (passDistance || flick) {
      const direction = drag.dx < 0 ? 1 : -1;
      select(active + direction, direction, false, { ...drag, velocity });
    } else settleDrag();
  });
  window.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) settleDrag(); });
  stage.addEventListener('lostpointercapture', event => {
    if (event.target === stage && gesture?.id === event.pointerId && !stage.hasPointerCapture(event.pointerId)) settleDrag();
  });
  stage.addEventListener('click', event => {
    if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  stage.addEventListener('dragstart', event => event.preventDefault());
  window.addEventListener('blur', () => { if (gesture) settleDrag(); });
  window.addEventListener('resize', () => { if (gesture) settleDrag(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { finishGesture(); clearMotion(); }
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { finishGesture(); clearMotion(); }
  });
  window.addEventListener('pagehide', () => { finishGesture(); clearMotion(); });
})();
