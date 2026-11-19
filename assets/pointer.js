(() => {
  if (document.querySelector('.rw-pointer')) return;
  const pointer = document.createElement('div');
  pointer.className = 'rw-pointer';
  pointer.hidden = true;
  pointer.setAttribute('aria-hidden', 'true');
  const mark = new Image(23, 23);
  mark.alt = '';
  mark.className = 'rw-pointer-mark';
  mark.draggable = false;
  mark.src = new URL('shared/rainy-mark.svg', document.currentScript.src).href;
  const axis = document.createElement('span');
  axis.className = 'rw-pointer-axis';
  pointer.append(mark, axis);
  document.body.append(pointer);

  const root = document.documentElement;
  const capable = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)');
  const clickableInput = 'input:is([type="radio"],[type="checkbox"],[type="button"],[type="submit"],[type="reset"],[type="image"])';
  const textField = 'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type]), input:is([type="text"],[type="email"],[type="search"],[type="password"],[type="tel"],[type="url"],[type="number"])';
  const nativeField = 'input:not(' + clickableInput + '), textarea, select, option, [contenteditable]:not([contenteditable="false"]), iframe';
  const interactive = 'a[href], button, summary, [role="button"], [role="tab"], ' + clickableInput + ', label:has(' + clickableInput + ')';
  let ready = false;
  let active = false;
  let press = false;
  let drag = false;
  let mode = '';
  let position = null;
  let frame = 0;
  let refresh = 0;
  let lastFrame = 0;
  let lastMotion = 0;
  let tilt = 0, angularVelocity = 0, targetTilt = 0;
  let strain = 0, strainVelocity = 0, targetStrain = 0;
  let direction = 0;

  function hide() {
    active = false;
    press = drag = false;
    position = null;
    mode = '';
    cancelAnimationFrame(frame);
    cancelAnimationFrame(refresh);
    frame = refresh = lastFrame = 0;
    tilt = angularVelocity = targetTilt = 0;
    strain = strainVelocity = targetStrain = 0;
    root.classList.remove('rw-pointer-on');
    pointer.classList.remove('is-active');
    pointer.removeAttribute('data-running');
    pointer.removeAttribute('data-pressed');
    pointer.removeAttribute('data-mode');
    mark.style.removeProperty('transform');
  }

  function paint() {
    // Carry the ink along the motion axis. All linear transforms pivot about the hit point.
    mark.style.transform = 'rotate(' + direction + 'deg) scale(' + (1 + strain) + ',' +
      (1 - strain * .65) + ') rotate(' + (tilt - direction) + 'deg)';
  }

  function animate(now) {
    frame = 0;
    if (!active) return;
    const elapsed = Math.min(Math.max((now - lastFrame) / 1000, 0), .04);
    lastFrame = now;
    const steps = Math.max(1, Math.ceil(elapsed / .008));
    const dt = elapsed / steps;
    if (now - lastMotion > 42) targetTilt = targetStrain = 0;
    for (let i = 0; i < steps; i++) {
      angularVelocity += ((targetTilt - tilt) * 620 - angularVelocity * 24) * dt;
      strainVelocity += ((targetStrain - strain) * 620 - strainVelocity * 24) * dt;
      tilt += angularVelocity * dt;
      strain += strainVelocity * dt;
    }
    if (!targetTilt && !targetStrain && Math.abs(tilt) < .08 && Math.abs(angularVelocity) < 1 &&
        Math.abs(strain) < .001 && Math.abs(strainVelocity) < .012) {
      tilt = strain = angularVelocity = strainVelocity = 0;
      mark.style.removeProperty('transform');
      pointer.removeAttribute('data-running');
      return;
    }
    paint();
    frame = requestAnimationFrame(animate);
  }

  function wake() {
    if (frame) return;
    lastFrame = performance.now();
    pointer.dataset.running = 'true';
    frame = requestAnimationFrame(animate);
  }

  function classify(target, x, y, buttons = 0) {
    const selection = getSelection();
    if (!(target instanceof Element) || target.closest(nativeField + ',dialog[open]') ||
        document.activeElement?.matches(textField) ||
        (selection && !selection.isCollapsed && (selection.containsNode(target, true) || (buttons === 1 && !drag))) ||
        document.hidden || !ready || !capable.matches) {
      hide();
      return false;
    }
    const control = target.closest(interactive);
    // The hero's case anchor covers the whole sheet. Distinguish its pictured
    // interface from its actual link footer, even while the sheet is rotating.
    const overHeroImage = control?.matches('.h-sheet-foot') && document.elementsFromPoint(x, y)
      .some(node => node.matches('[data-depth="0"] .h-interfaces'));
    const nextMode = drag || overHeroImage ? 'drag' : control ? 'link' :
      target.closest('[data-hero-art], [data-work-slider][data-enhanced] .ws-art') ? 'drag' : 'free';
    if (nextMode !== mode) {
      mode = nextMode;
      pointer.dataset.mode = mode;
    }
    return true;
  }

  function move(event) {
    if (event.pointerType !== 'mouse' || event.clientX < 0 || event.clientY < 0 ||
        event.clientX >= root.clientWidth || event.clientY >= root.clientHeight) {
      if (active) hide();
      return;
    }
    const x = event.clientX, y = event.clientY, now = performance.now();
    if (!classify(event.target, x, y, event.buttons)) return;
    if (position) {
      const dx = x - position.x, dy = y - position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > .1) {
        const speed = distance / Math.min(64, Math.max(6, now - position.time));
        const force = Math.min(1, speed / 2.1);
        direction = Math.atan2(dy, dx) * 180 / Math.PI;
        targetTilt = 32 * force * (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : -Math.sign(dy));
        targetStrain = .25 * force;
        lastMotion = now;
        wake();
      }
    }
    position = { x, y, time: now };
    pointer.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    if (!active) {
      active = true;
      pointer.classList.add('is-active');
      root.classList.add('rw-pointer-on');
    }
  }

  // Refresh stationary hover after a layout or scroll change, without a permanent animation loop.
  function recheck() {
    if (!position || refresh) return;
    refresh = requestAnimationFrame(() => {
      refresh = 0;
      if (position) classify(document.elementFromPoint(position.x, position.y), position.x, position.y);
    });
  }

  function down(event) {
    if (event.pointerType !== 'mouse') { hide(); return; }
    if (!event.isPrimary || event.button !== 0 || !active) return;
    if (!classify(event.target, event.clientX, event.clientY)) return;
    press = true;
    drag = mode === 'drag';
    pointer.dataset.pressed = 'true';
  }

  function release() {
    if (!press) return;
    if (drag) {
      // Opening the grip releases stored tension through the mark, never through its position.
      strainVelocity += 2.7;
      angularVelocity += tilt < 0 ? -95 : 95;
      wake();
    }
    press = drag = false;
    pointer.removeAttribute('data-pressed');
    recheck();
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', down, { capture: true, passive: true });
  window.addEventListener('pointerup', release, { capture: true, passive: true });
  window.addEventListener('pointercancel', hide, { capture: true, passive: true });
  root.addEventListener('pointerleave', hide, { passive: true });
  document.addEventListener('selectionchange', () => { if (!getSelection()?.isCollapsed) recheck(); });
  document.addEventListener('focusin', event => { if (event.target.closest(nativeField + ',dialog[open]')) hide(); });
  document.addEventListener('keydown', hide, { passive: true });
  document.addEventListener('scroll', recheck, { capture: true, passive: true });
  window.addEventListener('resize', recheck, { passive: true });
  document.addEventListener('toggle', recheck, true);
  document.addEventListener('transitionend', event => { if (!pointer.contains(event.target)) recheck(); });
  const observer = new MutationObserver(recheck);
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open','hidden','inert','aria-expanded'] });
  capable.addEventListener('change', hide);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  // Never suppress the system cursor until the real brand image and the stylesheet are usable.
  mark.decode().then(() => {
    ready = getComputedStyle(pointer).getPropertyValue('--rw-pointer-ready').trim() === '1';
    pointer.hidden = !ready;
  }).catch(hide);
})();
