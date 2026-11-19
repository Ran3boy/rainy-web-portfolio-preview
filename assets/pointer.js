(() => {
  if (document.querySelector('.rw-pointer')) return;
  const pointer = document.createElement('div');
  pointer.className = 'rw-pointer';
  pointer.hidden = true;
  pointer.setAttribute('aria-hidden', 'true');
  const mark = new Image(25, 25);
  mark.className = 'rw-pointer-mark';
  mark.alt = '';
  mark.draggable = false;
  mark.src = new URL('shared/rainy-mark.svg', document.currentScript.src).href;
  const wakeInk = document.createElement('span');
  wakeInk.className = 'rw-pointer-wake';
  const body = document.createElement('span');
  body.className = 'rw-pointer-body';
  const sight = document.createElement('span');
  sight.className = 'rw-pointer-sight';
  const axis = document.createElement('span');
  axis.className = 'rw-pointer-axis';
  body.append(wakeInk, mark, axis);
  pointer.append(body, sight);
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
  // These coordinates are in viewport space. A new mouse event moves the spring's
  // destination, never the mass itself, except to bound very large jumps.
  const bodyX = spring(1020, 23, 0.08), bodyY = spring(1020, 23, 0.08);
  const materials = {
    button: { strike: 1370, release: 1590, squash: 0.35 },
    link:   { strike: 560, release: 470, squash: 0.17 },
    card:   { strike: 940, release: 1030, squash: 0.26 },
    drag:   { strike: 700, release: 530, squash: 0.2 }
  };
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
  let contact = null, lastImpact = -Infinity, surface = 'free';

  function restInk() {
    body.style.removeProperty('transform');
    sight.style.removeProperty('opacity');
    mark.style.removeProperty('transform');
    mark.style.removeProperty('scale');
    wakeInk.style.removeProperty('opacity');
    wakeInk.style.removeProperty('transform');
  }

  function hide() {
    active = pressed = dragging = false;
    hit = point = near = null;
    mode = surface = 'free';
    contact = null;
    lastImpact = -Infinity;
    force = motionAt = 0;
    dx = 1;
    dy = 0;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(refresh);
    frame = refresh = 0;
    for (const s of springs) s.x = s.v = s.goal = 0;
    pointer.classList.remove('is-active');
    root.classList.remove('rw-pointer-on');
    for (const key of ['mode', 'surface', 'running', 'pressed']) delete pointer.dataset[key];
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
    const offsetX = bodyX.x - point.x, offsetY = bodyY.x - point.y;
    body.style.transform = `translate3d(${offsetX}px,${offsetY}px,0)`;
    sight.style.opacity = String(Math.min(1, Math.max(0, (Math.hypot(offsetX, offsetY) - 5) / 8)));
    const matrix = [
      xx * c + xy * s,
      xy * c + yy * s,
      xy * c - xx * s,
      yy * c - xy * s,
      0, 0
    ];
    mark.style.transform = `matrix(${matrix.join(',')})`;
    mark.style.scale = String(1 + pressure.x);
    const length = Math.hypot(tailX.x, tailY.x);
    wakeInk.style.opacity = String(Math.min(0.84, Math.max(0, (length - 1.8) / 20)));
    if (length > 1) {
      const angle = Math.atan2(tailY.x, tailX.x);
      const offset = `translate(${tailX.x * 1.08}px, ${tailY.x * 1.08}px)`;
      const stretch = `rotate(${angle}rad) scale(${1 + length / 28}, .67) rotate(${-angle}rad)`;
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
    bodyX.goal = point.x;
    bodyY.goal = point.y;
    if (near) {
      const push = drive * near.strength;
      shapeX.goal -= (near.nx * near.nx - near.ny * near.ny) * push * 0.24;
      bodyX.goal -= near.nx * push * 7;
      bodyY.goal -= near.ny * push * 7;
    }
    twist.goal = (dx * 0.87 - dy * 0.65) * drive * (mode === 'card' ? 18 : 29);
    pressure.goal = pressed ? -0.26 : 0;
    // The copper silhouette points along the body's real path, including the
    // instant it is travelling opposite the mouse during a reversal.
    const speed = Math.hypot(bodyX.v, bodyY.v);
    const wakeLength = Math.min(34, Math.max(0, (speed - 245) * 0.039));
    tailX.goal = speed ? -bodyX.v / speed * wakeLength : 0;
    tailY.goal = speed ? -bodyY.v / speed * wakeLength : 0;
    if (contact) resolveContact(now);
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

  // Each side is a directed plane. For an entry sample that lands deep inside,
  // intersect the actual input segment with the box instead of picking its
  // nearest side (which can be the opposite side of a small button).
  function edge(node, x, y, from = null) {
    const r = node.getBoundingClientRect();
    const faces = [
      { x:r.left, y:r.top, nx:-1, ny:0 },
      { x:r.right, y:r.top, nx:1, ny:0 },
      { x:r.left, y:r.top, nx:0, ny:-1 },
      { x:r.left, y:r.bottom, nx:0, ny:1 }
    ];
    const signed = (face, px, py) => (px-face.x)*face.nx + (py-face.y)*face.ny;
    let nearest = faces[0], distance = -Infinity;
    for (const face of faces) {
      const end = signed(face,x,y);
      if (end > distance) { distance=end; nearest=face; }
      if (!from) continue;
      const start = signed(face,from.x,from.y);
      if (start * end > 0 || start === end) continue;
      const t = start / (start - end);
      const ix = from.x + (x-from.x)*t, iy = from.y + (y-from.y)*t;
      if (ix >= r.left-.1 && ix <= r.right+.1 && iy >= r.top-.1 && iy <= r.bottom+.1) return face;
    }
    nearest.strength = Math.max(0, 1 - Math.abs(distance)/24);
    return nearest;
  }

  function materialFor(node, mode) {
    if (mode !== 'link') return mode;
    return node.matches('button,summary,input,label,[role=button],.btn,.nav-telegram-2,.sd-detail') ? 'button' : 'link';
  }

  function resolveContact(now) {
    const { face, profile, entering, at } = contact;
    const { nx, ny } = face;
    const gap = (bodyX.x-face.x)*nx + (bodyY.x-face.y)*ny;
    if (now - at > 170) {
      contact = null;
      return;
    }
    // An inward-moving mark hits the exterior with its leading shoulder.
    // A departing mark releases as the body itself crosses the edge.
    if (entering ? gap > 10 : gap < -7) return;
    contact = null;
    lastImpact = now;
    const normalVelocity = bodyX.v*nx + bodyY.v*ny;
    const kick = (entering ? profile.strike : profile.release) * (.87 + force*.19);
    bodyX.v += nx*(kick-normalVelocity);
    bodyY.v += ny*(kick-normalVelocity);
    shapeX.x -= (nx*nx - ny*ny)*profile.squash;
    twist.v += (nx-ny)*90;
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
      const previousHit = hit, previousSurface = surface;
      hit = next.node;
      surface = materialFor(hit, next.mode);
      contact = null;
      // Scrolling beneath a resting mouse only changes the affordance. A
      // physical boundary crossing is required to strike or release the body.
      if (lookAhead && point && (hit || previousHit)) {
        const face = edge(hit || previousHit, x, y, point);
        const at = performance.now();
        const proximity = Math.hypot(x-point.x,y-point.y);
        if (at-lastImpact >= 95 && proximity < 110) {
          contact = { face, at, entering: !!hit, profile: materials[hit ? surface : previousSurface] };
          start();
        }
      }
    }
    mode = next.mode;
    if (pointer.dataset.mode !== mode) pointer.dataset.mode = mode;
    if (pointer.dataset.surface !== surface) pointer.dataset.surface = surface;
    near = null;
    if (lookAhead && !hit && force > 0.025) {
      const px = x + dx * 24,
        py = y + dy * 24;
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
        // Preserve momentum in the old direction through a hard turn.
        bodyX.v = limit(bodyX.v + dx * kick * 420, 1900);
        bodyY.v = limit(bodyY.v + dy * kick * 420, 1900);
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
    if (!active) {
      bodyX.x = x;
      bodyY.x = y;
    } else {
      // A discontinuity (e.g. re-entering from a second monitor) cannot leave
      // the mark stranded. Continuous pointer paths retain their own momentum.
      const ox = bodyX.x-x, oy = bodyY.x-y;
      const lag = Math.hypot(ox,oy);
      if (lag > 58) {
        bodyX.x = x + ox*58/lag;
        bodyY.x = y + oy*58/lag;
      }
    }
    point = { x, y, time: now };
    if (active && distance > .1) paint();
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
