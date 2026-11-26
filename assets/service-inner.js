// A catalogue link can lead directly to the scope and enquiry inside a disclosure.
function openLinkedOffer() {
  const offer = document.getElementById(location.hash.slice(1));
  if (offer?.matches("details.sh-offer")) offer.open = true;
}
openLinkedOffer();
window.addEventListener("hashchange", openLinkedOffer);

// Restore catalogue controls before the browser restores its scroll position on Back.
const returning = performance.getEntriesByType("navigation")[0]?.type === "back_forward"
  ? history.state?.rwService
  : null;

function rememberDeparture(event) {
  const link = event.target.closest?.("main a[href]");
  if (!link || link.hasAttribute("data-enquire") || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.target === "_blank" || link.hasAttribute("download") || link.origin !== location.origin || link.pathname === location.pathname) return;
  const openOffers = [...document.querySelectorAll("main details[open][id]")].map(item => item.id);
  const details = link.closest("details");
  const index = [...document.querySelectorAll("main a[href]")].indexOf(link);
  const state = {
    index, href: link.getAttribute("href"), openOffers, insideDetails: !!details?.open,
    filter: document.querySelector("[data-sv-filter][aria-pressed=true]")?.dataset.svFilter,
    panel: document.querySelector("[data-sv-control][aria-selected=true]")?.getAttribute("aria-controls")
  };
  history.replaceState({ ...history.state, rwService: state }, "");
}

function restoreLink(state) {
  if (!state) return;
  const link = document.querySelectorAll("main a[href]")[state.index];
  if (!link || link.getAttribute("href") !== state.href) return;
  for (const id of state.openOffers) {
    const details = document.getElementById(id);
    if (details instanceof HTMLDetailsElement) details.open = true;
  }
  const parent = link.closest("details");
  if (parent && state.insideDetails) parent.open = true;
  link.focus({ preventScroll: true });
}

document.addEventListener("click", rememberDeparture);

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
  const vertical = list.classList.contains("ms-controls");
  if (vertical) list.setAttribute("aria-orientation", "vertical");
  buttons.forEach((button, i) => {
    if (!button.id) button.id = panels[i].id + "-tab";
    button.setAttribute("role", "tab");
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", button.id);
    panels[i].tabIndex = 0;
    button.addEventListener("click", () => select(i));
    button.addEventListener("keydown", event => {
      let next;
      if (vertical && event.key === "ArrowDown") next = (i + 1) % buttons.length;
      else if (vertical && event.key === "ArrowUp") next = (i + buttons.length - 1) % buttons.length;
      else
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
  const previous = buttons.findIndex(button => button.getAttribute("aria-controls") === returning?.panel);
  select(previous < 0 ? 0 : previous);
  group.setAttribute("data-sv-ready", "");
  list.hidden = false;
}

for (const directory of document.querySelectorAll("[data-sv-directory]")) {
  const filters = directory.querySelector("[data-sv-filters]");
  const buttons = [...filters.querySelectorAll("[data-sv-filter]")];
  const entries = [...directory.querySelectorAll("[data-sv-entry]")];
  const status = directory.querySelector("[data-sv-count]");
  filters.hidden = false;
  function filterBy(button) {
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
  }
  for (const button of buttons) button.addEventListener("click", () => filterBy(button));
  const previous = buttons.find(button => button.dataset.svFilter === returning?.filter);
  if (previous) filterBy(previous);
}

restoreLink(returning);
window.addEventListener("pageshow", event => {
  if (event.persisted) restoreLink(history.state?.rwService);
});
