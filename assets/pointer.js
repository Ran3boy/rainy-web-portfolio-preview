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
  const svgNS = 'http://www.w3.org/2000/svg';
  const wakeInk = document.createElementNS(svgNS, 'svg');
  wakeInk.setAttribute('class', 'rw-pointer-wake');
  const ribbon = document.createElementNS(svgNS, 'path');
  wakeInk.append(ribbon);
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
    'a[href],button:not(:disabled),summary,[role="button"],[role="tab"],' + choice + ',label:has(' + choice + ')';
  // All integration and trail sampling use the same clock. DOM events supply
  // timestamped positions, never impulses or visual-body coordinates.
  const stepMs = 1000 / 240;
  const dt = stepMs / 1000;
  const inputFollow = 1 - Math.exp(-dt / 0.017);
  const velocityFollow = 1 - Math.exp(-dt / 0.022);
  const approachFollow = 1 - Math.exp(-dt / 0.072);
  const bodyX = { x: 0, v: 0 },
    bodyY = { x: 0, v: 0 };
  const recoilX = { x: 0, v: 0 },
    recoilY = { x: 0, v: 0 };
  const shapeX = { x: 0, v: 0 },
    shapeY = { x: 0, v: 0 };
  const twist = { x: 0, v: 0 },
    pressure = { x: 0, v: 0 };
  const axes = [bodyX, bodyY, recoilX, recoilY, shapeX, shapeY, twist, pressure];
  const surfaces = {
    button: { excursion: 42, compression: 0.46 },
    card: { excursion: 52, compression: 0.35 },
    drag: { excursion: 29, compression: 0.28 },
    link: { excursion: 19, compression: 0.23 }
  };
  const samples = [],
    history = [];
  let ready = false,
    active = false,
    pressed = false,
    dragging = false;
  let point = null,
    hit = null,
    mode = 'free',
    surface = 'free';
  let frame = 0,
    refresh = 0,
    clock = 0,
    lastPaint = 0;
  let guideX = 0,
    guideY = 0,
    guideVX = 0,
    guideVY = 0;
  let approachX = 0, approachY = 0;
  let contact = null,
    lastImpact = -Infinity,
    trailInk = 0;

  function restInk() {
    mark.style.removeProperty('transform');
    mark.style.scale = pressed ? '.74' : '';
    sight.style.opacity = '0';
    wakeInk.style.opacity = '0';
    ribbon.removeAttribute('d');
    history.length = 0;
    trailInk = 0;
  }

  function resetPhysics(x, y, now) {
    for (const axis of axes) axis.x = axis.v = 0;
    bodyX.x = guideX = approachX = x;
    bodyY.x = guideY = approachY = y;
    guideVX = guideVY = 0;
    clock = lastPaint = now;
    samples.length = 0;
    samples.push({ x, y, at: now });
    contact = null;
    lastImpact = -Infinity;
    restInk();
    body.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  }

  function hide() {
    active = pressed = dragging = false;
    hit = point = contact = null;
    mode = surface = 'free';
    cancelAnimationFrame(frame);
    cancelAnimationFrame(refresh);
    frame = refresh = 0;
    pointer.classList.remove('is-active');
    root.classList.remove('rw-pointer-on');
    for (const key of ['mode', 'surface', 'running', 'pressed']) delete pointer.dataset[key];
    restInk();
  }

  function start() {
    if (frame || !active) return;
    lastPaint = clock = performance.now() - stepMs;
    pointer.dataset.running = 'true';
    frame = requestAnimationFrame(animate);
  }

  function spring(axis, goal, frequency, damping, acceleration = 0) {
    axis.v += ((goal - axis.x) * frequency * frequency - damping * axis.v + acceleration) * dt;
    axis.x += axis.v * dt;
  }

  // Interpolate coalesced input positions at simulation time. Low-rate devices
  // and high-refresh screens drive the same low-pass guide and moving mass.
  function advanceGuide(time) {
    while (samples.length > 1 && samples[1].at <= time) samples.shift();
    const a = samples[0],
      b = samples[1] || a;
    const mix = b === a ? 0 : Math.max(0, Math.min(1, (time - a.at) / (b.at - a.at)));
    const nextX = a.x + (b.x - a.x) * mix,
      nextY = a.y + (b.y - a.y) * mix;
    const sx = (nextX - guideX) * inputFollow,
      sy = (nextY - guideY) * inputFollow;
    guideX += sx;
    guideY += sy;
    guideVX += (sx / dt - guideVX) * velocityFollow;
    guideVY += (sy / dt - guideVY) * velocityFollow;
    approachX += (nextX - approachX) * approachFollow;
    approachY += (nextY - approachY) * approachFollow;
  }

  function integrate(time) {
    advanceGuide(time - 7);
    // Only filtered hand motion can energise an effect. A recoil cannot
    // generate new input energy, and alternating corrections cancel out.
    const handSpeedSquared = guideVX * guideVX + guideVY * guideVY;
    const activity = handSpeedSquared / (handSpeedSquared + 340 * 340);
    let load = 0,
      pulse = 0,
      nx = 0,
      ny = 0;
    if (contact) {
      const face = contact.face,
        polarity = contact.entering ? 1 : -1;
      nx = face.nx;
      ny = face.ny;
      const gap = (bodyX.x - face.x) * nx + (bodyY.x - face.y) * ny;
      if (!contact.loaded && time >= contact.at && polarity * gap <= 12) {
        contact.loaded = time;
        const room = nx < 0 ? face.x : nx > 0 ? innerWidth - face.x : ny < 0 ? face.y : innerHeight - face.y;
        const available = Math.max(0, room - 16);
        const spanGain = Math.min(1, face.span / 65);
        contact.travel = Math.min(available, contact.profile.excursion * (0.68 + 0.32 * spanGain) * contact.strength);
        contact.squash = contact.profile.compression * contact.strength;
        lastImpact = time;
      }
      if (contact.loaded) {
        const age = (time - contact.loaded) / 1000;
        const compressionTime = contact.entering ? 0.042 : 0.052;
        if (age < compressionTime) {
          load = Math.sin((Math.PI * age) / compressionTime) * contact.squash;
        } else {
          // Deliver the stored energy over a short stroke. Velocity is
          // continuous at impact, release, and during a reversal mid-stroke.
          const phase = (age - compressionTime) / 0.072;
          if (phase < 1) pulse = Math.sin(Math.PI * phase) * contact.travel * 710;
          else contact = null;
        }
      } else if (time - contact.at > 190) contact = null;
    }
    const dx = guideX - bodyX.x,
      dy = guideY - bodyY.x;
    const distance = Math.hypot(dx, dy);
    // The pursuit progressively stiffens on a long sweep without teleporting
    // the body. Feed-forward keeps steady travel close to the real pointer.
    const travelFrequency = 25 + (12 * distance) / (distance + 180);
    // A fine correction tracks promptly with critical damping. Sustained
    // travel progressively restores the original underdamped moving mass.
    const frequency = 35 + (travelFrequency - 35) * activity;
    const damping = frequency * (2 - 0.68 * activity);
    const lead = damping * (0.32 + 0.12 * activity);
    const pull = load * (contact?.entering ? 17 : -22);
    spring(bodyX, guideX + nx * pull, frequency, damping, lead * guideVX);
    spring(bodyY, guideY + ny * pull, frequency, damping, lead * guideVY);
    spring(recoilX, 0, 22, 14, nx * pulse);
    spring(recoilY, 0, 22, 14, ny * pulse);

    const vx = bodyX.v + recoilX.v,
      vy = bodyY.v + recoilY.v,
      speed = Math.hypot(vx, vy);
    const ux = speed ? vx / speed : 0,
      uy = speed ? vy / speed : 0;
    const drive = activity * ((speed * speed) / (speed * speed + 590 * 590));
    const stretch = drive * (mode === 'card' ? 0.29 : 0.39);
    spring(shapeX, (ux * ux - uy * uy) * stretch - (nx * nx - ny * ny) * load, 39, 34);
    spring(shapeY, 2 * ux * uy * stretch, 39, 34);
    spring(twist, (ux * 0.86 - uy * 0.64) * drive * 22, 27, 19);
    spring(pressure, pressed ? -0.26 : 0, 28, 32);

    const ink = Math.max(0, speed - 145);
    const opacity = (0.9 * activity * ink * ink) / (ink * ink + 310 * 310);
    trailInk += (opacity - trailInk) * (1 - Math.exp(-dt / (opacity > trailInk ? 0.024 : 0.065)));
    const last = history.at(-1);
    if (!last || time - last.at >= 8) history.push({ x: bodyX.x + recoilX.x, y: bodyY.x + recoilY.x, at: time });
    while (history.length && time - history[0].at > 165) history.shift();
  }

  function pointText(p) {
    return p.x.toFixed(1) + ' ' + p.y.toFixed(1);
  }

  function drawTrail(x, y) {
    if (trailInk < 0.018) {
      wakeInk.style.opacity = '0';
      if (ribbon.hasAttribute('d')) ribbon.removeAttribute('d');
      return;
    }
    const spine = [{ x: 0, y: 0, s: 0 }];
    const maxLength = Math.max(95, Math.min(160, innerWidth * 0.121)) * (0.3 + (0.7 * trailInk) / 0.9);
    for (let i = history.length - 1; i >= 0; i--) {
      const last = spine.at(-1),
        dx = history[i].x - x - last.x,
        dy = history[i].y - y - last.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.9) continue;
      const take = Math.min(d, maxLength - last.s);
      spine.push({ x: last.x + (dx * take) / d, y: last.y + (dy * take) / d, s: last.s + take });
      if (take < d || last.s + take >= maxLength - 0.1) break;
    }
    const length = spine.at(-1).s;
    if (length < 4) {
      wakeInk.style.opacity = '0';
      return;
    }
    // At a true hairpin the oldest leg doubles back under the newest. Pinch
    // the width at the turn and let the old leg fade as the new stroke grows.
    let fold = null;
    for (let i = 1; i < spine.length - 1; i++) {
      const a = spine[i - 1],
        b = spine[i],
        c = spine[i + 1];
      const cosine = ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / ((b.s - a.s) * (c.s - b.s));
      if (cosine < -0.5) {
        fold = b.s;
        break;
      }
    }
    const left = [],
      right = [];
    for (let i = 0; i < spine.length; i++) {
      const p = spine[i],
        a = spine[Math.max(0, i - 1)],
        b = spine[Math.min(spine.length - 1, i + 1)];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        norm = Math.hypot(dx, dy) || 1;
      const taper = 1 - p.s / length;
      let width = (3.6 + 3.5 * trailInk) * taper * taper * (3 - 2 * taper);
      if (fold !== null) {
        width = Math.min(width, 0.35 + Math.abs(p.s - fold) * 0.35);
        if (p.s > fold) width *= Math.exp(-fold / 6);
      }
      const nx = (-dy / norm) * width,
        ny = (dx / norm) * width;
      left.push({ x: p.x + nx, y: p.y + ny });
      right.push({ x: p.x - nx, y: p.y - ny });
    }
    const outline = left.concat(right.reverse());
    let path = 'M' + pointText(outline[0]);
    for (let i = 1; i < outline.length - 1; i++) {
      const p = outline[i],
        q = outline[i + 1];
      path += 'Q' + pointText(p) + ' ' + pointText({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    }
    ribbon.setAttribute('d', path + 'L' + pointText(outline.at(-1)) + 'Z');
    wakeInk.style.opacity = String(trailInk);
  }

  function paint() {
    const x = bodyX.x + recoilX.x,
      y = bodyY.x + recoilY.x;
    body.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    const offset = Math.hypot(x - point.x, y - point.y);
    sight.style.opacity = String(Math.min(1, Math.max(0, (offset - 7) / 12)));
    const radians = (twist.x * Math.PI) / 180,
      c = Math.cos(radians),
      s = Math.sin(radians);
    const xx = 1 + shapeX.x,
      yy = 1 - shapeX.x * 0.79,
      xy = shapeY.x * 0.89;
    mark.style.transform =
      'matrix(' + [xx * c + xy * s, xy * c + yy * s, xy * c - xx * s, yy * c - xy * s, 0, 0].join(',') + ')';
    mark.style.scale = String(1 + pressure.x);
    drawTrail(x, y);
  }

  function animate(now) {
    frame = 0;
    if (!active) return;
    // A resumed tab or a long blocked frame gets a fresh origin and an empty
    // trail. Catching up stale motion would draw a streak across the viewport.
    if (now - lastPaint > 150) resetPhysics(point.x, point.y, now);
    lastPaint = now;
    while (clock + stepMs <= now) {
      clock += stepMs;
      integrate(clock);
    }
    const settled =
      !contact &&
      now - point.at > 165 &&
      trailInk < 0.003 &&
      Math.hypot(bodyX.x - point.x, bodyY.x - point.y, recoilX.x, recoilY.x) < 0.11 &&
      Math.hypot(bodyX.v, bodyY.v, recoilX.v, recoilY.v) < 2 &&
      Math.abs(twist.x) < 0.11 &&
      Math.abs(pressure.x - (pressed ? -0.26 : 0)) < 0.002;
    if (settled) {
      resetPhysics(point.x, point.y, now);
      pressure.x = pressed ? -0.26 : 0;
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
      { x: r.left, y: r.top, nx: -1, ny: 0 },
      { x: r.right, y: r.top, nx: 1, ny: 0 },
      { x: r.left, y: r.top, nx: 0, ny: -1 },
      { x: r.left, y: r.bottom, nx: 0, ny: 1 }
    ];
    const signed = (face, px, py) => (px - face.x) * face.nx + (py - face.y) * face.ny;
    let nearest = faces[0],
      distance = -Infinity;
    for (const face of faces) {
      face.span = Math.min(r.width, r.height);
      const end = signed(face, x, y);
      if (end > distance) {
        distance = end;
        nearest = face;
      }
      if (!from) continue;
      const start = signed(face, from.x, from.y);
      if (start * end > 0 || start === end) continue;
      const t = start / (start - end);
      const ix = from.x + (x - from.x) * t,
        iy = from.y + (y - from.y) * t;
      if (ix >= r.left - 0.1 && ix <= r.right + 0.1 && iy >= r.top - 0.1 && iy <= r.bottom + 0.1) return face;
    }
    return nearest;
  }

  function materialFor(node, mode) {
    if (mode !== 'link') return mode;
    return node.matches('button,summary,input,label,[role=button],.btn,.nav-telegram-2,.sd-detail')
      ? 'button'
      : 'link';
  }

  function classify(el, x, y, buttons = 0, moving = false) {
    const selection = getSelection();
    if (
      !ready ||
      !capable.matches ||
      document.hidden ||
      !(el instanceof Element) ||
      el.closest(native) ||
      document.activeElement?.matches(editable) ||
      (selection && !selection.isCollapsed && (selection.containsNode(el, true) || (buttons === 1 && !dragging)))
    ) {
      if (active) hide();
      return false;
    }
    const next = dragging ? { node: hit, mode: 'drag' } : targetAt(el, x, y);
    if (next.node !== hit) {
      const previousHit = hit,
        previousSurface = surface;
      hit = next.node;
      surface = materialFor(hit, next.mode);
      if (moving && point) {
        const node = hit || previousHit;
        const at = performance.now();
        if (node) {
          const face = edge(node, x, y, point);
          const sign = hit ? -1 : 1;
          const crossing = sign * ((x - point.x) * face.nx + (y - point.y) * face.ny);
          // Project recent hand travel onto the crossed face. Sliding along
          // an edge contributes no impact. Re-crossing the same edge starts
          // with the travel earned on its new side, even on a high-DPI mouse.
          const runUp = Math.max(0, sign * ((x - approachX) * face.nx + (y - approachY) * face.ny));
          if (face.nx) approachX = x;
          else approachY = y;
          const energy = (runUp / 26) ** 4;
          const strength = energy / (1 + energy);
          // Skip subpixel work beneath the spring's existing rest tolerance.
          const profile = surfaces[hit ? surface : previousSurface];
          if (crossing > 0 && strength * profile.excursion > 0.1 && at - lastImpact > 67) {
            contact = { face, profile, at, entering: !!hit, strength, loaded: 0 };
          } else if (contact && !contact.loaded) contact = null;
        }
      } else contact = null;
    }
    mode = next.mode;
    if (pointer.dataset.mode !== mode) pointer.dataset.mode = mode;
    if (pointer.dataset.surface !== surface) pointer.dataset.surface = surface;
    return true;
  }

  function recordInput(x, y, at) {
    const last = samples.at(-1);
    if (last && at < last.at) return;
    if (last && at === last.at) {
      last.x = x;
      last.y = y;
      return;
    }
    // Start a new stroke where the previous one stopped. An old, stationary
    // sample together with a fresh event does not describe a long, slow glide.
    if (last && at - last.at > 60) samples.push({ x: last.x, y: last.y, at: at - 8 });
    samples.push({ x, y, at });
  }

  function move(event) {
    const x = event.clientX,
      y = event.clientY,
      at = event.timeStamp;
    if (event.pointerType !== 'mouse' || x < 0 || y < 0 || x >= root.clientWidth || y >= root.clientHeight) {
      if (active) hide();
      return;
    }
    const moved = !point || x !== point.x || y !== point.y;
    if (!classify(event.target, x, y, event.buttons, moved)) return;
    if (!active) {
      resetPhysics(x, y, at);
      active = true;
      pointer.classList.add('is-active');
      root.classList.add('rw-pointer-on');
    } else if (moved) {
      const coalesced = event.getCoalescedEvents?.() || [];
      for (const sample of coalesced) recordInput(sample.clientX, sample.clientY, sample.timeStamp);
      recordInput(x, y, at);
    }
    point = { x, y, at };
    // The sight alone follows the hardware immediately. The body and ribbon
    // are painted independently on the next animation frame.
    sight.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    if (moved) start();
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
    if (!event.isPrimary || event.button !== 0 || !active || !classify(event.target, event.clientX, event.clientY))
      return;
    pressed = true;
    dragging = mode === 'drag';
    pointer.dataset.pressed = 'true';
    start();
  }

  function release() {
    if (!pressed) return;
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
