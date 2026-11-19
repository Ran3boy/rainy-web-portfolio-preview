// The inline section and the dialog share the same live form and draft.
(() => {
  const section = document.querySelector("#rw-enquiry.ct-section");
  if (!section) return;
  const slot = section.querySelector("[data-contact-slot]");
  const content = slot.querySelector("[data-contact-content]");
  const form = content.querySelector("[data-enquiry]");
  const dialog = document.querySelector("#rw-contact-dialog");
  const panel = dialog.querySelector("[data-contact-panel]");
  const closeButton = dialog.querySelector("[data-contact-close]");
  const title = content.querySelector("#ct-title");
  const service = form.elements.service;
  const task = form.elements.task;
  const groups = new Map([...task.querySelectorAll("optgroup")].map(group => [group.dataset.service, group]));
  const general = task.options[0];
  const contextLabel = form.querySelector("[data-contact-context]");
  const copyButton = form.querySelector("[data-contact-copy]");
  const copyStatus = form.querySelector("[data-copy-status]");
  const manual = form.querySelector("[data-copy-manual]");
  const hint = form.querySelector("#ct-channel-hint");
  const action = form.querySelector("[data-contact-action]");
  const formats = {
    new: { service:"development", task:"new-site" },
    current: { service:"development", task:"improvements" },
    seo: { service:"seo", task:"promotion" },
  };
  const hints = {
    draft: "Черновик откроется в выбранном мессенджере. Вы сможете проверить текст и отправить его сами.",
    profile: "Скопируйте текст заявки и вставьте его в сообщение после перехода в профиль.",
    phone: "Откроется приложение для звонка. При желании можно сохранить текст задачи в буфер обмена.",
  };
  let trigger = null;
  let triggerMenu = null;
  let closeTimer = 0;
  let waitingForHistory = false;
  let currentContext = "";
  let appliedPreset;

  // The native controls remain interactive. Their visible captions can wrap long offer names.
  function syncSelectCaptions() {
    for (const select of [service, task]) select.nextElementSibling.textContent = select.selectedOptions[0]?.textContent || "";
  }

  function populateTasks(selected = "") {
    const group = groups.get(service.value);
    task.replaceChildren(general);
    general.textContent = group ? "Обсудить направление в целом" : "Сначала выберите услугу";
    if (group) task.append(group);
    task.disabled = !group;
    task.value = [...task.options].some(option => option.value === selected) ? selected : "";
    syncSelectCaptions();
  }

  function changeContext(preset) {
    if (appliedPreset && ["service", "task", "context"].every(key => appliedPreset[key] === preset[key])) return;
    appliedPreset = preset;
    if (preset.service && groups.has(preset.service)) {
      service.value = preset.service;
      populateTasks(preset.task);
    }
    currentContext = preset.context || "";
    contextLabel.textContent = currentContext ? "По материалу: " + currentContext : "";
    contextLabel.hidden = !currentContext;
  }

  function getPreset(params, element) {
    const estimate = formats[params.get("format")];
    const selected = element?.dataset.service || params.get("service") || estimate?.service || "";
    return {
      service: selected || section.dataset.service,
      task: element?.dataset.task || params.get("task") || estimate?.task ||
        (!selected || selected === section.dataset.service ? section.dataset.task : ""),
      context: element?.dataset.context || params.get("context") || section.dataset.context,
    };
  }

  function selectedMethod() {
    return form.querySelector('input[name="channel"]:checked');
  }

  function updateMethod() {
    const method = selectedMethod();
    hint.textContent = hints[method.dataset.mode];
    action.textContent = method.dataset.action;
    copyButton.hidden = method.dataset.mode === "draft";
    copyStatus.textContent = "";
    manual.hidden = true;
  }

  function draftText() {
    const parts = ["Николай, здравствуйте!"];
    if (service.value) parts.push("Услуга: " + service.selectedOptions[0].textContent);
    if (task.value) parts.push("Задача: " + task.selectedOptions[0].textContent);
    if (currentContext) parts.push("По материалу: " + currentContext);
    const note = form.elements.note.value.trim();
    const website = form.elements.site.value.trim();
    const name = form.elements.namedItem("name").value.trim();
    if (note) parts.push(note);
    if (website) parts.push("Сайт: " + website);
    if (name) parts.push("Меня зовут " + name + ".");
    if (parts.length === 1) parts.push("Хочу обсудить проект.");
    return parts.join("\n");
  }

  async function copyDraft() {
    const text = draftText();
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = "Текст заявки скопирован.";
      manual.hidden = true;
    } catch {
      const field = manual.querySelector("textarea");
      manual.hidden = false;
      field.value = text;
      field.focus();
      field.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch { /* Manual selection stays available. */ }
      if (copied) {
        manual.hidden = true;
        copyButton.focus({preventScroll:true});
        copyStatus.textContent = "Текст заявки скопирован.";
      } else {
        copyStatus.textContent = "Выделите и скопируйте текст ниже.";
      }
    }
  }

  function handoff(event) {
    event.preventDefault();
    const method = selectedMethod();
    const direct = method.closest(".ct-method-row").querySelector("a");
    if (method.dataset.mode !== "draft") {
      direct.click();
      return;
    }
    // Construct the external URL only when the visitor chooses to open the draft.
    const address = new URL(direct.href);
    address.searchParams.set("text", draftText());
    const link = document.createElement("a");
    link.href = address.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  }

  function updateViewport() {
    if (!dialog.open || !window.visualViewport) return;
    dialog.style.setProperty("--ct-visual-height", visualViewport.height + "px");
    dialog.style.setProperty("--ct-visual-top", visualViewport.offsetTop + "px");
  }

  function openPanel(preset, origin, applyPreset = true) {
    clearTimeout(closeTimer);
    waitingForHistory = false;
    delete dialog.dataset.closing;
    if (origin) {
      trigger = origin;
      triggerMenu = origin.closest("details[open]");
    }
    if (applyPreset) changeContext(preset);
    if (dialog.open) return;
    // Keep the section's place while its form is in the modal top layer.
    slot.style.minHeight = slot.getBoundingClientRect().height + "px";
    document.documentElement.classList.add("ct-locked");
    panel.append(content);
    dialog.showModal();
    dialog.scrollTop = 0;
    updateViewport();
    title.focus({preventScroll:true});
    // Never submit a field or open a software keyboard merely by opening a panel.
  }

  function finishClose() {
    clearTimeout(closeTimer);
    if (!dialog.open) return;
    dialog.close();
    slot.append(content);
    slot.style.removeProperty("min-height");
    document.documentElement.classList.remove("ct-locked");
    delete dialog.dataset.closing;
    waitingForHistory = false;
    if (trigger?.isConnected) {
      if (triggerMenu?.querySelector("summary")?.getClientRects().length) triggerMenu.open = true;
      trigger.focus({preventScroll:true});
    }
  }

  function dismiss() {
    if (!dialog.open || dialog.dataset.closing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finishClose();
    dialog.dataset.closing = "true";
    closeTimer = setTimeout(finishClose, 125);
  }

  function requestClose() {
    if (waitingForHistory || dialog.dataset.closing) return;
    if (history.state?.rwContact) {
      waitingForHistory = true;
      history.back();
    } else dismiss();
  }

  function openFrom(preset, origin) {
    if (!dialog.open) {
      // Preserve the origin fragment. Replacing it can make the browser scroll to
      // and focus an offer heading over the restored enquiry link on Back.
      history.pushState({...history.state, rwContact:preset}, "", location.href);
    }
    openPanel(preset, origin);
  }

  populateTasks();
  changeContext(getPreset(new URLSearchParams(location.search)));
  updateMethod();
  service.addEventListener("change", () => populateTasks());
  form.addEventListener("change", event => {
    if (event.target.name === "channel") updateMethod();
    if (event.target === task) syncSelectCaptions();
  });
  form.addEventListener("input", () => {
    copyStatus.textContent = "";
    manual.hidden = true;
  });
  form.addEventListener("submit", handoff);
  copyButton.addEventListener("click", copyDraft);
  form.hidden = false;
  content.querySelector("[data-contact-direct]").hidden = true;

  if (!dialog.showModal) return;
  for (const control of document.querySelectorAll('a[data-enquire], form[data-contact-trigger-form] button[type="submit"]')) {
    control.setAttribute("aria-haspopup", "dialog");
    control.setAttribute("aria-controls", dialog.id);
  }
  document.addEventListener("click", event => {
    const anchor = event.target.closest?.("a[data-enquire]");
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openFrom(getPreset(new URL(anchor.href).searchParams, anchor), anchor);
  }, true);
  document.addEventListener("submit", event => {
    const estimate = event.target.closest?.("form[data-contact-trigger-form]");
    if (!estimate || event.defaultPrevented) return;
    event.preventDefault();
    openFrom(getPreset(new URLSearchParams(new FormData(estimate)), estimate), event.submitter || estimate.querySelector('button[type="submit"]'));
  }, true);
  closeButton.addEventListener("click", requestClose);
  dialog.addEventListener("cancel", event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const last = !manual.hidden ? manual.querySelector("textarea") : !copyButton.hidden ? copyButton : action.closest("button");
    if (event.shiftKey && (document.activeElement === closeButton || document.activeElement === title)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      closeButton.focus();
    }
  });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
  });
  window.addEventListener("popstate", () => {
    if (history.state?.rwContact) openPanel(history.state.rwContact, null, false);
    else setTimeout(() => {
      // The browser restores its own entry focus after popstate, including when
      // returning to an offer fragment. Restore the trigger after that completes.
      if (!history.state?.rwContact) dismiss();
    }, 0);
  });
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
  if (history.state?.rwContact) openPanel(history.state.rwContact, null);
})();
