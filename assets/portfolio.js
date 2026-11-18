function initMediaViewer() {
  const dialog = document.querySelector("#rw-viewer");
  if (!dialog || !dialog.showModal) return;
  const stage = dialog.querySelector(".rw-view-stage");
  const image = stage.querySelector("img");
  const title = dialog.querySelector("h2");
  const caption = dialog.querySelector("#rw-view-context");
  const months = dialog.querySelector("[data-report-months]");
  const status = dialog.querySelector("[data-view-status]");
  const close = dialog.querySelector("[data-view-close]");
  const scales = [...dialog.querySelectorAll("[data-view-mode]")];
  let trigger;
  let mode = "fit";
  let pagePosition = { x: 0, y: 0 };
  let pan = null;
  let suppressZoomUntil = 0;
  image.draggable = false;
  stage.setAttribute("aria-label", "Изображение. Для перемещения используйте мышь или стрелки клавиатуры.");

  function updateOverflow() {
    stage.dataset.overflow = String(stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1);
  }

  function stopPan() {
    const previous = pan;
    pan = null;
    delete stage.dataset.panning;
    if (previous && stage.hasPointerCapture(previous.id)) stage.releasePointerCapture(previous.id);
  }

  function sourceAtViewportPoint(point) {
    const bounds = stage.getBoundingClientRect();
    const imageBounds = image.getBoundingClientRect();
    const scale = imageBounds.width / image.naturalWidth;
    const x = point ? point.x - bounds.left - stage.clientLeft : stage.clientWidth / 2;
    const y = point ? point.y - bounds.top - stage.clientTop : stage.clientHeight / 2;
    return {
      sourceX: (bounds.left + stage.clientLeft + x - imageBounds.left) / scale,
      sourceY: (bounds.top + stage.clientTop + y - imageBounds.top) / scale,
      fractionX: x / stage.clientWidth,
      fractionY: y / stage.clientHeight
    };
  }

  function setScale(value, announce, options = {}) {
    stopPan();
    const loaded = image.complete && image.naturalWidth > 0;
    const focal = loaded && !options.reset ? sourceAtViewportPoint(options.point) : null;
    mode = value;
    image.style.width = value === "fit"
      ? loaded ? `min(100%, ${image.naturalWidth}px)` : "100%"
      : loaded ? `${image.naturalWidth * Number(value)}px` : "100%";
    stage.dataset.scale = value;
    for (const control of scales) control.setAttribute("aria-pressed", String(control.dataset.viewMode === value));
    if (focal) {
      const bounds = stage.getBoundingClientRect();
      const imageBounds = image.getBoundingClientRect();
      const scale = imageBounds.width / image.naturalWidth;
      const offsetX = imageBounds.left - bounds.left - stage.clientLeft + stage.scrollLeft;
      const offsetY = imageBounds.top - bounds.top - stage.clientTop + stage.scrollTop;
      const viewportX = options.point ? options.point.x - bounds.left - stage.clientLeft : stage.clientWidth * focal.fractionX;
      const viewportY = options.point ? options.point.y - bounds.top - stage.clientTop : stage.clientHeight * focal.fractionY;
      stage.scrollLeft = offsetX + focal.sourceX * scale - viewportX;
      stage.scrollTop = offsetY + focal.sourceY * scale - viewportY;
    } else {
      stage.scrollTop = stage.scrollLeft = 0;
    }
    updateOverflow();
    if (announce) status.textContent = value === "fit"
      ? "Изображение по ширине области просмотра."
      : `Масштаб ${Number(value) * 100} процентов. Можно перемещать изображение мышью или прокручивать его.`;
  }

  image.addEventListener("load", () => setScale(mode, false, { reset: true }));
  image.addEventListener("error", () => { status.textContent = "Не удалось загрузить изображение. Закройте просмотр и попробуйте ещё раз."; });
  for (const control of scales) control.addEventListener("click", () => {
    suppressZoomUntil = 0;
    setScale(control.dataset.viewMode, true);
  });
  stage.addEventListener("dblclick", event => {
    if (performance.now() < suppressZoomUntil || !image.naturalWidth) return;
    event.preventDefault();
    setScale(mode === "fit" ? "1.5" : "fit", true, { point: { x: event.clientX, y: event.clientY } });
  });

  for (const anchor of document.querySelectorAll("a[data-view-title]")) {
    anchor.addEventListener("click", event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trigger = anchor;
      pagePosition = { x: window.scrollX, y: window.scrollY };
      title.textContent = anchor.dataset.viewTitle;
      caption.textContent = anchor.dataset.viewCaption || "";
      caption.hidden = !caption.textContent;
      months.hidden = !anchor.hasAttribute("data-view-traffic");
      if (caption.hidden) dialog.removeAttribute("aria-describedby");
      else dialog.setAttribute("aria-describedby", caption.id);
      image.alt = anchor.dataset.viewAlt;
      image.removeAttribute("src");
      mode = "fit";
      image.src = anchor.href;
      setScale("fit", false, { reset: true });
      status.textContent = "";
      dialog.showModal();
      document.documentElement.classList.add("rw-media-open");
      close.focus({ preventScroll: true });
    });
  }

  stage.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || !event.isPrimary || event.button !== 0 || stage.dataset.overflow !== "true") return;
    pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: false };
  });
  window.addEventListener("pointermove", event => {
    if (pan?.id !== event.pointerId) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      pan.moved = true;
      stage.dataset.panning = "true";
      stage.setPointerCapture(event.pointerId);
    }
    if (event.cancelable) event.preventDefault();
    stage.scrollLeft = pan.left - dx;
    stage.scrollTop = pan.top - dy;
  }, { passive: false });
  window.addEventListener("pointerup", event => {
    if (pan?.id !== event.pointerId) return;
    if (pan.moved) suppressZoomUntil = performance.now() + 300;
    stopPan();
  });
  window.addEventListener("pointercancel", event => { if (pan?.id === event.pointerId) stopPan(); });
  stage.addEventListener("lostpointercapture", event => {
    if (event.target === stage && pan?.id === event.pointerId && !stage.hasPointerCapture(event.pointerId)) stopPan();
  });
  stage.addEventListener("dragstart", event => event.preventDefault());
  window.addEventListener("blur", stopPan);
  window.addEventListener("resize", () => { stopPan(); if (dialog.open) updateOverflow(); });
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(stage);
  }
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener("close", () => {
    stopPan();
    document.documentElement.classList.remove("rw-media-open");
    window.scrollTo({ left: pagePosition.x, top: pagePosition.y, behavior: "instant" });
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  });
}

initMediaViewer();

function enhancePortfolio() {
  const picker = document.querySelector("[data-work-picker]");
  if (!picker) return;
  const frames = [...picker.querySelectorAll("[data-work-image]")];
  const switches = [...picker.querySelectorAll("[data-work-view]")].map(
    (link) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.workView = link.dataset.workView;
      button.textContent = link.textContent;
      button.setAttribute("aria-controls", "pf-pirr-display");
      link.replaceWith(button);
      return button;
    },
  );
  function show(view, animate) {
    for (const control of switches)
      control.setAttribute(
        "aria-pressed",
        String(control.dataset.workView === view),
      );
    for (const frame of frames) {
      const selected = frame.dataset.workImage === view;
      frame.hidden = !selected;
      frame.classList.toggle("pf-entrance", selected && animate);
    }
  }
  for (const control of switches)
    control.addEventListener("click", () =>
      show(control.dataset.workView, true),
    );
  show("home", false);
}
enhancePortfolio();
