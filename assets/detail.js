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
  const params = new URL(location.href).searchParams;
  const formats = {
    new: ["development", "Хочу обсудить разработку нового сайта."],
    current: ["development", "Нужна оценка доработки сайта."],
    seo: ["seo", "Хочу обсудить SEO-сопровождение."],
  };
  const format = Object.hasOwn(formats, params.get("format")) ? formats[params.get("format")] : null;
  const service = params.get("service") || format?.[0];
  if (format && !params.has("service") && !form.elements.note.value) form.elements.note.value = format[1];
  if ([...subject.options].some((option) => option.value === service))
    subject.value = service;
  const task = form.elements.task;
  const groups = new Map([...task.querySelectorAll("optgroup")].map(group => [group.dataset.service, group]));
  const general = task.options[0];
  function showTasks(selected = "") {
    const group = groups.get(subject.value);
    task.replaceChildren(general);
    if (group) task.append(group);
    task.value = [...task.options].some(option => option.value === selected) ? selected : "";
    task.hidden = !group;
    task.labels[0].hidden = !group;
  }
  showTasks(params.get("task"));
  subject.addEventListener("change", () => showTasks());
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
      task.value ? "Задача: " + task.selectedOptions[0].textContent + "." : "",
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
