(() => {
  if (document.querySelector('.rw-pointer')) return;
  const pointer = document.createElement('div');
  pointer.className = 'rw-pointer';
  pointer.hidden = true;
  pointer.setAttribute('aria-hidden', 'true');
  const mark = new Image(23, 23);
  mark.className = 'rw-pointer-mark';
  mark.alt = '';
  mark.draggable = false;
  mark.src = new URL('shared/rainy-mark.svg', document.currentScript.src).href;
  const wakeInk = document.createElement('span');
  wakeInk.className = 'rw-pointer-wake';
  const face = document.createElement('span');
  face.className = 'rw-pointer-face';
  face.append(wakeInk, mark);
  const axis = document.createElement('span');
  axis.className = 'rw-pointer-axis';
  pointer.append(face, axis);
  document.body.append(pointer);

  const root = document.documentElement;
  const capable = matchMedia(
    '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)'
  );
  const choice =
    'input:is([type="radio"],[type="checkbox"],[type="button"],[type="submit"],[type="reset"],[type="image"])';
  const editable =
    'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type]), input:is([type="text"],[type="email"],[type="search"],[type="password"],[type="tel"],[type="url"],[type="number"])';
  const native =
    'input:not(' +
    choice +
    '), textarea, select, option, [contenteditable]:not([contenteditable="false"]), iframe, dialog[open]';
  const interactive =
    'a[href],button:not(:disabled),summary,[role="button"],[role="tab"],' +
    choice +
    ',label:has(' +
    choice +
    ')';
  const limit = (n, max) => Math.max(-max, Math.min(max, n));
  const springs = [];
  function spring(stiffness, damping, tolerance) {
    const s = { x: 0, v: 0, goal: 0, stiffness, damping, tolerance };
    springs.push(s);
    return s;
  }

  // Two components describe the stretch tensor in screen space. Turning a corner
  // bends the existing outline continuously instead of snapping its stretch axis.
  const shapeX = spring(690, 24, 0.001),
    shapeY = spring(690, 24, 0.001);
  const twist = spring(610, 22, 0.05),
    pressure = spring(860, 34, 0.001);
  const bendX = spring(780, 28, 0.025),
    bendY = spring(780, 28, 0.025);
  const tailX = spring(570, 25, 0.04),
    tailY = spring(570, 25, 0.04);
  let ready = false,
    active = false,
    pressed = false,
    dragging = false;
  let hit = null,
    mode = 'free',
    point = null,
    frame = 0,
    refresh = 0,
    lastFrame = 0;
  let dx = 1,
    dy = 0,
    force = 0,
    motionAt = 0,
    near = null;

  function restInk() {
    mark.style.removeProperty('transform');
    mark.style.removeProperty('scale');
    wakeInk.style.removeProperty('opacity');
    wakeInk.style.removeProperty('transform');
  }

  function hide() {
    active = pressed = dragging = false;
    hit = point = near = null;
    mode = 'free';
    force = motionAt = 0;
    dx = 1;
    dy = 0;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(refresh);
    frame = refresh = 0;
    for (const s of springs) s.x = s.v = s.goal = 0;
    pointer.classList.remove('is-active');
    root.classList.remove('rw-pointer-on');
    for (const key of ['mode', 'running', 'pressed']) delete pointer.dataset[key];
    restInk();
  }

  function start() {
    if (frame || !active) return;
    lastFrame = performance.now();
    pointer.dataset.running = 'true';
    frame = requestAnimationFrame(animate);
  }

  function paint() {
    const angle = (twist.x * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const xx = 1 + shapeX.x,
      yy = 1 - shapeX.x * 0.78,
      xy = shapeY.x * 0.89;
    const matrix = [
      xx * c + xy * s,
      xy * c + yy * s,
      xy * c - xx * s,
      yy * c - xy * s,
      limit(bendX.x, 5.5),
      limit(bendY.x, 5.5)
    ];
    mark.style.transform = `matrix(${matrix.join(',')})`;
    mark.style.scale = String(1 + pressure.x);
    const length = Math.hypot(tailX.x, tailY.x);
    wakeInk.style.opacity = String(Math.min(0.64, Math.max(0, (length - 1.1) / 18)));
    if (length > 1) {
      const angle = Math.atan2(tailY.x, tailX.x);
      const offset = `translate(${tailX.x * 0.95}px, ${tailY.x * 0.95}px)`;
      const stretch = `rotate(${angle}rad) scale(${1 + length / 30}, .64) rotate(${-angle}rad)`;
      wakeInk.style.transform = `${offset} ${stretch}`;
    }
  }

  function animate(now) {
    frame = 0;
    if (!active) return;
    const elapsed = Math.min((now - lastFrame) / 1000, 0.042);
    lastFrame = now;
    // Pointer events can arrive below the display rate. Sustain only one frame,
    // then let stored energy decay without keeping an idle animation alive.
    const age = now - motionAt;
    const drive = age > 185 ? 0 : force * Math.exp(-Math.max(0, age - 20) / 24);
    const squeeze = mode === 'card' ? 0.27 : 0.39;
    shapeX.goal = (dx * dx - dy * dy) * drive * squeeze;
    shapeY.goal = 2 * dx * dy * drive * squeeze;
    bendX.goal = -dx * drive * 2.9;
    bendY.goal = -dy * drive * 2.9;
    if (near) {
      const push = drive * near.strength;
      shapeX.goal -= (near.x * near.x - near.y * near.y) * push * 0.24;
      bendX.goal += near.x * push * 5;
      bendY.goal += near.y * push * 5;
    }
    twist.goal = (dx * 0.87 - dy * 0.65) * drive * (mode === 'card' ? 18 : 29);
    pressure.goal = pressed ? -0.26 : 0;
    const wakeLength = Math.max(0, drive - 0.18) * (mode === 'link' ? 14 : 21);
    tailX.goal = -dx * wakeLength;
    tailY.goal = -dy * wakeLength;
    const steps = Math.max(1, Math.ceil(elapsed / 0.006)),
      dt = elapsed / steps;
    let moving = drive > 0.001;
    for (const value of springs) {
      for (let i = 0; i < steps; i++) {
        value.v += ((value.goal - value.x) * value.stiffness - value.damping * value.v) * dt;
        value.x += value.v * dt;
      }
      if (Math.abs(value.x - value.goal) > value.tolerance || Math.abs(value.v) > value.tolerance * 20)
        moving = true;
      else {
        value.x = value.goal;
        value.v = 0;
      }
    }
    if (!moving) {
      restInk();
      if (pressed) mark.style.scale = String(1 + pressure.goal);
      delete pointer.dataset.running;
      return;
    }
    paint();
    frame = requestAnimationFrame(animate);
  }

  function targetAt(el, x, y) {
    const control = el?.closest(interactive);
    if (
      control?.matches('.h-sheet-foot') &&
      document.elementsFromPoint(x, y).some((n) => n.matches('[data-depth="0"] .h-interfaces'))
    ) {
      return { node: control.closest('[data-hero-art]'), mode: 'drag' };
    }
    if (control?.matches('.ww-case,.journal-story'))
      return { node: control.closest('.ww-project') || control, mode: 'card' };
    if (control) return { node: control, mode: 'link' };
    const art = el?.closest('[data-hero-art]');
    return { node: art, mode: art ? 'drag' : 'free' };
  }

  // Rectangle normals come from the actual hit surface, including full-card
  // anchor overlays. The look-ahead hit test is local to the current direction.
  function edge(node, x, y) {
    const r = node.getBoundingClientRect();
    const edges = [
      [x - r.left, -1, 0],
      [r.right - x, 1, 0],
      [y - r.top, 0, -1],
      [r.bottom - y, 0, 1]
    ];
    const nearest = edges.reduce((a, b) => (a[0] <= b[0] ? a : b));
    return { x: nearest[1], y: nearest[2], strength: Math.max(0, 1 - Math.abs(nearest[0]) / 16) };
  }

  function impact(normal, energy) {
    const { x, y } = normal;
    bendX.v += x * energy * 14;
    bendY.v += y * energy * 14;
    shapeX.v -= (x * x - y * y) * energy * 0.55;
    twist.v += (x - y) * energy * 3;
    start();
  }

  function classify(el, x, y, buttons = 0, lookAhead = false) {
    const selection = getSelection();
    if (
      !ready ||
      !capable.matches ||
      document.hidden ||
      !(el instanceof Element) ||
      el.closest(native) ||
      document.activeElement?.matches(editable) ||
      (selection &&
        !selection.isCollapsed &&
        (selection.containsNode(el, true) || (buttons === 1 && !dragging)))
    ) {
      if (active) hide();
      return false;
    }
    const next = dragging ? { node: hit, mode: 'drag' } : targetAt(el, x, y);
    if (next.node !== hit) {
      if (active && hit) impact(edge(hit, x, y), -Math.min(5, 2.9 + force * 2));
      hit = next.node;
      if (active && hit) impact(edge(hit, x, y), (next.mode === 'card' ? 3.3 : 5.4) + force * 1.7);
    }
    mode = next.mode;
    if (pointer.dataset.mode !== mode) pointer.dataset.mode = mode;
    near = null;
    if (lookAhead && !hit && force > 0.025) {
      const px = x + dx * 16,
        py = y + dy * 16;
      const candidate = targetAt(document.elementFromPoint(px, py), px, py).node;
      if (candidate) near = edge(candidate, x, y);
    }
    return true;
  }

  function move(event) {
    const x = event.clientX,
      y = event.clientY,
      now = performance.now();
    if (
      event.pointerType !== 'mouse' ||
      x < 0 ||
      y < 0 ||
      x >= root.clientWidth ||
      y >= root.clientHeight
    ) {
      if (active) hide();
      return;
    }
    const distance = point ? Math.hypot(x - point.x, y - point.y) : 0;
    if (distance > 0.1) {
      const ux = (x - point.x) / distance,
        uy = (y - point.y) / distance;
      const nextForce = Math.min(1, distance / Math.max(8, Math.min(64, now - point.time)) / 1.75);
      const reversal = -(ux * dx + uy * dy);
      if (now - motionAt < 120 && reversal > 0.4) {
        const kick = Math.min(force, nextForce) * reversal;
        bendX.v += dx * kick * 120;
        bendY.v += dy * kick * 120;
        shapeX.v -= (dx * dx - dy * dy) * kick * 6;
        shapeY.v -= 2 * dx * dy * kick * 6;
        twist.v += (dx - dy) * kick * 165;
      }
      dx = ux;
      dy = uy;
      force = nextForce;
      motionAt = now;
    }
    if (!classify(event.target, x, y, event.buttons, distance > 0.1)) return;
    point = { x, y, time: now };
    pointer.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    if (!active) {
      active = true;
      pointer.classList.add('is-active');
      root.classList.add('rw-pointer-on');
    }
    if (distance > 0.1) start();
  }

  function recheck() {
    if (!point || refresh) return;
    refresh = requestAnimationFrame(() => {
      refresh = 0;
      if (point) classify(document.elementFromPoint(point.x, point.y), point.x, point.y);
    });
  }

  function down(event) {
    if (event.pointerType !== 'mouse') {
      hide();
      return;
    }
    if (
      !event.isPrimary ||
      event.button !== 0 ||
      !active ||
      !classify(event.target, event.clientX, event.clientY)
    )
      return;
    pressed = true;
    dragging = mode === 'drag';
    pointer.dataset.pressed = 'true';
    pressure.v -= 3.3;
    start();
  }

  function release() {
    if (!pressed) return;
    pressure.v += dragging ? 4.5 : 3.5;
    if (dragging) twist.v += dx * 90;
    pressed = dragging = false;
    delete pointer.dataset.pressed;
    start();
    recheck();
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', down, { capture: true, passive: true });
  window.addEventListener('pointerup', release, { capture: true, passive: true });
  window.addEventListener('pointercancel', hide, { capture: true, passive: true });
  root.addEventListener('pointerleave', hide, { passive: true });
  document.addEventListener('selectionchange', () => {
    if (!getSelection()?.isCollapsed) recheck();
  });
  document.addEventListener('focusin', (event) => {
    if (event.target.closest(native)) hide();
  });
  document.addEventListener('keydown', hide, { passive: true });
  document.addEventListener('scroll', recheck, { capture: true, passive: true });
  window.addEventListener('resize', recheck, { passive: true });
  document.addEventListener('toggle', recheck, true);
  document.addEventListener('transitionend', (event) => {
    if (!pointer.contains(event.target)) recheck();
  });
  new MutationObserver(recheck).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'hidden', 'inert', 'aria-expanded']
  });
  capable.addEventListener('change', hide);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('blur', hide);
  window.addEventListener('pagehide', hide);
  mark
    .decode()
    .then(() => {
      ready = getComputedStyle(pointer).getPropertyValue('--rw-pointer-ready').trim() === '1';
      pointer.hidden = !ready;
    })
    .catch(hide);
})();
