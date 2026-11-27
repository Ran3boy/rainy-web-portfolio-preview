function initFilters() {
  const controls = document.querySelector(".rw-filters");
  if (!controls) return;
  const buttons = [...controls.querySelectorAll("[data-case-filter]")];
  const groups = [...document.querySelectorAll("[data-case-group]")];
  const status = document.querySelector("[data-filter-status]");
  const filters = new Set(buttons.map(button => button.dataset.caseFilter));
  function apply(requested, announce) {
    const selected = filters.has(requested) ? requested : "all";
    for (const button of buttons)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.caseFilter === selected),
      );
    for (const group of groups)
      group.hidden = selected !== "all" && group.dataset.caseGroup !== selected;
    if (announce && status) {
      const count = groups.filter(group => !group.hidden).reduce((total, group) => total + group.querySelectorAll("[data-case-entry]").length, 0);
      const label = buttons.find(button => button.dataset.caseFilter === selected)?.textContent.trim();
      status.textContent = `${label}. Показано проектов: ${count}.`;
    }
  }
  function read() {
    return new URL(location.href).searchParams.get("filter");
  }
  for (const button of buttons)
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;
      const selected = button.dataset.caseFilter;
      const url = new URL(location.href);
      if (selected === "all") url.searchParams.delete("filter");
      else url.searchParams.set("filter", selected);
      history.pushState(null, "", url);
      apply(selected, true);
    });
  window.addEventListener("popstate", () => apply(read(), true));
  apply(read(), false);
  controls.hidden = false;
}

initFilters();
