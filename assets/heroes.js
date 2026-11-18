for (const exhibit of document.querySelectorAll('[data-exhibit]')) {
  const projects = [...exhibit.querySelectorAll('[data-exhibit-id]')];
  const controls = [...exhibit.querySelectorAll('a[data-pick],button[data-pick]')].map(link => {
    if (link.tagName === 'BUTTON') return link;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.pick = link.dataset.pick;
    button.className = link.className;
    button.textContent = link.textContent;
    button.setAttribute('aria-label', 'Показать проект ' + link.textContent);
    button.setAttribute('aria-controls', 'hero-project-' + link.dataset.pick);
    link.replaceWith(button);
    return button;
  });
  const artwork = exhibit.querySelector('[data-hero-art]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.createElement('p');
  status.className = 'h-switch-status';
  status.setAttribute('role', 'status');
  exhibit.append(status);
  for (const image of artwork.querySelectorAll('img')) image.draggable = false;
  let selected = -1;
  let version = 0;
  let gesture = null;
  let suppressClickUntil = 0;
  let artworkAnimation = null;
  const motions = new Set();

  function stop() {
    version++;
    for (const motion of motions) motion.cancel();
    motions.clear();
    delete exhibit.dataset.switching;
  }

  function select(requested) {
    const index = (requested + projects.length) % projects.length;
    if (index === selected) return;
    const initial = selected < 0;
    const old = initial ? null : projects[selected];
    const restoreFocus = old?.contains(document.activeElement);
    const before = projects.map(project => getComputedStyle(project).transform);
    stop();
    const currentVersion = version;
    exhibit.dataset.switching = 'true';
    selected = index;
    for (const [i, project] of projects.entries()) {
      const active = i === selected;
      project.dataset.depth = String((i - selected + projects.length) % projects.length);
      project.inert = !active;
      project.setAttribute('aria-hidden', String(!active));
      controls[i].classList.toggle('selected', active);
      controls[i].setAttribute('aria-pressed', String(active));
    }
    if (restoreFocus) projects[selected].querySelector('.h-sheet-foot').focus({ preventScroll: true });
    if (initial || reduced.matches) { delete exhibit.dataset.switching; return; }
    status.textContent = 'Проект ' + controls[selected].textContent;
    const endings = projects.map(project => getComputedStyle(project).transform);
    for (const [i, project] of projects.entries()) {
      const arrival = i === selected;
      const frames = arrival ? [
        { transform: before[i] },
        { transform: new DOMMatrix(endings[i]).translate(0, -5).toString(), offset: .8 },
        { transform: endings[i] }
      ] : [{ transform: before[i] }, { transform: endings[i] }];
      const motion = project.animate(frames, {
        duration: arrival ? 520 : 460,
        easing: 'cubic-bezier(.2,.75,.2,1)',
        fill: 'both'
      });
      motions.add(motion);
      motion.finished.then(() => {
        motions.delete(motion);
        if (!motions.size && version === currentVersion) {
          motion.cancel();
          delete exhibit.dataset.switching;
        } else motion.cancel();
      }, () => motions.delete(motion));
    }
  }

  function resetArtwork() {
    const drag = gesture;
    gesture = null;
    delete exhibit.dataset.dragging;
    if (drag && artwork.hasPointerCapture(drag.id)) artwork.releasePointerCapture(drag.id);
    const from = getComputedStyle(artwork).transform;
    artworkAnimation?.cancel();
    artwork.style.removeProperty('transform');
    if (drag?.horizontal && !reduced.matches) {
      artworkAnimation = artwork.animate([
        { transform: from },
        { transform: `translateX(${-drag.dx * .016}px) rotate(0deg)`, offset: .76 },
        { transform: 'none' }
      ], { duration: 380, easing: 'cubic-bezier(.2,.72,.2,1)' });
    }
    return drag;
  }

  select(0);
  controls.forEach((button, i) => {
    button.addEventListener('click', () => { if (gesture) resetArtwork(); select(i); });
    button.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const positions = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: controls.length - 1 };
      if (!(event.key in positions)) return;
      event.preventDefault();
      if (gesture) resetArtwork();
      select(positions[event.key]);
      controls[selected].focus({ preventScroll: true });
    });
  });
  artwork.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest('button,input,textarea,select')) return;
    artworkAnimation?.cancel();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, horizontal: false };
  });
  window.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) { resetArtwork(); return; }
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      gesture.horizontal = true;
      exhibit.dataset.dragging = 'true';
      artwork.setPointerCapture(event.pointerId);
    }
    gesture.dx = dx;
    if (event.cancelable) event.preventDefault();
    if (!reduced.matches) artwork.style.transform = `translateX(${Math.max(-30, Math.min(30, dx * .22))}px) rotate(${Math.max(-2, Math.min(2, dx / 80))}deg)`;
  }, { passive: false });
  window.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const drag = resetArtwork();
    if (!drag?.horizontal) return;
    suppressClickUntil = performance.now() + 400;
    if (Math.abs(drag.dx) > 45) select(selected + (drag.dx < 0 ? 1 : -1));
  });
  window.addEventListener('pointercancel', event => { if (gesture?.id === event.pointerId) resetArtwork(); });
  artwork.addEventListener('lostpointercapture', event => {
    if (event.target === artwork && gesture?.id === event.pointerId && !artwork.hasPointerCapture(event.pointerId)) resetArtwork();
  });
  artwork.addEventListener('click', event => {
    if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);
  artwork.addEventListener('dragstart', event => event.preventDefault());
  window.addEventListener('blur', () => { if (gesture) resetArtwork(); });
  window.addEventListener('resize', () => { if (gesture) resetArtwork(); });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { resetArtwork(); artworkAnimation?.cancel(); stop(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { resetArtwork(); artworkAnimation?.cancel(); stop(); }
  });
  window.addEventListener('pagehide', () => { resetArtwork(); artworkAnimation?.cancel(); stop(); });
}
