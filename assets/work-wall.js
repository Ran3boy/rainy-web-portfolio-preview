// Native history restores the scroll position. Return the keyboard to the case or report it opened.
(() => {
  const wall = document.querySelector("#works, [data-case-browser]");
  if (!wall) return;
  const reel = wall.querySelector("[data-case-reel]");
  const track = reel?.querySelector("[data-reel-track]");
  function revealCard(card) {
    const left = card.offsetLeft;
    if (left < track.scrollLeft - 1 || left + card.offsetWidth > track.scrollLeft + track.clientWidth + 1) {
      track.scrollTo({left, behavior: "instant"});
    }
  }
  if (track && track.children.length > 1) {
    const cards = [...track.children];
    const controls = reel.querySelector(".ww-reel-controls");
    const previous = controls.querySelector("[data-reel-prev]");
    const next = controls.querySelector("[data-reel-next]");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let destination = null;

    function sync() {
      const end = track.scrollWidth - track.clientWidth;
      if (destination !== null && Math.abs(track.scrollLeft - destination) < 2) destination = null;
      previous.setAttribute("aria-disabled", String(track.scrollLeft <= 1));
      next.setAttribute("aria-disabled", String(track.scrollLeft >= end - 1));
      controls.hidden = end <= 1;
    }
    function step(direction) {
      const position = destination ?? track.scrollLeft;
      const end = track.scrollWidth - track.clientWidth;
      const stops = cards.map(card => Math.min(card.offsetLeft, end));
      const target = direction > 0
        ? stops.find(left => left > position + 1)
        : stops.reverse().find(left => left < position - 1);
      if (target === undefined) return;
      destination = target;
      track.scrollTo({left: target, behavior: reduced.matches ? "instant" : "smooth"});
    }
    previous.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    track.addEventListener("scroll", sync, { passive: true });
    track.addEventListener("scrollend", () => { destination = null; sync(); });
    for (const event of ["pointerdown", "wheel"]) {
      track.addEventListener(event, () => { destination = null; }, { passive: true });
    }
    track.addEventListener("focusin", event => {
      const link = event.target.closest("a:focus-visible");
      if (link) requestAnimationFrame(() => {
        if (document.activeElement === link) revealCard(link.closest("li"));
      });
    });
    track.addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const i = cards.indexOf(event.target.closest("li"));
      if (i < 0) return;
      const index = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: cards.length - 1 }[event.key];
      if (index === undefined) return;
      event.preventDefault();
      const card = cards[Math.max(0, Math.min(cards.length - 1, index))];
      destination = null;
      card.querySelector("a").focus({ preventScroll: true });
      revealCard(card);
    });
    new ResizeObserver(() => { destination = null; sync(); }).observe(track);
    sync();
  }
  wall.addEventListener("click", event => {
    if (event.defaultPrevented || event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest("a[href]");
    if (link && !link.hasAttribute("data-enquire") && link.origin === location.origin && !link.target && link.pathname !== location.pathname && !link.hasAttribute("data-view-title")) {
      const state = { ...history.state, workReturn: link.getAttribute("href") };
      if (track?.contains(link)) state.workScroll = track.scrollLeft;
      history.replaceState(state, "");
    }
  });
  window.addEventListener("pageshow", event => {
    if (!event.persisted && performance.getEntriesByType("navigation")[0]?.type !== "back_forward") return;
    const href = history.state?.workReturn;
    if (!href) return;
    const link = [...wall.querySelectorAll("a[href]")].find(anchor => anchor.getAttribute("href") === href);
    if (track && track.contains(link) && Number.isFinite(history.state.workScroll)) {
      track.scrollTo({left: history.state.workScroll, behavior: "instant"});
      revealCard(link.closest("li"));
    }
    if (link) link.focus({ preventScroll: true });
    const nextState = { ...history.state };
    delete nextState.workReturn;
    delete nextState.workScroll;
    history.replaceState(nextState, "");
  });
})();
