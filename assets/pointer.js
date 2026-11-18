(() => {
  if (document.querySelector('.rw-pointer')) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const surfaceSelector = '[data-pointer-surface], .h-papers, .ws-stage';
  const interactiveSelector = 'a, button, summary, [role="button"]';
  const entrySelector = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), iframe';
  const bead = document.createElement('div');
  bead.className = 'rw-pointer';
  bead.setAttribute('aria-hidden', 'true');
  bead.innerHTML = '<span class="rw-pointer-core"></span><span class="rw-pointer-axis"></span>';
  document.body.append(bead);

  let surfaces = [];
  let heroImages = [];
  let geometryRevision = 0;
  let contacts = 0;
  let geometryDirty = true;
  let frame = 0;
  let lastTime = 0;
  let mousePresent = false;
  let blocked = false;
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let targetX = 0;
  let targetY = 0;
  let contactUntil = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let lastMouseTime = 0;
  let pressed = false;
  let lastTarget = null;

  const allowed = () => fine.matches && !reduced.matches && !document.hidden && !document.documentElement.classList.contains('rw-media-open');
  const selectedText = () => {
    const selection = getSelection();
    return Boolean(selection && !selection.isCollapsed);
  };

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    bead.removeAttribute('data-running');
  }

  function hide() {
    stop();
    bead.classList.remove('is-active');
    vx = vy = 0;
  }

  function measure() {
    surfaces = [...document.querySelectorAll(surfaceSelector)]
      .filter(element => !element.closest('[inert]'))
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 32 && rect.height > 32 && rect.bottom > 0 && rect.top < innerHeight);
    heroImages = [...document.querySelectorAll('[data-exhibit-id][data-depth="0"] .h-interfaces')]
      .map(element => ({ element, rect: element.getBoundingClientRect() }));
    geometryDirty = false;
    bead.dataset.geometryRevision = String(++geometryRevision);
  }

  // Resolve a one-way rim crossing against cached, measured surface geometry.
  // The visual bead rebounds once and then passes through; native clicks are untouched.
  function contact(fromX, fromY, toX, toY, now) {
    if (now < contactUntil) return;
    for (const { element, rect } of surfaces) {
      const minX = rect.left - 8;
      const maxX = rect.right + 8;
      const minY = rect.top - 8;
      const maxY = rect.bottom + 8;
      let nx = 0;
      let ny = 0;
      let amount = 0;
      if (fromX < minX && toX >= minX && toY > minY && toY < maxY) {
        nx = -1; amount = Math.abs(vx); x = minX - 1;
      } else if (fromX > maxX && toX <= maxX && toY > minY && toY < maxY) {
        nx = 1; amount = Math.abs(vx); x = maxX + 1;
      } else if (fromY < minY && toY >= minY && toX > minX && toX < maxX) {
        ny = -1; amount = Math.abs(vy); y = minY - 1;
      } else if (fromY > maxY && toY <= maxY && toX > minX && toX < maxX) {
        ny = 1; amount = Math.abs(vy); y = maxY + 1;
      }
      if (!nx && !ny) continue;
      const impulse = Math.min(300, Math.max(105, amount * .5));
      if (nx) vx = nx * impulse;
      else vy = ny * impulse;
      contactUntil = now + 240;
      bead.dataset.contactRevision = String(++contacts);
      bead.dataset.contact = nx ? (nx < 0 ? 'left' : 'right') : (ny < 0 ? 'top' : 'bottom');
      // Surface identity is useful to the component and QA, without DOM measurements per move.
      bead.dataset.surface = element.matches('.ws-stage') ? 'work' : element.matches('.h-papers') ? 'hero' : 'custom';
      return;
    }
  }

  function paint() {
    const speed = Math.hypot(vx, vy);
    const stretch = Math.min(.14, speed / 4800);
    bead.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    bead.style.setProperty('--rw-pointer-scale-x', String(1 + stretch));
    bead.style.setProperty('--rw-pointer-scale-y', String(1 - stretch * .62));
    if (speed > 8) bead.style.setProperty('--rw-pointer-angle', `${Math.atan2(vy, vx)}rad`);
  }

  function tick(now) {
    frame = 0;
    if (!mousePresent || !allowed() || selectedText()) { hide(); return; }
    if (geometryDirty) {
      measure();
      const currentTarget = document.elementFromPoint(lastMouseX, lastMouseY);
      updateMode(currentTarget);
      if (!blocked) bead.classList.add('is-active');
    }
    if (blocked) { hide(); return; }
    const elapsed = lastTime ? Math.min((now - lastTime) / 1000, .034) : 1 / 60;
    lastTime = now;
    // Small fixed substeps keep the spring stable after dropped frames.
    const steps = Math.max(1, Math.ceil(elapsed / .008));
    const dt = elapsed / steps;
    for (let step = 0; step < steps; step++) {
      const previousX = x;
      const previousY = y;
      vx += ((targetX - x) * 245 - vx * 23) * dt;
      vy += ((targetY - y) * 245 - vy * 23) * dt;
      x += vx * dt;
      y += vy * dt;
      contact(previousX, previousY, x, y, now);
    }
    paint();
    if (Math.hypot(targetX - x, targetY - y) < .07 && Math.hypot(vx, vy) < .5) {
      x = targetX; y = targetY; vx = vy = 0;
      paint(); stop(); return;
    }
    frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (frame || (blocked && !geometryDirty) || !mousePresent || !allowed()) return;
    bead.dataset.running = 'true';
    frame = requestAnimationFrame(tick);
  }

  function updateMode(target) {
    if (!(target instanceof Element)) { blocked = true; hide(); return; }
    lastTarget = target;
    const interactive = target.closest(interactiveSelector);
    const overHeroImage = heroImages.some(({ rect }) => lastMouseX >= rect.left && lastMouseX <= rect.right && lastMouseY >= rect.top && lastMouseY <= rect.bottom);
    const draggable = Boolean(target.closest('.ws-art') || overHeroImage);
    const text = !interactive && !draggable && target.closest('p, h1, h2, h3, h4, label, li, dt, dd');
    blocked = Boolean(target.closest(entrySelector) || document.activeElement?.matches(entrySelector) || text || selectedText());
    bead.dataset.mode = draggable ? 'drag' : interactive ? 'link' : 'free';
    if (blocked || !allowed()) hide();
  }

  function move(event) {
    if (event.pointerType !== 'mouse' || !allowed()) { hide(); return; }
    const now = event.timeStamp;
    const elapsed = Math.max(8, now - lastMouseTime);
    const dx = event.clientX - lastMouseX;
    const dy = event.clientY - lastMouseY;
    const speed = Math.min(1, Math.hypot(dx, dy) / elapsed / 2.5);
    lastMouseX = event.clientX; lastMouseY = event.clientY; lastMouseTime = now;
    // Offset preserves the precise native cursor and keeps the bead off the click point.
    targetX = event.clientX + 16 + speed * 3;
    targetY = event.clientY + 19 + speed * 2;
    if (!mousePresent || !bead.classList.contains('is-active')) {
      x = targetX; y = targetY; vx = vy = 0;
    }
    mousePresent = true;
    if (geometryDirty) measure();
    updateMode(event.target);
    if (blocked) return;
    bead.classList.add('is-active');
    wake();
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'mouse') updateMode(event.target);
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') { hide(); return; }
    pressed = true;
    bead.dataset.pressed = 'true';
    if (event.target.closest(entrySelector)) hide();
  }, { passive: true });
  document.addEventListener('pointerup', () => {
    pressed = false;
    bead.removeAttribute('data-pressed');
    if (lastTarget) updateMode(lastTarget);
  }, { passive: true });
  document.addEventListener('selectionchange', () => {
    if (selectedText()) { blocked = true; hide(); }
    else if (!pressed && lastTarget) updateMode(lastTarget);
  });
  document.addEventListener('focusin', event => {
    if (event.target.closest(entrySelector)) { blocked = true; hide(); }
  });
  document.documentElement.addEventListener('pointerleave', () => { mousePresent = false; pressed = false; bead.removeAttribute('data-pressed'); hide(); });
  window.addEventListener('blur', () => { mousePresent = false; pressed = false; bead.removeAttribute('data-pressed'); hide(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { mousePresent = false; hide(); } });
  function invalidateGeometry() {
    geometryDirty = true;
    if (!allowed()) { mousePresent = false; hide(); return; }
    wake();
  }
  document.addEventListener('scroll', invalidateGeometry, { capture: true, passive: true });
  window.addEventListener('resize', invalidateGeometry, { passive: true });
  window.visualViewport?.addEventListener('resize', invalidateGeometry, { passive: true });
  window.visualViewport?.addEventListener('scroll', invalidateGeometry, { passive: true });
  document.addEventListener('toggle', invalidateGeometry, true);
  document.addEventListener('load', invalidateGeometry, true);
  for (const type of ['transitionrun', 'transitionend', 'transitioncancel']) {
    document.addEventListener(type, event => {
      if (bead.contains(event.target)) return;
      if (/height|width|grid-template|padding|margin|flex-basis|transform/.test(event.propertyName)) invalidateGeometry();
    }, true);
  }
  const mutations = new MutationObserver(invalidateGeometry);
  mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-expanded', 'inert'] });
  document.fonts?.ready.then(invalidateGeometry);
  for (const query of [fine, reduced]) query.addEventListener('change', () => {
    geometryDirty = true;
    if (!allowed()) { mousePresent = false; hide(); }
  });
  window.addEventListener('pagehide', () => { mousePresent = false; hide(); });
  window.addEventListener('pageshow', () => { geometryDirty = true; });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(invalidateGeometry);
    for (const element of document.querySelectorAll(surfaceSelector)) observer.observe(element);
    observer.observe(document.body);
    const main = document.querySelector('main');
    if (main) observer.observe(main);
  }
})();
