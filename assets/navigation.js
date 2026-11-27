(() => {
  const mobile = document.querySelector(".mobile-nav-2");
  const services = document.querySelector(".nav-services-2");
  const disclosures = [mobile, services].filter(Boolean);
  for (const el of disclosures) {
    el.addEventListener("toggle", () => {
      if (el.open)
        for (const other of disclosures) if (other !== el) other.open = false;
    });
  }
  document.addEventListener("click", (e) => {
    for (const el of disclosures)
      if (el.open && !el.contains(e.target)) el.open = false;
  });
  document.addEventListener("focusin", (e) => {
    for (const el of disclosures)
      if (el.open && !el.contains(e.target)) el.open = false;
  });
  matchMedia("(min-width: 821px)").addEventListener("change", () =>
    disclosures.forEach((el) => (el.open = false)),
  );

  const dialog = document.getElementById("rw-finder");
  const trigger = document.querySelector(".finder-open-2");
  if (!dialog || !trigger || typeof dialog.showModal !== "function") return;
  document.documentElement.classList.add("has-nav-js");
  const input = dialog.querySelector("input");
  const status = dialog.querySelector("[role=status]");
  const groups = [...dialog.querySelectorAll(".finder-group-2")];
  const normalize = (value) =>
    value
      .toLocaleLowerCase("ru")
      .replaceAll("ё", "е")
      .replace(/[\s.-]+/g, "");
  function filter() {
    const term = normalize(input.value);
    let total = 0;
    for (const group of groups) {
      const items = [...group.querySelectorAll("a")];
      for (const item of items) {
        item.hidden = !normalize(item.dataset.terms).includes(term);
        if (!item.hidden) total++;
      }
      group.hidden = items.every((a) => a.hidden);
    }
    status.textContent = total
      ? "Найдено совпадений: " + total
      : "Совпадений нет. Попробуйте другое название.";
  }
  let opener;
  let waitingForHistory = false;
  function show(resetQuery) {
    if (dialog.open || document.querySelector("dialog[open]")) return;
    opener = document.activeElement;
    if (
      !opener ||
      opener === document.body ||
      disclosures.some((el) => el.contains(opener))
    )
      opener = trigger;
    disclosures.forEach((el) => (el.open = false));
    if (resetQuery) input.value = "";
    filter();
    dialog.showModal();
    input.focus();
  }
  function open() {
    if (waitingForHistory || document.querySelector("dialog[open]")) return;
    // Keep the source fragment and scroll position when opening or leaving search.
    history.pushState({ ...history.state, rwFinder: true }, "", location.href);
    show(true);
  }
  function requestClose() {
    if (!dialog.open || waitingForHistory) return;
    if (history.state?.rwFinder) {
      waitingForHistory = true;
      history.back();
    } else dialog.close();
  }
  trigger.addEventListener("click", open);
  input.addEventListener("input", filter);
  dialog
    .querySelector("button")
    .addEventListener("click", requestClose);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (e) => {
    // Following the current fragment again does not produce a navigation event.
    const result = e.target.closest("a[href]");
    if (result?.hash && result.href === location.href && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      const section = document.getElementById(result.hash.slice(1));
      if (section) {
        e.preventDefault();
        dialog.addEventListener("close", () => {
          section.setAttribute("tabindex", "-1");
          section.focus({ preventScroll: true });
          section.scrollIntoView({ block: "start" });
        }, { once: true });
        requestClose();
        return;
      }
    }
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      requestClose();
  });
  document.addEventListener("keydown", (e) => {
    if (!dialog.open && document.querySelector("dialog[open]")) return;
    if (e.key === "Escape") {
      if (dialog.open) {
        e.preventDefault();
        requestClose();
        return;
      }
      for (const el of disclosures)
        if (el.open) {
          e.preventDefault();
          el.open = false;
          el.querySelector("summary").focus();
          break;
        }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.altKey) {
      e.preventDefault();
      if (dialog.open) requestClose();
      else open();
    }
  });
  window.addEventListener("popstate", () => {
    waitingForHistory = false;
    if (history.state?.rwFinder) show(false);
    else setTimeout(() => {
      // Restore the opener after the browser restores entry focus.
      if (!history.state?.rwFinder && dialog.open) dialog.close();
    }, 0);
  });
  if (history.state?.rwFinder) show(false);
})();
