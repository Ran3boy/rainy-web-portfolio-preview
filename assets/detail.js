function initFilters() {
  const controls = document.querySelector(".rw-filters");
  if (!controls) return;
  const buttons = [...controls.querySelectorAll("[data-case-filter]")];
  const groups = document.querySelectorAll("[data-case-group]");
  const status = document.querySelector("[data-filter-status]");
  const labels = {
    all: "Показаны все пять работ.",
    development: "Показаны три проекта по разработке.",
    seo: "Показаны два SEO-кейса.",
  };
  function apply(requested, announce) {
    const selected = Object.hasOwn(labels, requested) ? requested : "all";
    for (const button of buttons)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.caseFilter === selected),
      );
    for (const group of groups)
      group.hidden = selected !== "all" && group.dataset.caseGroup !== selected;
    if (announce) status.textContent = labels[selected];
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

function initComposer() {
  const form = document.querySelector("[data-enquiry]");
  if (!form) return;
  const subject = form.elements.service;
  const service = new URL(location.href).searchParams.get("service");
  if ([...subject.options].some((option) => option.value === service))
    subject.value = service;
  const phone = form.elements.phone;
  phone.addEventListener("input", () => phone.setCustomValidity(""));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const number = phone.value.trim();
    const digits = number.replace(/\D/g, "");
    if (
      !/^[\d\s()+.-]+$/.test(number) ||
      digits.length < 7 ||
      digits.length > 15
    ) {
      phone.setCustomValidity("Проверьте номер телефона с кодом страны.");
      phone.reportValidity();
      return;
    }
    const note = form.elements.note.value.trim();
    const message = [
      "Николай, здравствуйте!",
      subject.value
        ? "Интересует: " + subject.selectedOptions[0].textContent + "."
        : "",
      note,
      "Телефон для связи: " + number,
    ]
      .filter(Boolean)
      .join("\n");
    const address = new URL("https://t.me/ran3boy");
    address.searchParams.set("text", message);
    location.assign(address.href);
  });
  document.querySelector("[data-enquiry-section]").hidden = false;
}
initFilters();
initComposer();
