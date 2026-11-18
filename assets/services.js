(() => {
  const list = document.querySelector("[data-services]");
  if (!list) return;

  // Native details keep the same content and destinations available without JS.
  // Buttons allow the closing panel to animate while its links immediately leave tab order.
  const entries = [...list.querySelectorAll("details")].map((details) => {
    const summary = details.querySelector("summary");
    const panel = details.querySelector(".sd-body");
    const row = document.createElement("article");
    row.className = details.className;
    row.dataset.key = details.dataset.key;
    const heading = document.createElement("h3");
    const button = document.createElement("button");
    button.type = "button";
    button.className = summary.className;
    button.id = summary.id;
    button.setAttribute("aria-controls", panel.id);
    button.append(...summary.childNodes);
    heading.append(button);
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", button.id);
    row.append(heading, panel);
    details.replaceWith(row);
    const entry = { row, button, panel };
    setOpen(entry, details.open);
    return entry;
  });
  list.dataset.enhanced = "";

  function setOpen({ row, button, panel }, open) {
    button.setAttribute("aria-expanded", String(open));
    row.classList.toggle("sd-active", open);
    panel.inert = !open;
    panel.setAttribute("aria-hidden", String(!open));
  }

  for (const entry of entries) {
    entry.button.addEventListener("click", () => {
      const opening = entry.button.getAttribute("aria-expanded") !== "true";
      if (entries.some((item) => item.panel.contains(document.activeElement))) {
        entry.button.focus({ preventScroll: true });
      }
      const top = entry.button.getBoundingClientRect().top;
      const above = entries.slice(0, entries.indexOf(entry));
      // A closing sibling above the chosen heading must not carry it offscreen.
      for (const item of above) item.row.classList.add("sd-settle");
      for (const item of entries) setOpen(item, item === entry && opening);
      const shift = entry.button.getBoundingClientRect().top - top;
      if (top >= 0 && top < innerHeight && Math.abs(shift) > 0.5) {
        window.scrollBy({top: shift, behavior: "instant"});
      }
      for (const item of above) item.row.classList.remove("sd-settle");
    });
    entry.row.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && entry.button.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        entry.button.focus({ preventScroll: true });
        setOpen(entry, false);
      }
    });
  }
})();
