(() => {
  const group = document.querySelector(".home-engagement");
  if (!group) return;

  const focusCard = group.querySelector('[data-process-card="discovery"]');
  const questions = {
    choice: "По каким характеристикам покупатель выбирает товар?",
    enquiry: "Какие сведения о товаре должны прийти вместе с заявкой?",
  };
  const choices = [...focusCard.querySelectorAll("[data-focus]")];
  for (const choice of choices) {
    choice.addEventListener("click", () => {
      focusCard.dataset.selected = choice.dataset.focus;
      for (const other of choices) other.setAttribute("aria-pressed", String(other === choice));
      focusCard.querySelector("[data-question]").textContent = questions[choice.dataset.focus];
    });
  }

  const scope = group.querySelector('[data-process-card="scope"]');
  const scopeToggle = scope.querySelector("[data-scope-toggle]");
  scopeToggle.addEventListener("click", () => {
    const expanded = scope.dataset.expanded !== "true";
    scope.dataset.expanded = String(expanded);
    scopeToggle.setAttribute("aria-expanded", String(expanded));
    scope.querySelector("[data-scope-label]").textContent = expanded ? "Убрать форму" : "Добавить форму";
    scope.querySelector("#eg-scope-result").textContent = expanded ? "Подбор и отправка заявки" : "Подбор по характеристикам";
  });

  const range = group.querySelector("[data-compare]");
  const updateRange = () => {
    range.parentElement.style.setProperty("--split", range.value + "%");
    range.setAttribute("aria-valuetext", "До правки: " + range.value + "%, после: " + (100 - Number(range.value)) + "%");
  };
  range.addEventListener("input", updateRange);
  updateRange();

  const transfer = group.querySelector('[data-process-card="handover"]');
  const handover = transfer.querySelector("[data-handover]");
  const steps = [
    {phase: "initial", tab: "Форма запроса", status: "В задании: страница каталога и форма запроса.", action: "Сверить комплект", label: "К проверке", title: "Комплект"},
    {phase: "review", tab: "Форма запроса ✓", status: "В комплекте: страница каталога и форма. Состав совпадает с заданием.", action: "Что передаём", label: "Сверка состава", title: "Есть оба пункта"},
    {phase: "delivery", tab: "Материалы", status: "К передаче: материалы, доступ к сайту и памятка по редактированию.", action: "К началу сверки", label: "К передаче", title: "Доступы и файлы"},
  ];
  let step = 0;
  handover.addEventListener("click", () => {
    step = (step + 1) % steps.length;
    const next = steps[step];
    transfer.dataset.phase = next.phase;
    transfer.querySelector("[data-wallet-tab]").textContent = next.tab;
    transfer.querySelector("[data-pocket-label]").textContent = next.label;
    transfer.querySelector("[data-pocket-title]").textContent = next.title;
    transfer.querySelector("#eg-handover-status").textContent = next.status;
    transfer.querySelector("[data-handover-label]").textContent = next.action;
  });

  for (const control of group.querySelectorAll("button[hidden], input[hidden]")) control.hidden = false;
  group.classList.add("eg-ready");
})();
