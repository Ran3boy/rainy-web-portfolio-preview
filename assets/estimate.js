(() => {
  const brief = document.querySelector(".estimate-brief");
  if (!brief) return;
  const controls = brief.querySelector(".estimate-switch");
  const tabs = Array.from(controls.querySelectorAll("button"));
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute("aria-controls")));
  function select(index) {
    tabs.forEach((tab, i) => {
      const active = index === i;
      tab.tabIndex = active ? 0 : -1;
      tab.setAttribute("aria-selected", String(active));
      panels[i].inert = !active;
      panels[i].setAttribute("aria-hidden", String(!active));
      panels[i].classList.toggle("is-selected", active);
    });
    controls.style.setProperty("--selection", index);
  }
  controls.setAttribute("role", "tablist");
  tabs.forEach((tab, i) => {
    tab.setAttribute("role", "tab");
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", tab.id);
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", event => {
      const target = {ArrowLeft:(i + tabs.length - 1) % tabs.length, ArrowRight:(i + 1) % tabs.length, Home:0, End:tabs.length-1}[event.key];
      if (target === undefined) return;
      event.preventDefault();
      select(target);
      tabs[target].focus();
    });
  });
  select(0);
  brief.dataset.enhanced = "";
  controls.hidden = false;
})();
