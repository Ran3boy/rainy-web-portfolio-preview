// A catalogue link can lead directly to the scope and enquiry inside a disclosure.
function openLinkedOffer() {
  const offer = document.getElementById(location.hash.slice(1));
  if (offer?.matches("details.sh-offer")) offer.open = true;
}
openLinkedOffer();
window.addEventListener("hashchange", openLinkedOffer);

// Leave the complete documents available when scripting is disabled.
for (const group of document.querySelectorAll("[data-sv-switch]")) {
  const list = group.querySelector("[data-sv-controls]");
  const buttons = [...group.querySelectorAll("[data-sv-control]")];
  const panels = buttons.map(button => document.getElementById(button.getAttribute("aria-controls")));
  if (!list || !buttons.length || panels.some(panel => !panel || !group.contains(panel))) continue;

  function select(index) {
    if (group.hasAttribute("data-sv-ready") && buttons[index].getAttribute("aria-selected") !== "true") {
      group.setAttribute("data-sv-interacted", "");
    }
    buttons.forEach((button, i) => {
      const selected = i === index;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
  }
  list.setAttribute("role", "tablist");
  buttons.forEach((button, i) => {
    if (!button.id) button.id = panels[i].id + "-tab";
    button.setAttribute("role", "tab");
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", button.id);
    panels[i].tabIndex = 0;
    button.addEventListener("click", () => select(i));
    button.addEventListener("keydown", event => {
      let next;
      switch (event.key) {
        case "ArrowRight": next = (i + 1) % buttons.length; break;
        case "ArrowLeft": next = (i + buttons.length - 1) % buttons.length; break;
        case "Home": next = 0; break;
        case "End": next = buttons.length - 1; break;
        default: return;
      }
      event.preventDefault();
      select(next);
      buttons[next].focus({ preventScroll: true });
    });
  });
  select(0);
  group.setAttribute("data-sv-ready", "");
  list.hidden = false;
}

for (const directory of document.querySelectorAll("[data-sv-directory]")) {
  const filters = directory.querySelector("[data-sv-filters]");
  const buttons = [...filters.querySelectorAll("[data-sv-filter]")];
  const entries = [...directory.querySelectorAll("[data-sv-entry]")];
  const status = directory.querySelector("[data-sv-count]");
  filters.hidden = false;
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const value = button.dataset.svFilter;
      if (button.getAttribute("aria-pressed") === "true") return;
      for (const other of buttons) other.setAttribute("aria-pressed", String(other === button));
      let count = 0;
      for (const entry of entries) {
        entry.hidden = value !== "all" && entry.dataset.svEntry !== value;
        if (!entry.hidden) count++;
      }
      directory.dataset.svSelection = value;
      status.textContent = "Найдено направлений: " + count;
    });
  }
}
