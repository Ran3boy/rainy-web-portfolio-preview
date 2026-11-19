// Native history restores the scroll position. Return the keyboard to the case or report it opened.
(() => {
  const wall = document.querySelector("#works, [data-case-browser]");
  if (!wall) return;
  wall.addEventListener("click", event => {
    if (event.defaultPrevented || event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest("a[href]");
    if (link && !link.hasAttribute("data-enquire") && link.origin === location.origin && !link.target && link.pathname !== location.pathname && !link.hasAttribute("data-view-title")) {
      history.replaceState({ ...history.state, workReturn: link.getAttribute("href") }, "");
    }
  });
  window.addEventListener("pageshow", event => {
    if (!event.persisted && performance.getEntriesByType("navigation")[0]?.type !== "back_forward") return;
    const href = history.state?.workReturn;
    if (!href) return;
    const link = [...wall.querySelectorAll("a[href]")].find(anchor => anchor.getAttribute("href") === href);
    if (link) link.focus({ preventScroll: true });
    const nextState = { ...history.state };
    delete nextState.workReturn;
    history.replaceState(nextState, "");
  });
})();
